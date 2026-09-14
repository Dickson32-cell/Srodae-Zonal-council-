// Simple in-memory login rate limiter — brute-force protection.
// Per username+IP: 5 attempts / 15 min window, then locked for 15 min.
// (Single-instance deployments like ours; resets on server restart,
//  which also clears attacker locks — acceptable for a staff tool.)
type Attempt = { count: number; firstAt: number; lockedUntil: number };

const attempts = new Map<string, Attempt>();
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

export function loginRateCheck(key: string): { ok: boolean; retryInMin?: number } {
  const now = Date.now();
  const rec = attempts.get(key);

  if (rec && rec.lockedUntil > now) {
    return { ok: false, retryInMin: Math.ceil((rec.lockedUntil - now) / 60000) };
  }

  if (!rec || now - rec.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
    return { ok: true };
  }

  rec.count += 1;
  if (rec.count > MAX_ATTEMPTS) {
    rec.lockedUntil = now + WINDOW_MS;
    return { ok: false, retryInMin: 15 };
  }
  return { ok: true };
}

export function loginRateClear(key: string) {
  attempts.delete(key);
}