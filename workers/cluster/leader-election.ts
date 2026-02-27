import { randomUUID } from 'node:crypto';
import { connectRedisWithRetry } from '../../infra/redis/connection.js';

export type LeaderLock = {
  isLeader: boolean;
  token: string;
  renew: () => Promise<boolean>;
  release: () => Promise<void>;
};

export async function electLeader(lockKey = 'workers:cluster:leader', ttlSec = 20): Promise<LeaderLock> {
  const redis = await connectRedisWithRetry();
  const token = randomUUID();
  const acquired = await redis.set(lockKey, token, 'NX', 'EX', ttlSec);
  return {
    isLeader: Boolean(acquired),
    token,
    renew: async () => {
      const current = await redis.get(lockKey);
      if (current !== token) return false;
      await redis.expire(lockKey, ttlSec);
      return true;
    },
    release: async () => {
      const current = await redis.get(lockKey);
      if (current === token) await redis.del(lockKey);
      await redis.quit();
    }
  };
}
