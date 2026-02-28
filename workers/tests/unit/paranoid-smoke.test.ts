import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadRedisConfig } from '../../infra/redis/redis.config.js';
import { getWatchdogSettings } from '../../watchdog/paranoid-monitor.js';

describe('paranoid smoke checks', () => {
  it('enforces fail-closed redis in production by default', () => {
    expect(() =>
      loadRedisConfig({
        NODE_ENV: 'production',
        REDIS_HOST: '127.0.0.1',
        REDIS_PORT: '6379'
      } as NodeJS.ProcessEnv)
    ).toThrow(/missing_redis_url_fail_closed/i);
  });

  it('watchdog defaults to 15m interval and 45m silence budget', () => {
    const previousInterval = process.env.WATCHDOG_INTERVAL_MS;
    const previousSilence = process.env.WATCHDOG_MAX_SILENCE_MS;
    delete process.env.WATCHDOG_INTERVAL_MS;
    delete process.env.WATCHDOG_MAX_SILENCE_MS;
    const cfg = getWatchdogSettings();
    expect(cfg.intervalMs).toBe(900000);
    expect(cfg.maxSilenceMs).toBe(2700000);
    if (previousInterval !== undefined) process.env.WATCHDOG_INTERVAL_MS = previousInterval;
    if (previousSilence !== undefined) process.env.WATCHDOG_MAX_SILENCE_MS = previousSilence;
  });

  it('bootstrap wires stall guard and watchdog daemon', () => {
    const source = fs.readFileSync(path.resolve(process.cwd(), 'bootstrap.ts'), 'utf8');
    expect(source).toMatch(/createStallGuard/);
    expect(source).toMatch(/startParanoidWatchdogDaemon/);
  });
});
