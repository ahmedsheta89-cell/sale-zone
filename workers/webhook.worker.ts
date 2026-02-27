import { type Job } from 'bullmq';
import { AnyJobSchema } from '../contracts/jobs.js';
import { log } from '../observability/logger.js';
import { emitMetric } from '../observability/metrics.js';
import { createQueueEvents } from './core/queue-factory.js';
import { wireQueueEvents } from './core/events.js';
import { createWorker } from './core/worker-factory.js';
import { startHeartbeat } from './core/heartbeat.js';

export async function bootWebhookWorker(): Promise<void> {
  const queueName = 'prod:webhook';
  const stopHeartbeat = await startHeartbeat(`webhook-${process.pid}`, 30000);
  const events = await createQueueEvents(queueName);
  wireQueueEvents(queueName, events);
  const worker = await createWorker(queueName, async (job: Job) => {
    const parsed = AnyJobSchema.parse(job.data);
    if (parsed.jobType !== 'webhook.deliver') throw new Error('invalid_job_type_for_webhook_worker');
    const started = Date.now();
    await new Promise((r) => setTimeout(r, 20));
    emitMetric('processing_latency_ms', Date.now() - started, { queue: queueName });
    log('info', 'webhook processed', { jobId: job.id });
    return { ok: true };
  }, 10);
  process.on('beforeExit', async () => { await stopHeartbeat(); await events.close(); await worker.close(); });
}
