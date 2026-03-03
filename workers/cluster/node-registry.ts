import { connectRedisWithRetry } from '../infra/redis/connection.js';
import { emitMetric } from '../observability/metrics.js';
import { log } from '../observability/logger.js';

export type NodeState = {
  workerId: string;
  queues: string[];
  updatedAt: string;
  status: 'ready' | 'degraded' | 'draining';
};

function readScanConfig(): { count: number; maxLoops: number; timeBudgetMs: number } {
  const count = Math.max(10, Number(process.env.SCAN_COUNT ?? 100));
  const maxLoops = Math.max(1, Number(process.env.SCAN_MAX_LOOPS ?? 1000));
  const timeBudgetMs = Math.max(250, Number(process.env.SCAN_TIME_BUDGET_MS ?? 2000));
  return { count, maxLoops, timeBudgetMs };
}

async function scanKeys(redis: any, pattern: string): Promise<string[]> {
  const cfg = readScanConfig();
  const started = Date.now();
  let cursor = '0';
  let loops = 0;
  const keys: string[] = [];

  do {
    const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', cfg.count);
    cursor = String(result?.[0] ?? '0');
    const batch = Array.isArray(result?.[1]) ? result[1] : [];
    keys.push(...batch);
    loops += 1;
    if (Date.now() - started > cfg.timeBudgetMs || loops >= cfg.maxLoops) {
      emitMetric('cluster_scan_budget_exhausted', 1, { pattern });
      log('warn', 'cluster scan budget exhausted', { pattern, loops, elapsedMs: Date.now() - started, cursor });
      break;
    }
  } while (cursor !== '0');

  emitMetric('cluster_scan_loops', loops, { pattern });
  emitMetric('cluster_scan_elapsed_ms', Date.now() - started, { pattern });
  return [...new Set(keys)];
}

export async function upsertNodeState(state: NodeState): Promise<void> {
  const redis = await connectRedisWithRetry();
  const key = `workers:cluster:nodes:${state.workerId}`;
  await redis.hset(key, {
    workerId: state.workerId,
    queues: JSON.stringify(state.queues),
    updatedAt: state.updatedAt,
    status: state.status
  } as any);
  await redis.expire(key, 120);
  await redis.quit();
}

export async function listNodeStates(): Promise<NodeState[]> {
  const redis = await connectRedisWithRetry();
  const keys = await scanKeys(redis, 'workers:cluster:nodes:*');
  const result: NodeState[] = [];
  for (const key of keys) {
    const raw = await redis.hgetall(key);
    result.push({
      workerId: raw.workerId ?? 'unknown',
      queues: (() => {
        try {
          return raw.queues ? JSON.parse(raw.queues) : [];
        } catch {
          return [];
        }
      })(),
      updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
      status: (raw.status as NodeState['status']) ?? 'degraded'
    });
  }
  await redis.quit();
  return result;
}

export async function startNodeRegistryHeartbeat(
  workerId: string,
  queues: string[],
  intervalMs = 30000
): Promise<() => Promise<void>> {
  const tick = async () => {
    await upsertNodeState({
      workerId,
      queues,
      updatedAt: new Date().toISOString(),
      status: 'ready'
    });
  };
  await tick();
  const timer = setInterval(() => {
    void tick();
  }, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    await upsertNodeState({
      workerId,
      queues,
      updatedAt: new Date().toISOString(),
      status: 'draining'
    });
  };
}
