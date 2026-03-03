import { Queue } from 'bullmq';
import { classifyError } from '../contracts/retry-policy.js';
import { connectRedisWithRetry } from '../infra/redis/connection.js';

export async function orchestrateRetry(queueName: string, jobId: string, error: unknown): Promise<'retried' | 'quarantined' | 'dropped'> {
  const redis = await connectRedisWithRetry();
  const queue = new Queue(queueName, { connection: redis as any, prefix: 'bull' });
  const job = await queue.getJob(jobId);
  if (!job) {
    await queue.close();
    await redis.quit();
    return 'dropped';
  }

  const klass = classifyError(error);
  if (klass === 'transient') {
    await job.retry();
    await queue.close();
    await redis.quit();
    return 'retried';
  }

  await redis.lpush('workers:quarantine:jobs', JSON.stringify({ queueName, jobId, reason: klass, at: new Date().toISOString() }));
  await queue.close();
  await redis.quit();
  return 'quarantined';
}
