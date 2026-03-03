import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkRedisHealth } from '../../infra/redis/healthcheck.js';

function withEnv(patch: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  const snapshot = { ...process.env };
  Object.assign(process.env, patch);
  return fn().finally(() => {
    process.env = snapshot;
  });
}

describe('preflight redis disconnect', () => {
  it('fails health check when redis endpoint is unreachable', async () => {
    await withEnv(
      {
        REDIS_URL: 'redis://127.0.0.1:6399',
        REDIS_TLS: 'false',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6399'
      },
      async () => {
        const health = await checkRedisHealth(800);
        expect(health.ok).toBe(false);
      }
    );
  });
});
