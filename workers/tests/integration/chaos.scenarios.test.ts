import { describe, expect, it } from 'vitest';
import { classifyError } from '../../contracts/retry-policy.js';
import { loadRedisConfig } from '../../infra/redis/redis.config.js';
import { withTimeout } from '../../core/runtime-handle.js';

describe('chaos scenario baselines', () => {
  it('classifies redis partial failure as transient', () => {
    expect(classifyError(new Error('ECONNRESET during redis command'))).toBe('transient');
  });

  it('classifies malformed payload errors as permanent', () => {
    expect(classifyError(new Error('validation failed: invalid schema'))).toBe('permanent');
  });

  it('fails closed when TLS is required and URL is non-TLS', () => {
    expect(() =>
      loadRedisConfig({
        NODE_ENV: 'production',
        REDIS_URL: 'redis://127.0.0.1:6379',
        REDIS_REQUIRE_TLS: 'true',
        REDIS_FAIL_CLOSED: 'true'
      } as NodeJS.ProcessEnv)
    ).toThrow(/tls_required/i);
  });

  it('enforces shutdown timeout guard under memory/loop pressure simulation', async () => {
    await expect(
      withTimeout(
        'chaos_shutdown_guard',
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        10
      )
    ).rejects.toThrow(/timeout/i);
  });
});
