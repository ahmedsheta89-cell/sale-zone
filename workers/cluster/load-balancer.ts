import { Queue } from 'bullmq';
import { connectRedisWithRetry } from '../infra/redis/connection.js';

export async function calculateAdaptiveConcurrency(queueName: string, min = 1, max = 32): Promise<number> {
  const redis = await connectRedisWithRetry();
  const queue = new Queue(queueName, { connection: redis as any, prefix: 'bull' });
  const counts = await queue.getJobCounts('waiting', 'active', 'delayed');
  const lag = (counts.waiting ?? 0) + (counts.delayed ?? 0) + (counts.active ?? 0);
  await queue.close();
  await redis.quit();
  return Math.max(min, Math.min(max, Math.ceil(lag / 10) || min));
}
