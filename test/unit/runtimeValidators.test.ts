import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateQueueUniqueness, validateProcessors } from '../../scripts/lib/runtimeValidators.js';
import { loadQueueContract } from '../../scripts/lib/queueContracts.js';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

describe('runtime validators', () => {
  it('passes queue uniqueness for current contract', () => {
    const repoRoot = resolveRepoRoot();
    const contract = loadQueueContract(path.resolve(repoRoot, 'workers/contracts/queue-contract.json'));
    const result = validateQueueUniqueness(contract);
    expect(result.pass).toBe(true);
  });

  it('detects missing processor module', () => {
    const repoRoot = resolveRepoRoot();
    const contract = loadQueueContract(path.resolve(repoRoot, 'workers/contracts/queue-contract.json'));
    const tampered = {
      ...contract,
      processors: [...contract.processors, { queue: 'email', processorId: 'email.missing', module: 'workers/processors/missing.ts' }]
    };
    const result = validateProcessors(tampered, repoRoot);
    expect(result.pass).toBe(false);
    expect(result.details?.missing).toContain('workers/processors/missing.ts');
  });
});
