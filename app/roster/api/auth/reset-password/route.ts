import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvPut } from "../../../lib/kv";
import type { RosterUser } from "../../../lib/auth";
import { hashPassword, hashToken, validatePasswordStrength } from "../../../lib/crypto";

export async function POST(request: Request) {
  const { token, newPassword, confirmPassword } = await request.json();
  if (!token || !newPassword || newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!validatePasswordStrength(newPassword)) return NextResponse.json({ error: "Weak password" }, { status: 400 });

  const tokenHash = await hashToken(token);
  const rec = await kvGet<{ email?: string }>(`pwdreset:${tokenHash}`);
  if (!rec?.email) return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });

  const user = await kvGet<RosterUser>(`user:${rec.email}`);
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await kvPut(`user:${user.email}`, user);
  await kvDelete(`pwdreset:${tokenHash}`);

  return NextResponse.json({ success: true });
}
