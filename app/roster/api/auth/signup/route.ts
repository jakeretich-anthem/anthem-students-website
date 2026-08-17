import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { listAdmins, type RosterUser } from "../../../lib/auth";
import { generateToken, hashPassword, hashToken, validatePasswordStrength } from "../../../lib/crypto";
import { sendEmail } from "../../../lib/email";

const SIGNUP_ACTION_TTL = 14 * 24 * 60 * 60; // 14 days — admin may not check email right away

export async function POST(request: Request) {
  const { email, password, name } = await request.json();
  if (!email || !password || !name) return NextResponse.json({ error: "All fields required" }, { status: 400 });
  if (!validatePasswordStrength(password)) {
    return NextResponse.json({ error: "Use 10+ chars with upper/lowercase and number" }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const lower = String(email).toLowerCase();
  if (await kvGet(`user:${lower}`)) return NextResponse.json({ error: "Account already exists" }, { status: 409 });

  const user: RosterUser = {
    email: lower,
    name,
    passwordHash: await hashPassword(password),
    role: "pending",
    status: "pending_approval",
    createdAt: new Date().toISOString(),
  };
  await kvPut(`user:${lower}`, user);

  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  await kvPut(`signupAction:${tokenHash}`, { email: lower, createdAt: Date.now() }, SIGNUP_ACTION_TTL);

  const origin = new URL(request.url).origin;
  const approveUrl = `${origin}/roster/api/admin/request/approve?token=${raw}`;
  const declineUrl = `${origin}/roster/api/admin/request/decline?token=${raw}`;

  const admins = await listAdmins();
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email,
        subject: "New Account Request Pending Approval",
        html: `
<p>Someone is requesting leader access to the ASM Roster.</p>
<p><b>Name:</b> ${name}<br><b>Email:</b> ${email}<br><b>Requested:</b> ${new Date().toLocaleString()}</p>
<table cellpadding="0" cellspacing="0" style="margin-top:20px"><tr>
  <td style="padding-right:12px">
    <a href="${approveUrl}" style="display:inline-block;padding:12px 22px;background:#1a7f37;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-family:sans-serif">Approve →</a>
  </td>
  <td>
    <a href="${declineUrl}" style="display:inline-block;padding:12px 22px;background:#b91c1c;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-family:sans-serif">Decline</a>
  </td>
</tr></table>
<p style="margin-top:20px;color:#888;font-size:12px">You can also manage this from Adminland inside the app. This link expires in 14 days.</p>`,
      })
    )
  );

  return NextResponse.json({ success: true, message: "Account request submitted for approval." });
}
