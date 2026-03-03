import { performance } from 'node:perf_hooks';
import { connectRedisWithRetry } from './connection.js';

export type RedisHealth = { ok: boolean; at: string; rttMs: number; message?: string };

export async function checkRedisHealth(timeoutMs = 5000): Promise<RedisHealth> {
  const started = performance.now();
  const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis_timeout')), timeoutMs));
  const run = (async () => {
    const client = await connectRedisWithRetry();
    const pong = await client.ping();
    await client.quit();
    if (pong !== 'PONG') throw new Error(`invalid_pong:${pong}`);
  })();

  try {
    await Promise.race([run, timeout]);
    return { ok: true, at: new Date().toISOString(), rttMs: performance.now() - started };
  } catch (error) {
    return { ok: false, at: new Date().toISOString(), rttMs: performance.now() - started, message: (error as Error).message };
  }
}
