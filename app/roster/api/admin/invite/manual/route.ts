import { NextResponse } from "next/server";
import { kvPut } from "../../../../lib/kv";
import { requireAdmin } from "../../../../lib/auth";
import { generateToken, hashPassword, hashToken } from "../../../../lib/crypto";
import { sendEmail } from "../../../../lib/email";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const actor = admin.user;

  const { name, email, role = "leader" } = await request.json();
  if (!name || !email) return NextResponse.json({ error: "Name and email required" }, { status: 400 });

  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  await kvPut(
    `onboard:${tokenHash}`,
    { email: String(email).toLowerCase(), role, createdBy: actor.email, createdAt: Date.now() },
    72 * 3600
  );

  const lower = String(email).toLowerCase();
  const user = {
    email: lower,
    name,
    role,
    status: "approved",
    mustChangePassword: true,
    passwordHash: await hashPassword(generateToken().slice(0, 14)),
    createdAt: new Date().toISOString(),
  };
  await kvPut(`user:${lower}`, user);

  await sendEmail({
    to: user.email,
    subject: "Welcome! Set Up Your Account",
    html: `<p>Welcome! Use this secure onboarding link to set your password:</p><p><a href="${new URL(request.url).origin}/roster?onboardToken=${raw}">Set Up Your Account</a></p>`,
  });

  return NextResponse.json({ success: true });
}
