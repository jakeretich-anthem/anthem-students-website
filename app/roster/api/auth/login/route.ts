import { NextResponse } from "next/server";
import { kvGet, kvPut, trackMetric } from "../../../lib/kv";
import { safeUser, setSessionCookie, SESSION_TTL, type RosterUser } from "../../../lib/auth";
import { generateToken, verifyPassword } from "../../../lib/crypto";

export async function POST(request: Request) {
  const { email, password } = await request.json();
  if (!email || !password) return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const user = await kvGet<RosterUser>(`user:${String(email).toLowerCase()}`);
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }
  if (user.status === "denied") return NextResponse.json({ error: "Your request was denied." }, { status: 403 });
  if (user.role === "pending" || user.status === "pending_approval") {
    return NextResponse.json({ error: "Your account is pending approval." }, { status: 403 });
  }

  const token = generateToken();
  await kvPut(`session:${token}`, { email: user.email, expiresAt: Date.now() + SESSION_TTL * 1000 }, SESSION_TTL);
  await setSessionCookie(token, SESSION_TTL);
  await trackMetric("login");

  return NextResponse.json({ success: true, user: safeUser(user) });
}
