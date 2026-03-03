import fs from 'node:fs';
import path from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { checkRedisHealth } from '../../infra/redis/healthcheck.js';
import { loadQueueContract, type QueueContract, validateContractConsistency } from './queueContracts.js';

export type ValidationResult = { name: string; pass: boolean; details?: Record<string, unknown> };

export function validateProcessors(contract: QueueContract, repoRoot: string): ValidationResult {
  const missing = contract.processors.map((p) => p.module).filter((m) => !fs.existsSync(path.resolve(repoRoot, m)));
  return { name: 'processors_resolvable', pass: missing.length === 0, details: { missing } };
}

export function validateQueueUniqueness(contract: QueueContract): ValidationResult {
  const names = contract.requiredQueues.map((q) => `${contract.queuePrefix}:${q}`);
  return { name: 'no_duplicate_queues', pass: new Set(names).size === names.length, details: { names } };
}

export async function validateRuntime(contractPath: string, repoRoot: string): Promise<ValidationResult[]> {
  const contract = loadQueueContract(contractPath);
  const dryRun = String(process.env.PREFLIGHT_DRY_RUN ?? '').toLowerCase() === 'true';
  const redis = dryRun ? { ok: true, rttMs: 0, dryRun: true } : await checkRedisHealth();
  const consistency = validateContractConsistency(contract);
  const bootstrapPath = path.resolve(repoRoot, 'workers/bootstrap.ts');

  const lag = monitorEventLoopDelay({ resolution: 20 });
  lag.enable();
  await new Promise((r) => setTimeout(r, 250));
  lag.disable();

  const eventLoopLagMs = Number(lag.mean) / 1_000_000;
  const memoryRssMb = process.memoryUsage().rss / 1024 / 1024;
  const queuePrefixValid = /^[a-z0-9][a-z0-9-:_]*$/i.test(contract.queuePrefix);
  const expectedQueues = new Set(contract.requiredQueues.map((q) => `${contract.queuePrefix}:${q}`));
  const noUnexpectedQueues = !contract.allowedQueuesParanoid.some((q) => !contract.requiredQueues.includes(q));
  const unhandledAtBoot: Array<Record<string, unknown>> = [];
  const onUnhandled = (reason: unknown) => {
    unhandledAtBoot.push({ reason: String((reason as Error)?.message ?? reason) });
  };
  process.on('unhandledRejection', onUnhandled);
  await new Promise((r) => setTimeout(r, 20));
  process.off('unhandledRejection', onUnhandled);

  return [
    { name: 'redis_connectivity', pass: redis.ok, details: redis },
    { name: 'contract_consistency', pass: consistency.pass, details: { errors: consistency.errors } },
    { name: 'bootstrap_entrypoint_present', pass: fs.existsSync(bootstrapPath), details: { bootstrapPath } },
    validateProcessors(contract, repoRoot),
    validateQueueUniqueness(contract),
    { name: 'queue_prefix_match', pass: queuePrefixValid, details: { queuePrefix: contract.queuePrefix } },
    { name: 'required_queues_present', pass: expectedQueues.size === contract.requiredQueues.length, details: { expectedQueueCount: expectedQueues.size } },
    { name: 'no_unexpected_queues_paranoid', pass: noUnexpectedQueues, details: { allowed: contract.allowedQueuesParanoid, required: contract.requiredQueues } },
    { name: 'no_unhandled_rejection_boot', pass: unhandledAtBoot.length === 0, details: { unhandledAtBoot } },
    { name: 'event_loop_lag', pass: eventLoopLagMs <= contract.healthThresholds.eventLoopLagMsMax, details: { eventLoopLagMs } },
    { name: 'memory_threshold', pass: memoryRssMb <= contract.healthThresholds.memoryRssMbMax, details: { memoryRssMb } }
  ];
}
