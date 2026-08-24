import { kvDelete, kvGet, kvPut } from "../../../../lib/kv";
import type { RosterUser } from "../../../../lib/auth";
import { hashToken } from "../../../../lib/crypto";
import { emailLayout, sendEmail } from "../../../../lib/email";
import { siteOrigin } from "../../../../lib/origin";
import { readToken, resultPage } from "../resultPage";

// POST, not GET: the token in the notification email is the whole
// authorization, and things other than the recipient follow links in an inbox.
// The admin gets here by pressing Approve on the review page.
export async function POST(request: Request) {
  const token = await readToken(request);
  if (!token) return resultPage("Missing link", "This approval link is missing its token.", false);

  const key = `signupAction:${await hashToken(token)}`;
  const action = await kvGet<{ email: string }>(key);
  if (!action) {
    return resultPage("Link expired", "This request has expired or was already decided.", false);
  }

  const userKey = `user:${action.email}`;
  const target = await kvGet<RosterUser>(userKey);
  if (!target) return resultPage("Not found", "That account request no longer exists.", false);

  target.role = "leader";
  target.status = "approved";
  await kvPut(userKey, target);
  await kvDelete(key);

  await kvPut(
    `audit:user-status:${Date.now()}:${target.email}`,
    { actor: "email-approval-link", email: target.email, role: "leader", status: "approved", createdAt: new Date().toISOString() },
    180 * 24 * 60 * 60
  );

  await sendEmail({
    to: target.email!,
    subject: "You're approved — welcome to ASM Roster",
    html: emailLayout({
      heading: "Your account is approved",
      body: `<p style="margin:0">Hi ${target.name ? target.name.split(" ")[0] : "there"} — you now have leader access to the ASM Roster. Sign in with the email and password you signed up with.</p>`,
      button: { label: "Sign in →", url: `${siteOrigin(request)}/roster` },
      footer: "Forgot the password you set? Use the “Forgot password?” link on the sign-in screen.",
    }),
  });

  return resultPage("Approved ✓", `${target.name} (${target.email}) now has leader access and has been emailed.`, true);
}
