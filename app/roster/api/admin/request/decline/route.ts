import { kvDelete, kvGet, kvPut } from "../../../../lib/kv";
import type { RosterUser } from "../../../../lib/auth";
import { hashToken } from "../../../../lib/crypto";
import { sendEmail } from "../../../../lib/email";
import { resultPage } from "../resultPage";

export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return resultPage("Missing link", "This link is missing its token.", false);

  const tokenHash = await hashToken(token);
  const key = `signupAction:${tokenHash}`;
  const action = await kvGet<{ email: string; used?: boolean }>(key);
  if (!action) {
    return resultPage("Link expired", "This link has expired or was already used.", false);
  }

  const userKey = `user:${action.email}`;
  const target = await kvGet<RosterUser>(userKey);
  if (!target) return resultPage("Not found", "That account request no longer exists.", false);

  target.status = "denied";
  await kvPut(userKey, target);
  await kvDelete(key);

  await sendEmail({
    to: target.email!,
    subject: "Account request declined",
    html: "<p>Your account request was not approved.</p>",
  });

  return resultPage("Declined", `${target.name} (${target.email})'s request was declined. They were not given access.`, true);
}
