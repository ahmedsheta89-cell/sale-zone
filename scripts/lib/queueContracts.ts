import fs from 'node:fs';
import { z } from 'zod';

export const QueueContractSchema = z.object({
  contractVersion: z.string().min(1),
  serviceName: z.string().min(1),
  queuePrefix: z.string().min(1),
  requiredQueues: z.array(z.string().min(1)).min(1),
  allowedQueuesParanoid: z.array(z.string().min(1)).min(1),
  processors: z.array(z.object({ queue: z.string().min(1), processorId: z.string().min(1), module: z.string().min(1) })).min(1),
  heartbeat: z.object({ intervalMs: z.number().int().positive(), stabilityWindowSec: z.number().int().positive(), requiredBeats: z.number().int().positive() }),
  healthThresholds: z.object({ eventLoopLagMsMax: z.number().positive(), memoryRssMbMax: z.number().positive(), redisRttMsMax: z.number().positive(), workerReadyTimeoutSec: z.number().positive() }),
  rollout: z.object({ stepsPercent: z.array(z.number().int().min(1).max(100)).min(1), stepStabilitySec: z.number().positive(), maxErrorRatePct: z.number().min(0).max(100), maxLatencyDriftPct: z.number().min(0), maxDrainSec: z.number().positive() })
}).strict();

export type QueueContract = z.infer<typeof QueueContractSchema>;

export function loadQueueContract(contractPath: string): QueueContract {
  return QueueContractSchema.parse(JSON.parse(fs.readFileSync(contractPath, 'utf8')));
}

export type ContractConsistency = {
  pass: boolean;
  errors: string[];
};

export function validateContractConsistency(contract: QueueContract): ContractConsistency {
  const errors: string[] = [];
  const requiredQueueSet = new Set(contract.requiredQueues);
  const allowedQueueSet = new Set(contract.allowedQueuesParanoid);

  if (requiredQueueSet.size !== contract.requiredQueues.length) {
    errors.push('requiredQueues_has_duplicates');
  }
  if (allowedQueueSet.size !== contract.allowedQueuesParanoid.length) {
    errors.push('allowedQueuesParanoid_has_duplicates');
  }
  for (const queue of requiredQueueSet) {
    if (!allowedQueueSet.has(queue)) {
      errors.push(`required_queue_not_allowed:${queue}`);
    }
  }

  const processorIds = new Set<string>();
  const queueProcessorPair = new Set<string>();
  const processorQueues = new Set<string>();

  for (const processor of contract.processors) {
    if (!requiredQueueSet.has(processor.queue)) {
      errors.push(`processor_queue_not_required:${processor.queue}:${processor.processorId}`);
    }
    if (processorIds.has(processor.processorId)) {
      errors.push(`duplicate_processor_id:${processor.processorId}`);
    }
    processorIds.add(processor.processorId);

    const pair = `${processor.queue}::${processor.processorId}`;
    if (queueProcessorPair.has(pair)) {
      errors.push(`duplicate_queue_processor_binding:${pair}`);
    }
    queueProcessorPair.add(pair);
    processorQueues.add(processor.queue);
  }

  for (const queue of requiredQueueSet) {
    if (!processorQueues.has(queue) && queue !== 'dead-letter') {
      errors.push(`required_queue_missing_processor:${queue}`);
    }
  }

  return { pass: errors.length === 0, errors };
}
