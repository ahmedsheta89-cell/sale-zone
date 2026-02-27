import { Worker, type Job } from 'bullmq';
import { connectRedisWithRetry } from '../../infra/redis/connection.js';
import { classifyError, retryDelayMs } from '../../contracts/retry-policy.js';
import { log } from '../../observability/logger.js';

async function withIdempotency(job: Job, fn: () => Promise<unknown>): Promise<unknown> {
  const key = String((job.data as any)?.idempotencyKey ?? `${job.queueName}:${job.id}`);
  const redis = await connectRedisWithRetry();
  const acquired = await redis.set(`workers:idempotency:${key}`, '1', 'NX', 'EX', 3600);
  if (!acquired) {
    await redis.quit();
    return { skipped: true, reason: 'idempotent_duplicate' };
  }
  try {
    return await fn();
  } finally {
    await redis.quit();
  }
}

export async function createWorker(queueName: string, handler: (job: Job) => Promise<unknown>, concurrency = 5): Promise<Worker> {
  const redis = await connectRedisWithRetry();
  const worker = new Worker(queueName, async (job) => withIdempotency(job, () => handler(job)), {
    connection: redis as any,
    concurrency,
    lockDuration: 30000,
    stalledInterval: 10000,
    settings: {
      backoffStrategy(attemptsMade: number) {
        return retryDelayMs(attemptsMade);
      }
    }
  });

  worker.on('error', (error) => {
    log('error', 'worker error', { queueName, classification: classifyError(error), message: (error as Error).message });
  });

  await worker.waitUntilReady();
  process.on('SIGTERM', () => { void worker.close(); });
  process.on('SIGINT', () => { void worker.close(); });
  return worker;
}
