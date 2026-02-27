import { Queue, QueueEvents } from 'bullmq';
import { connectRedisWithRetry } from '../../infra/redis/connection.js';

export async function createQueue(queueName: string): Promise<Queue> {
  const redis = await connectRedisWithRetry();
  return new Queue(queueName, { connection: redis as any, prefix: 'bull' });
}

export async function createQueueEvents(queueName: string): Promise<QueueEvents> {
  const redis = await connectRedisWithRetry();
  const events = new QueueEvents(queueName, { connection: redis as any, prefix: 'bull' });
  await events.waitUntilReady();
  return events;
}
