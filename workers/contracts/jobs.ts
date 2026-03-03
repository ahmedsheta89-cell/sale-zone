import { z } from 'zod';

export const JobVersion = z.literal('1.0.0');

export const EmailJobSchema = z.object({
  v: JobVersion,
  jobType: z.literal('email.send'),
  idempotencyKey: z.string().min(8),
  payload: z.object({ to: z.string().email(), subject: z.string().min(1), body: z.string().min(1) })
});

export const WebhookJobSchema = z.object({
  v: JobVersion,
  jobType: z.literal('webhook.deliver'),
  idempotencyKey: z.string().min(8),
  payload: z.object({ url: z.string().url(), body: z.unknown() })
});

export const CleanupJobSchema = z.object({
  v: JobVersion,
  jobType: z.literal('cleanup.run'),
  idempotencyKey: z.string().min(8),
  payload: z.object({ scope: z.enum(['tmp', 'logs', 'orphan']) })
});

export const AnyJobSchema = z.discriminatedUnion('jobType', [EmailJobSchema, WebhookJobSchema, CleanupJobSchema]);
export type AnyJob = z.infer<typeof AnyJobSchema>;
