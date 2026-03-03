import { randomUUID } from 'node:crypto';
export const traceId = (): string => randomUUID();
export async function withSpan<T>(name: string, fn: () => Promise<T>): Promise<T> {
  void name;
  return fn();
}
