export type RetryClass = 'transient' | 'permanent' | 'unknown';

export function classifyError(error: unknown): RetryClass {
  const message = String((error as any)?.message ?? '').toLowerCase();
  if (!message) return 'unknown';
  if (message.includes('timeout') || message.includes('econn') || message.includes('rate')) return 'transient';
  if (message.includes('validation') || message.includes('schema') || message.includes('invalid')) return 'permanent';
  return 'unknown';
}

export function retryDelayMs(attempt: number): number {
  const base = Math.min(1000 * 2 ** Math.max(0, attempt - 1), 30000);
  return base + Math.floor(Math.random() * 500);
}
