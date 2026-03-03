import { loadQueueContract } from './queueContracts.js';
import { validateRuntime } from './runtimeValidators.js';
import { clusterHealthProbe } from '../../cluster/health-probe.js';

export type ReadinessReport = {
  pass: boolean;
  reasons: string[];
  redisRttMs: number;
  checks: Array<{ name: string; pass: boolean }>;
};

export async function checkWorkerReadiness(contractPath: string, repoRoot: string): Promise<ReadinessReport> {
  const contract = loadQueueContract(contractPath);
  const runtimeChecks = await validateRuntime(contractPath, repoRoot);
  const cluster = await clusterHealthProbe();
  const checks = runtimeChecks.map((check) => ({ name: check.name, pass: check.pass }));
  const reasons: string[] = [];

  for (const check of runtimeChecks) {
    if (!check.pass) reasons.push(`runtime:${check.name}`);
  }
  if (!cluster.ok) reasons.push(...cluster.reasons.map((reason) => `cluster:${reason}`));
  if (cluster.redisRttMs > contract.healthThresholds.redisRttMsMax) {
    reasons.push(`cluster:redis_rtt_above_threshold:${cluster.redisRttMs}`);
  }

  return {
    pass: reasons.length === 0,
    reasons,
    redisRttMs: cluster.redisRttMs,
    checks
  };
}
