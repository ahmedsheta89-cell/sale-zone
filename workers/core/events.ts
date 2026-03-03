import { QueueEvents } from 'bullmq';
import { emitMetric } from '../observability/metrics.js';
import { log } from '../observability/logger.js';

export function wireQueueEvents(queueName: string, events: QueueEvents): void {
  events.on('completed', ({ jobId }) => {
    emitMetric('job_completed', 1, { queue: queueName });
    log('info', 'job completed', { queue: queueName, jobId });
  });
  events.on('failed', ({ jobId, failedReason }) => {
    emitMetric('job_failed', 1, { queue: queueName });
    log('warn', 'job failed', { queue: queueName, jobId, failedReason });
  });
  events.on('stalled', ({ jobId }) => {
    emitMetric('job_stalled', 1, { queue: queueName });
    log('warn', 'job stalled', { queue: queueName, jobId });
  });
}
