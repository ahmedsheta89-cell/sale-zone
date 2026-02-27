import { checkRedisHealth } from '../../infra/redis/healthcheck.js';
import { clusterHealthProbe } from '../cluster/health-probe.js';
import { autoRemediate } from '../selfheal/auto-remediator.js';
import { emitMetric } from '../../observability/metrics.js';
import { log } from '../../observability/logger.js';

function classifySeverity(reasons: string[]): 'low' | 'medium' | 'high' {
  if (reasons.some((r) => r.includes('redis') || r.includes('no_active_nodes'))) return 'high';
  if (reasons.length > 1) return 'medium';
  return 'low';
}

export async function runParanoidMonitorOnce(): Promise<void> {
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

if (process.argv.includes('--daemon')) {
  void runParanoidMonitorOnce();
  const timer = setInterval(() => {
    void runParanoidMonitorOnce();
  }, 30 * 60 * 1000);
  timer.unref();
}
