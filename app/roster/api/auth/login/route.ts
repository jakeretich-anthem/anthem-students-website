import { NextResponse } from "next/server";
import { kvGet, kvPut, trackMetric } from "../../../lib/kv";
import { safeUser, setSessionCookie, SESSION_TTL, type RosterUser } from "../../../lib/auth";
import { generateToken, verifyPassword } from "../../../lib/crypto";
import { checkRateLimit, clearRateLimit, clientKey, tooManyRequests } from "../../../lib/rateLimit";

const WINDOW = 15 * 60;
// Per account: tight, because this is what actually protects a password.
const MAX_PER_ACCOUNT = 10;
// Per source: deliberately loose. A youth team on one church wifi shares a
// single public IP, so a tight limit here locks out everyone the moment a few
// people fumble their passwords. This is only meant to stop one address
// spraying attempts across many different accounts.
const MAX_PER_IP = 50;

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const lower = String(email).trim().toLowerCase();
  const ip = clientKey(request);

  // Limit per account and per source. The first stops one account being ground
  // down from many addresses; the second stops one address spraying accounts.
  // When the address is unknown the per-IP limit is skipped rather than shared.
  const keys: [string, number][] = [[`email:${lower}`, MAX_PER_ACCOUNT]];
  if (ip) keys.push([`ip:${ip}`, MAX_PER_IP]);

  for (const [key, max] of keys) {
    const limit = await checkRateLimit("login", key, max, WINDOW);
    if (!limit.ok) {
      return tooManyRequests(
        `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
        limit.retryAfter
      );
    }
  }

  const user = await kvGet<RosterUser>(`user:${lower}`);
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status === "denied") return NextResponse.json({ error: "Your request was denied." }, { status: 403 });
  if (user.role === "pending" || user.status === "pending_approval") {
    // `reason` lets the client style this as information rather than a failure —
    // the password was right, the account just isn't approved yet.
    return NextResponse.json(
      { error: "Your account is still waiting for approval. You'll get an email once it's approved.", reason: "pending" },
      { status: 403 }
    );
  }

  const token = generateToken();
  await kvPut(`session:${token}`, { email: user.email, expiresAt: Date.now() + SESSION_TTL * 1000 }, SESSION_TTL);
  await setSessionCookie(token, SESSION_TTL);
  await trackMetric("login");
  await Promise.all(keys.map(([key]) => clearRateLimit("login", key)));

  return NextResponse.json({ success: true, user: safeUser(user) });
}
