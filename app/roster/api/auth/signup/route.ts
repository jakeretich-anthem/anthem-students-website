import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { listAdmins, type RosterUser } from "../../../lib/auth";
import { describePasswordProblem, generateToken, hashPassword, hashToken } from "../../../lib/crypto";
import { emailLayout, sendEmail } from "../../../lib/email";
import { escapeHtml } from "../../../lib/html";
import { siteOrigin } from "../../../lib/origin";
import { checkRateLimit, clientKey, tooManyRequests } from "../../../lib/rateLimit";

const SIGNUP_ACTION_TTL = 14 * 24 * 60 * 60; // 14 days — admin may not check email right away

export async function POST(request: Request) {
  const ip = clientKey(request);
  if (ip) {
    // A whole group of new leaders signing up together at one meeting shares
    // one wifi IP, so this is set well above a plausible real batch.
    const limit = await checkRateLimit("signup", `ip:${ip}`, 15, 60 * 60);
    if (!limit.ok) {
      return tooManyRequests("Too many requests from this device. Please try again later.", limit.retryAfter);
    }
  }

  const { email, password, name } = await request.json();
  if (!email || !password || !name) return NextResponse.json({ error: "All fields required" }, { status: 400 });

  const problem = describePasswordProblem(password);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });

  const lower = String(email).trim().toLowerCase();
  const cleanName = String(name).trim();

  const existing = await kvGet<RosterUser>(`user:${lower}`);
  if (existing) {
    // Their own request, still waiting — say so rather than "account already
    // exists", which reads as an error they need to fix.
    if (existing.role === "pending" || existing.status === "pending_approval") {
      return NextResponse.json(
        { error: "You already have a request waiting for approval. We'll email you once it's reviewed." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "An account with that email already exists. Try signing in." }, { status: 409 });
  }

  const user: RosterUser = {
    email: lower,
    name: cleanName,
    passwordHash: await hashPassword(password),
    role: "pending",
    status: "pending_approval",
    createdAt: new Date().toISOString(),
  };
  await kvPut(`user:${lower}`, user);

  const raw = generateToken();
  const tokenHash = await hashToken(raw);
  await kvPut(`signupAction:${tokenHash}`, { email: lower, createdAt: Date.now() }, SIGNUP_ACTION_TTL);

  // Points at the review page, not straight at approve/decline — see
  // api/admin/request/review. A link in an inbox gets followed by things that
  // aren't the recipient, and declining now deletes the request for good.
  const reviewUrl = `${siteOrigin(request)}/roster/api/admin/request/review?token=${raw}`;

  const admins = await listAdmins();
  await Promise.all(
    admins.map((a) =>
      sendEmail({
        to: a.email,
        subject: `Leader access request — ${cleanName}`,
        html: emailLayout({
          heading: "Someone is requesting leader access",
          body: `<p style="margin:0 0 8px"><b>Name:</b> ${escapeHtml(cleanName)}</p>
<p style="margin:0 0 8px"><b>Email:</b> ${escapeHtml(lower)}</p>
<p style="margin:0"><b>Requested:</b> ${escapeHtml(new Date().toLocaleString("en-US"))}</p>
<p style="margin:18px 0 0">Open the review page to approve or decline this request.</p>`,
          button: { label: "Review request →", url: reviewUrl },
          footer:
            "Nothing happens until you choose on that page. Approving grants leader access and emails them; declining deletes the request and tells them nothing. This link expires in 14 days.",
        }),
      })
    )
  );

  return NextResponse.json({
    success: true,
    message: "Request sent. You'll get an email as soon as it's approved.",
  });
}
