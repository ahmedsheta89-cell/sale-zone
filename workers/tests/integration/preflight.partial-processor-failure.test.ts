import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateRuntime } from '../../scripts/lib/runtimeValidators.js';

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

describe('preflight partial processor failure', () => {
  it('fails when one processor module is missing from contract', async () => {
    const repoRoot = resolveRepoRoot();
    const contractPath = path.resolve(repoRoot, 'workers/contracts/queue-contract.json');
    const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
    contract.processors = [...contract.processors, { queue: 'email', processorId: 'email.missing', module: 'workers/processors/missing.ts' }];

    const tempFile = path.join(os.tmpdir(), `queue-contract-${Date.now()}.json`);
    fs.writeFileSync(tempFile, JSON.stringify(contract, null, 2));
    try {
      process.env.PREFLIGHT_DRY_RUN = 'true';
      const checks = await validateRuntime(tempFile, repoRoot);
      const processorCheck = checks.find((item) => item.name === 'processors_resolvable');
      expect(processorCheck?.pass).toBe(false);
    } finally {
      delete process.env.PREFLIGHT_DRY_RUN;
      fs.unlinkSync(tempFile);
    }
  });
});
