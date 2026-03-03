import path from 'node:path';
import { validateRuntime, type ValidationResult } from './lib/runtimeValidators.js';
import { writeJsonReport } from './lib/reportWriter.js';
import { log } from '../observability/logger.js';

type GateCheck = ValidationResult & { durationMs: number };

function resolveReportPaths(): string[] {
  const repoRoot = resolveRepoRoot();
  return [
    path.resolve(repoRoot, 'workers/output/preflight-gate.report.json'),
    path.resolve(repoRoot, 'reports/paranoid-ultra-final.json'),
    path.resolve(repoRoot, 'workers/output/preflight-gate.latest.json')
  ];
}

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return path.basename(cwd) === 'workers' ? path.resolve(cwd, '..') : cwd;
}

function ensureEnv(name: string): ValidationResult {
  const value = process.env[name];
  return {
    name: `env_${name}`,
    pass: Boolean(value && String(value).trim()),
    details: { present: Boolean(value && String(value).trim()) }
  };
}

async function timedCheck(check: ValidationResult): Promise<GateCheck> {
  const started = Date.now();
  return { ...check, durationMs: Date.now() - started };
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const repoRoot = resolveRepoRoot();
  const contractPath = path.resolve(repoRoot, 'workers/contracts/queue-contract.json');
  const paranoidMode = String(process.env.PARANOID_MODE ?? 'true').toLowerCase() === 'true';

  const envChecks: ValidationResult[] = [
    ensureEnv('NODE_ENV'),
    ensureEnv('PARANOID_MODE'),
    ensureEnv('WORKER_GROUP'),
    ensureEnv('HEARTBEAT_KEY_PREFIX'),
    ensureEnv('ROLL_OUT_KEY_PREFIX'),
    ensureEnv('OUTPUT_DIR'),
    ensureEnv('REDIS_FAIL_CLOSED'),
    ensureEnv('REDIS_REQUIRE_TLS'),
    {
      name: 'env_redis_config',
      pass: Boolean(process.env.REDIS_URL || process.env.REDIS_HOST),
      details: { REDIS_URL: Boolean(process.env.REDIS_URL), REDIS_HOST: Boolean(process.env.REDIS_HOST) }
    }
  ];
  const runtimeChecks = await validateRuntime(contractPath, repoRoot);
  const checks: GateCheck[] = [];
  for (const check of [...envChecks, ...runtimeChecks]) {
    checks.push(await timedCheck(check));
  }

  const failedChecks = checks.filter((check) => !check.pass);
  const warnings = checks.filter((check) => check.pass && check.name.includes('dryRun')).map((check) => check.name);
  const pass = failedChecks.length === 0 && (!paranoidMode || warnings.length === 0);

  for (const check of checks) {
    log(check.pass ? 'info' : 'error', 'preflight_check', {
      phase: 'preflight_gate',
      check: check.name,
      status: check.pass ? 'pass' : 'fail',
      durationMs: check.durationMs,
      details: check.details ?? {}
    });
  }

  const report = {
    generatedAt: new Date().toISOString(),
    paranoidMode,
    pass,
    durationMs: Date.now() - startedAt,
    checks,
    failedChecks,
    warnings
  };

  for (const reportPath of resolveReportPaths()) {
    writeJsonReport(reportPath, report);
  }

  process.exitCode = pass ? 0 : 1;
}

main().catch((error) => {
  const report = {
    generatedAt: new Date().toISOString(),
    pass: false,
    fatal: (error as Error).message
  };
  for (const reportPath of resolveReportPaths()) {
    writeJsonReport(reportPath, report);
  }
  process.exitCode = 2;
});
