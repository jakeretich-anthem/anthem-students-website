import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../../lib/kv";
import { hashPassword, hashToken } from "../../../../lib/crypto";

// Deliberately not behind requireAdmin — this is how a brand-new leader
// redeems an invite link before they have an account at all, matching the
// original app's routing (checked before the admin gate).
export async function POST(request: Request) {
  const { token, name, password } = await request.json();
  if (!token || !name || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const tokenHash = await hashToken(token);
  const invite = await kvGet<{ status: string; role?: string }>(`invite:${tokenHash}`);
  if (!invite || invite.status !== "active") return NextResponse.json({ error: "Invite invalid or expired" }, { status: 400 });

  await kvPut(`invite:${tokenHash}`, { ...invite, status: "used", usedAt: Date.now() }, 60);

  const email = `invited-${Date.now()}@placeholder.local`;
  const user = {
    email,
    name,
    role: invite.role || "leader",
    status: "approved",
    mustChangePassword: false,
    passwordHash: await hashPassword(password),
    createdAt: new Date().toISOString(),
  };
  await kvPut(`user:${email}`, user);

  return NextResponse.json({ success: true });
}
