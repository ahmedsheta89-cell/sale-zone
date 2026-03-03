import { randomUUID } from 'node:crypto';
import { connectRedisWithRetry } from '../infra/redis/connection.js';
import { log } from '../observability/logger.js';

export type LeaderLock = {
  isLeader: boolean;
  token: string;
  renew: () => Promise<boolean>;
  release: () => Promise<void>;
};

const RENEW_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('pexpire', KEYS[1], ARGV[2])
end
return 0
`;

const RELEASE_SCRIPT = `
if redis.call('get', KEYS[1]) == ARGV[1] then
  return redis.call('del', KEYS[1])
end
return 0
`;

export async function electLeader(lockKey = 'workers:cluster:leader', ttlSec = 20): Promise<LeaderLock> {
  const redis = await connectRedisWithRetry();
  const token = randomUUID();
  const ttlMs = Math.max(1000, ttlSec * 1000);
  const acquired = await redis.set(lockKey, token, 'NX', 'PX', ttlMs);
  return {
    isLeader: Boolean(acquired),
    token,
    renew: async () => {
      try {
        const result = await redis.eval(RENEW_SCRIPT, 1, lockKey, token, String(ttlMs));
        return Number(result) === 1;
      } catch (error) {
        log('error', 'leader_renew_eval_failed', { lockKey, message: (error as Error).message });
        await redis.lpush(
          'workers:quarantine:cluster',
          JSON.stringify({ type: 'leader_renew_eval_failed', at: new Date().toISOString(), message: (error as Error).message })
        );
        return false;
      }
    },
    release: async () => {
      try {
        await redis.eval(RELEASE_SCRIPT, 1, lockKey, token);
      } catch (error) {
        log('error', 'leader_release_eval_failed', { lockKey, message: (error as Error).message });
      }
      await redis.quit();
    }
  };
}
