import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: 'sale-zone-workers',
    env: process.env.NODE_ENV ?? 'production',
    sha: process.env.TARGET_SHA ?? process.env.GITHUB_SHA ?? 'unknown',
    workerGroup: process.env.WORKER_GROUP ?? 'unknown'
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

export function log(level: 'info' | 'warn' | 'error' | 'debug', message: string, data: Record<string, unknown> = {}): void {
  logger[level](data, message);
}
