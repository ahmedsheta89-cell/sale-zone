import { z } from 'zod';

export const WorkerEventSchema = z.object({
  v: z.literal('1.0.0'),
  event: z.enum(['heartbeat', 'stalled', 'retry', 'failed', 'completed', 'quarantined']),
  workerId: z.string().min(1),
  queue: z.string().min(1),
  at: z.string().datetime(),
  metadata: z.record(z.any()).optional()
});

export type WorkerEvent = z.infer<typeof WorkerEventSchema>;
