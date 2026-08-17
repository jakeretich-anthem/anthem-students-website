import { NextResponse } from "next/server";
import { kvPut } from "../../../../lib/kv";
import { requireAdmin } from "../../../../lib/auth";
import { generateToken, hashToken } from "../../../../lib/crypto";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const actor = admin.user;

  const { role = "leader", expiresHours = 48 } = await request.json().catch(() => ({}));
  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  const ttl = Math.max(24, Math.min(72, Number(expiresHours) || 48)) * 3600;
  await kvPut(`invite:${tokenHash}`, { type: "qr", role, status: "active", createdBy: actor.email, createdAt: Date.now() }, ttl);

  return NextResponse.json({
    success: true,
    inviteLink: `${new URL(request.url).origin}/roster?inviteToken=${raw}`,
    expiresHours: ttl / 3600,
  });
}
