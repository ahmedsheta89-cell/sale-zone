import { checkRedisHealth } from '../infra/redis/healthcheck.js';
import { clusterHealthProbe } from '../cluster/health-probe.js';
import { autoRemediate } from '../selfheal/auto-remediator.js';
import { connectRedisWithRetry } from '../infra/redis/connection.js';
import { emitMetric } from '../observability/metrics.js';
import { log } from '../observability/logger.js';

function classifySeverity(reasons: string[]): 'low' | 'medium' | 'high' {
  if (reasons.some((r) => r.includes('redis') || r.includes('no_active_nodes'))) return 'high';
  if (reasons.length > 1) return 'medium';
  return 'low';
}

export function getWatchdogSettings(): { intervalMs: number; maxSilenceMs: number; key: string } {
  const intervalMs = Math.max(60_000, Number(process.env.WATCHDOG_INTERVAL_MS ?? 900_000));
  const maxSilenceMs = Math.max(intervalMs * 2, Number(process.env.WATCHDOG_MAX_SILENCE_MS ?? 2_700_000));
  const key = `${process.env.ROLL_OUT_KEY_PREFIX || 'workers:watchdog'}:heartbeat`;
  return { intervalMs, maxSilenceMs, key };
}

async function updateDeadManHeartbeat(): Promise<void> {
  const cfg = getWatchdogSettings();
  const redis = await connectRedisWithRetry();
  try {
    const current = await redis.get(cfg.key);
    if (current) {
      const lastAt = Date.parse(current);
      const silenceMs = Number.isFinite(lastAt) ? Date.now() - lastAt : 0;
      emitMetric('watchdog_silence_age_ms', silenceMs);
      if (silenceMs > cfg.maxSilenceMs) {
        log('error', 'watchdog_silence_breach', { silenceMs, maxSilenceMs: cfg.maxSilenceMs });
        await redis.publish('workers:signals', JSON.stringify({ type: 'watchdog_restart_required', silenceMs, at: new Date().toISOString() }));
      }
    }
    await redis.set(cfg.key, new Date().toISOString(), 'EX', Math.ceil(cfg.maxSilenceMs / 1000));
  } finally {
    await redis.quit();
  }
}

export async function runParanoidMonitorOnce(): Promise<void> {
  await updateDeadManHeartbeat();
  const redis = await checkRedisHealth();
  const cluster = await clusterHealthProbe();
  const reasons = [...(redis.ok ? [] : ['redis_health_failed']), ...cluster.reasons];

  emitMetric('redis_rtt_ms', redis.rttMs);
  emitMetric('worker_health', cluster.ok ? 1 : 0);

  if (reasons.length > 0) {
    const severity = classifySeverity(reasons);
    const remediation = await autoRemediate();
    log('warn', 'watchdog anomaly', { reasons, severity, remediation });
    return;
  }

  log('info', 'watchdog healthy', { nodes: cluster.nodes, redisRttMs: redis.rttMs });
}

export function startParanoidWatchdogDaemon(): () => void {
  const { intervalMs } = getWatchdogSettings();
  void runParanoidMonitorOnce();
  const timer = setInterval(() => {
    void runParanoidMonitorOnce();
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}

if (process.argv.includes('--daemon')) {
  startParanoidWatchdogDaemon();
}
