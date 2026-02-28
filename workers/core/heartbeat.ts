import { connectRedisWithRetry } from '../infra/redis/connection.js';
import { log } from '../observability/logger.js';

export async function startHeartbeat(workerId: string, intervalMs = 30000): Promise<() => Promise<void>> {
  const redis = await connectRedisWithRetry();
  const prefix = process.env.HEARTBEAT_KEY_PREFIX || 'workers:heartbeat';
  const key = `${prefix}:${workerId}`;
  const tick = async () => {
    try {
      await redis.hset(key, { at: new Date().toISOString(), pid: String(process.pid) } as any);
      await redis.expire(key, Math.ceil((intervalMs * 3) / 1000));
    } catch (error) {
      log('warn', 'worker heartbeat failed', { workerId, message: (error as Error).message });
    }
  };
  await tick();
  const timer = setInterval(() => { void tick(); }, intervalMs);
  timer.unref();
  return async () => { clearInterval(timer); await redis.quit(); };
}
