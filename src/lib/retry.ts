// Retry helper for Neon/serverless transient errors under concurrent load.
// Neon compute nodes suspend; the first connection in a burst can hit
// P1001 (can't reach database) / P2033 (connection closed) / timeouts.
// These are RETRYABLE — the write never happened — so we retry with
// short backoff instead of failing the staff member's entry.
import { Prisma } from "@prisma/client";

const RETRYABLE = [
  "P1001", // can't reach database server
  "P2033", // connection number not available (pool exhaustion)
  "P2034", // transaction conflict (serializable)
  "P2024", // timeout acquiring connection from pool
];

export function isRetryable(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError &&
    RETRYABLE.includes(e.code)
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 4,
  baseDelayMs = 120
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (i === attempts - 1 || !isRetryable(e)) break;
      const delay = baseDelayMs * Math.pow(2, i) + Math.random() * 80;
      console.warn(`[retry] ${label} attempt ${i + 1} failed (${(e as Error).message?.slice(0, 60)}…), retrying in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}