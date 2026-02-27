import { connectRedisWithRetry } from '../../infra/redis/connection.js';

export type NodeState = {
  workerId: string;
  queues: string[];
  updatedAt: string;
  status: 'ready' | 'degraded' | 'draining';
};

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
  const keys = await redis.keys('workers:cluster:nodes:*');
  const result: NodeState[] = [];
  for (const key of keys) {
    const raw = await redis.hgetall(key);
    result.push({
      workerId: raw.workerId ?? 'unknown',
      queues: raw.queues ? JSON.parse(raw.queues) : [],
      updatedAt: raw.updatedAt ?? new Date(0).toISOString(),
      status: (raw.status as NodeState['status']) ?? 'degraded'
    });
  }
  await redis.quit();
  return result;
}
