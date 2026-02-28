import { z } from 'zod';

const Schema = z.object({
  NODE_ENV: z.string().optional(),
  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().max(65535).default(6379),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_TLS: z.string().optional().transform((v) => String(v ?? 'false').toLowerCase() === 'true'),
  REDIS_URL: z.string().url().optional(),
  REDIS_FAIL_CLOSED: z.string().optional(),
  REDIS_REQUIRE_TLS: z.string().optional()
});

export type RedisConfig = z.infer<typeof Schema> & {
  url: string;
  failClosed: boolean;
  requireTls: boolean;
  isProdLike: boolean;
};

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  const value = String(raw).trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

export function loadRedisConfig(env: NodeJS.ProcessEnv = process.env): RedisConfig {
  const parsed = Schema.parse(env);
  const nodeEnv = String(parsed.NODE_ENV ?? '').toLowerCase();
  const isProdLike = nodeEnv === 'production' || nodeEnv === 'staging';
  const failClosed = parseBoolean(parsed.REDIS_FAIL_CLOSED, isProdLike);
  const requireTls = parseBoolean(parsed.REDIS_REQUIRE_TLS, isProdLike);

  if (failClosed && !parsed.REDIS_URL) {
    throw new Error('redis_config_invalid_missing_redis_url_fail_closed');
  }

  const auth = parsed.REDIS_PASSWORD ? `:${encodeURIComponent(parsed.REDIS_PASSWORD)}@` : '';
  const proto = parsed.REDIS_TLS ? 'rediss' : 'redis';
  const fallbackUrl = `${proto}://${auth}${parsed.REDIS_HOST}:${parsed.REDIS_PORT}`;
  const resolvedUrl = parsed.REDIS_URL ?? fallbackUrl;
  const parsedUrl = new URL(resolvedUrl);

  if (requireTls && parsedUrl.protocol !== 'rediss:') {
    throw new Error('redis_config_invalid_tls_required');
  }
  if (requireTls && parsed.REDIS_TLS === false && !parsed.REDIS_URL?.startsWith('rediss://')) {
    throw new Error('redis_config_invalid_redis_tls_disabled_in_secure_mode');
  }

  return { ...parsed, url: resolvedUrl, failClosed, requireTls, isProdLike };
}
