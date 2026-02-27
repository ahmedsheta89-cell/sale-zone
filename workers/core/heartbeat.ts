import { connectRedisWithRetry } from '../../infra/redis/connection.js';

export async function startHeartbeat(workerId: string, intervalMs = 30000): Promise<() => Promise<void>> {
  const redis = await connectRedisWithRetry();
  const key = `workers:heartbeat:${workerId}`;
  const tick = async () => {
    await redis.hset(key, { at: new Date().toISOString(), pid: String(process.pid) } as any);
    await redis.expire(key, Math.ceil((intervalMs * 3) / 1000));
  };
  await tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref();
  return async () => { clearInterval(timer); await redis.quit(); };
}
