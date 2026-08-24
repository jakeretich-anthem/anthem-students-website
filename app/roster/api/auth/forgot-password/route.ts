import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import type { RosterUser } from "../../../lib/auth";
import { generateToken, hashToken } from "../../../lib/crypto";
import { emailLayout, sendEmail } from "../../../lib/email";
import { siteOrigin } from "../../../lib/origin";
import { checkRateLimit, clientKey, tooManyRequests } from "../../../lib/rateLimit";

const RESET_TTL = 30 * 60;

export async function POST(request: Request) {
  const { email } = await request.json();
  // Always the same answer whether or not the account exists, so this can't be
  // used to work out who has an account.
  const generic = { success: true, message: "If that account exists, a reset link is on its way." };

  const ip = clientKey(request);
  if (ip) {
    // The per-account cap below is the real protection against mailbombing;
    // this one is loose so a shared office IP doesn't block everyone.
    const limit = await checkRateLimit("forgot", `ip:${ip}`, 15, 60 * 60);
    if (!limit.ok) {
      return tooManyRequests("Too many reset requests. Please try again later.", limit.retryAfter);
    }
  }

  if (!email) return NextResponse.json(generic);

  const lower = String(email).trim().toLowerCase();
  const user = await kvGet<RosterUser>(`user:${lower}`);
  if (!user) return NextResponse.json(generic);

  // Cap per account too — otherwise one address can be mailbombed from many IPs.
  const perAccount = await checkRateLimit("forgot", `email:${lower}`, 3, 60 * 60);
  if (!perAccount.ok) return NextResponse.json(generic);

  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  await kvPut(`pwdreset:${tokenHash}`, { email: user.email, createdAt: Date.now() }, RESET_TTL);

  const resetUrl = `${siteOrigin(request)}/roster?resetToken=${raw}`;
  await sendEmail({
    to: user.email!,
    subject: "Reset your ASM Roster password",
    html: emailLayout({
      heading: "Reset your password",
      body: `<p style="margin:0">Hi ${user.name ? user.name.split(" ")[0] : "there"} — use the button below to choose a new password. The link works once and expires in 30 minutes.</p>`,
      button: { label: "Reset password →", url: resetUrl },
      footer:
        "If you didn't ask for this, you can ignore this email — your password stays as it is. Resetting will sign you out everywhere else.",
    }),
  });

  return NextResponse.json(generic);
}
