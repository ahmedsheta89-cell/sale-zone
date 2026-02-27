import * as BullMQ from 'bullmq';
import { connectRedisWithRetry } from '../../infra/redis/connection.js';

export async function createStallGuard(queueName: string): Promise<{ close: () => Promise<void> } | null> {
  const AnyBull = BullMQ as any;
  const SchedulerCtor = AnyBull.QueueScheduler ?? AnyBull.JobScheduler ?? null;
  if (!SchedulerCtor) return null;
  const redis = await connectRedisWithRetry();
  const scheduler = new SchedulerCtor(queueName, { connection: redis, prefix: 'bull' });
  if (typeof scheduler.waitUntilReady === 'function') await scheduler.waitUntilReady();
  return {
    close: async () => {
      if (typeof scheduler.close === 'function') await scheduler.close();
      await redis.quit();
    }
  };
}
