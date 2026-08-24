import { kvGet, kvPut } from "./kv";

// A fixed-window counter on top of roster_kv. `timingSafeEqual` in crypto.ts
// stops an attacker learning a passcode one byte at a time, but nothing stopped
// them simply guessing quickly — these are the guards on the guess rate.
//
// The read-modify-write isn't atomic, so a burst of simultaneous requests can
// undercount by a few. That's fine for the threat here (a person or a script
// hammering a login form); it is not a quota system.

export type RateLimitResult = {
  ok: boolean;
  retryAfter: number; // seconds until the window resets
};

type Window = { count: number; resetAt: number };

export async function checkRateLimit(
  action: string,
  key: string,
  max: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const kvKey = `ratelimit:${action}:${key}`;
  const now = Date.now();

  let win: Window | null = null;
  try {
    win = await kvGet<Window>(kvKey);
  } catch {
    // KV is down — fail open rather than locking everyone out of the app.
    return { ok: true, retryAfter: 0 };
  }

  if (!win || now > win.resetAt) {
    win = { count: 0, resetAt: now + windowSeconds * 1000 };
  }

  win.count++;
  const retryAfter = Math.max(1, Math.ceil((win.resetAt - now) / 1000));

  try {
    await kvPut(kvKey, win, Math.ceil((win.resetAt - now) / 1000));
  } catch {
    return { ok: true, retryAfter: 0 };
  }

  return { ok: win.count <= max, retryAfter };
}

// Clear the counter after a success, so one bad day of typos doesn't leave a
// leader locked out once they finally get it right.
export async function clearRateLimit(action: string, key: string): Promise<void> {
  try {
    await kvPut(`ratelimit:${action}:${key}`, { count: 0, resetAt: Date.now() }, 1);
  } catch {
    // best effort
  }
}

// Null when the caller's address can't be determined — there is no proxy header
// and the socket address isn't visible from here. Callers must skip the per-IP
// limit in that case rather than bucketing everyone under one key: a shared
// bucket means ten failed logins anywhere lock out every user of the site.
// The per-account limit still stands, which is the one that protects passwords.
export function clientKey(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip") || null;
}

export function tooManyRequests(message: string, retryAfter: number) {
  return Response.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}
