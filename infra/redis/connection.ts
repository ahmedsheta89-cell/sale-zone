import IORedis from 'ioredis';
import { loadRedisConfig } from './redis.config.js';

export type RedisClient = ReturnType<typeof createRedisClient>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function createRedisClient() {
  const cfg = loadRedisConfig();
  return new IORedis(cfg.url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableReadyCheck: true,
    connectTimeout: 10000,
    tls: cfg.REDIS_TLS ? {} : undefined
  } as any);
}

export async function connectRedisWithRetry(maxAttempts = 8): Promise<RedisClient> {
  const client = createRedisClient();
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.connect();
      return client;
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      const backoff = Math.min(1200 * 2 ** (attempt - 1), 15000) + Math.floor(Math.random() * 500);
      await sleep(backoff);
    }
  }
  throw new Error('redis_retry_exhausted');
}
