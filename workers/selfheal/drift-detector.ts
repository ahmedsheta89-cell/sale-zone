import fs from 'node:fs';
import path from 'node:path';
import { listNodeStates } from '../cluster/node-registry.js';

export async function detectTopologyDrift(contractPath = path.resolve(process.cwd(), 'workers/contracts/queue-contract.json')): Promise<{ drift: boolean; reasons: string[] }> {
  const raw = JSON.parse(fs.readFileSync(contractPath, 'utf8')) as { queuePrefix: string; requiredQueues: string[] };
  const expected = new Set(raw.requiredQueues.map((q) => `${raw.queuePrefix}:${q}`));
  const nodes = await listNodeStates();
  const reasons: string[] = [];

  if (nodes.length === 0) {
    return { drift: true, reasons: ['no_nodes_registered'] };
  }

  const active = new Set<string>();
  for (const node of nodes) {
    for (const queue of node.queues) {
      active.add(queue);
    }
  }

  for (const queue of expected) {
    if (!active.has(queue)) reasons.push(`missing_queue_assignment:${queue}`);
  }

  return { drift: reasons.length > 0, reasons };
}
