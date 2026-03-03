import { z } from 'zod';

const Schema = z.object({
  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().optional().transform((v) => String(v ?? 'false').toLowerCase() === 'true'),
  REDIS_URL: z.string().url().optional()
});

export type RedisConfig = z.infer<typeof Schema> & { url: string };

export function loadRedisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig {
  const parsed = Schema.parse(env);
  const auth = parsed.REDIS_PASSWORD ? `:${encodeURIComponent(parsed.REDIS_PASSWORD)}@` : '';
  const proto = parsed.REDIS_TLS ? 'rediss' : 'redis';
  const fallbackUrl = `${proto}://${auth}${parsed.REDIS_HOST}:${parsed.REDIS_PORT}`;
  return { ...parsed, url: parsed.REDIS_URL ?? fallbackUrl };
}
