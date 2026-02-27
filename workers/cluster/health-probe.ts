import { checkRedisHealth } from '../../infra/redis/healthcheck.js';
import { listNodeStates } from './node-registry.js';

export async function clusterHealthProbe(): Promise<{ ok: boolean; reasons: string[]; nodes: number; redisRttMs: number }> {
  const reasons: string[] = [];
  const redis = await checkRedisHealth();
  if (!redis.ok) reasons.push('redis_unhealthy');
  const nodes = await listNodeStates();
  if (nodes.length === 0) reasons.push('no_active_nodes');
  if (nodes.some((n) => Date.now() - Date.parse(n.updatedAt) > 120000)) reasons.push('stale_nodes_detected');
  return { ok: reasons.length === 0, reasons, nodes: nodes.length, redisRttMs: redis.rttMs };
}
