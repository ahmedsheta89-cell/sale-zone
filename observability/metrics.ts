export type MetricPoint = { name: string; value: number; tags: Record<string, string>; at: string };
const metrics: MetricPoint[] = [];

export function emitMetric(name: string, value: number, tags: Record<string, string> = {}): void {
  metrics.push({ name, value, tags, at: new Date().toISOString() });
  if (metrics.length > 5000) metrics.splice(0, metrics.length - 5000);
}

export function getMetricsSnapshot(): MetricPoint[] {
  return [...metrics];
}
