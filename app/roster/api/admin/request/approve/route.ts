import { kvDelete, kvGet, kvPut } from "../../../../lib/kv";
import type { RosterUser } from "../../../../lib/auth";
import { hashToken } from "../../../../lib/crypto";
import { sendEmail } from "../../../../lib/email";
import { resultPage } from "../resultPage";

// One-click action link from the "new account request" email. The token
// itself is the authorization (same trust model as the password-reset
// link) — whoever received the admin notification email can click it.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return resultPage("Missing link", "This approval link is missing its token.", false);

  const tokenHash = await hashToken(token);
  const key = `signupAction:${tokenHash}`;
  const action = await kvGet<{ email: string; used?: boolean }>(key);
  if (!action) {
    return resultPage("Link expired", "This approval link has expired or was already used.", false);
  }

  const userKey = `user:${action.email}`;
  const target = await kvGet<RosterUser>(userKey);
  if (!target) return resultPage("Not found", "That account request no longer exists.", false);

  target.role = "leader";
  target.status = "approved";
  await kvPut(userKey, target);
  await kvDelete(key);

  await sendEmail({
    to: target.email!,
    subject: "Account approved",
    html: "<p>Your account has been approved. You can now log in.</p>",
  });

  return resultPage("Approved ✓", `${target.name} (${target.email}) now has leader access.`, true);
}
