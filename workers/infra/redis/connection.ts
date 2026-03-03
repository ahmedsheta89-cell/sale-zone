import IORedis from 'ioredis';
import { loadRedisConfig } from './redis.config.js';

export type RedisClient = ReturnType<typeof createRedisClient>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createRedisClient() {
  const cfg = loadRedisConfig();
  const usingTls = new URL(cfg.url).protocol === 'rediss:';
  const RedisCtor = IORedis as unknown as { new (...args: any[]): any };
  return new RedisCtor(cfg.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    autoResubscribe: false,
    enableReadyCheck: true,
    connectTimeout: 10000,
    tls: usingTls || cfg.REDIS_TLS ? {} : undefined
  } as any);
}

export async function connectRedisWithRetry(maxAttempts = 5): Promise<RedisClient> {
  const client = createRedisClient();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.connect();
      return client;
    } catch (error) {
      if (attempt === maxAttempts) {
        client.disconnect();
        throw error;
      }
      const backoff = Math.min(800 * 2 ** (attempt - 1), 12000) + Math.floor(Math.random() * 250);
      await sleep(backoff);
    }
  }
  throw new Error('redis_retry_exhausted');
}
