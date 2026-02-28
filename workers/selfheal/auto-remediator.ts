import { detectTopologyDrift } from './drift-detector.js';
import { connectRedisWithRetry } from '../infra/redis/connection.js';

export async function autoRemediate(): Promise<{ remediated: boolean; actions: string[] }> {
  const actions: string[] = [];
  const drift = await detectTopologyDrift();
  if (!drift.drift) return { remediated: false, actions };

  const redis = await connectRedisWithRetry();
  await redis.publish('workers:signals', JSON.stringify({ type: 'restart_required', reasons: drift.reasons, at: new Date().toISOString() }));
  await redis.lpush('workers:quarantine:drift', JSON.stringify({ reasons: drift.reasons, at: new Date().toISOString() }));
  await redis.quit();

  actions.push('published_restart_signal', 'drift_quarantined');
  return { remediated: true, actions };
}
