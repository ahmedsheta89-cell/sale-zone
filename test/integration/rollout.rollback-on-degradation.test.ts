import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkWorkerReadiness } from '../../scripts/lib/workerReadiness.js';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

describe('rollout rollback on degradation', () => {
  it('returns failure when redis is unreachable', async () => {
    const repoRoot = resolveRepoRoot();
    const snapshot = { PREFLIGHT_DRY_RUN: process.env.PREFLIGHT_DRY_RUN, REDIS_URL: process.env.REDIS_URL };
    try {
      process.env.PREFLIGHT_DRY_RUN = 'false';
      process.env.REDIS_URL = 'redis://127.0.0.1:6399';
      const report = await checkWorkerReadiness(path.resolve(repoRoot, 'workers/contracts/queue-contract.json'), repoRoot);
      expect(report.pass).toBe(false);
    } finally {
      process.env.PREFLIGHT_DRY_RUN = snapshot.PREFLIGHT_DRY_RUN;
      process.env.REDIS_URL = snapshot.REDIS_URL;
    }
  });
});
