import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import type { RosterUser } from "../../../lib/auth";
import { generateToken, hashToken } from "../../../lib/crypto";
import { sendEmail } from "../../../lib/email";

const RESET_TTL = 30 * 60;

export async function POST(request: Request) {
  const { email } = await request.json();
  const generic = { success: true, message: "If that account exists, a reset link has been sent." };
  if (!email) return NextResponse.json(generic);

  const user = await kvGet<RosterUser>(`user:${String(email).toLowerCase()}`);
  if (!user) return NextResponse.json(generic);

  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  await kvPut(`pwdreset:${tokenHash}`, { email: user.email, createdAt: Date.now() }, RESET_TTL);

  const origin = new URL(request.url).origin;
  await sendEmail({
    to: user.email!,
    subject: "Reset your ASM Roster password",
    html: `<p>Use this secure link to reset your password (expires in 30 minutes):</p><p><a href="${origin}/roster?resetToken=${raw}">Reset Password</a></p>`,
  });

  return NextResponse.json(generic);
}
