import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { loadQueueContract } from '../../scripts/lib/queueContracts.js';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

describe('queue contracts', () => {
  it('loads schema', () => {
    const contract = loadQueueContract(path.resolve(resolveRepoRoot(), 'workers/contracts/queue-contract.json'));
    expect(contract.requiredQueues.length).toBeGreaterThan(0);
  });
});
