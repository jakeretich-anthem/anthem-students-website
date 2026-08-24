import { kvDelete, kvGet, kvPut } from "../../../../lib/kv";
import type { RosterUser } from "../../../../lib/auth";
import { hashToken } from "../../../../lib/crypto";
import { readToken, resultPage } from "../resultPage";

// Declining deletes the account outright and sends nothing — the person is
// never told their request was refused. Nothing is remembered afterwards, so
// the same address can request again later and that arrives as a fresh request.
//
// POST, not GET, because this is destructive and a link sitting in an inbox
// gets followed by scanners and previews. See ../review.
export async function POST(request: Request) {
  const token = await readToken(request);
  if (!token) return resultPage("Missing link", "This link is missing its token.", false);

  const key = `signupAction:${await hashToken(token)}`;
  const action = await kvGet<{ email: string }>(key);
  if (!action) {
    return resultPage("Link expired", "This request has expired or was already decided.", false);
  }

  const userKey = `user:${action.email}`;
  const target = await kvGet<RosterUser>(userKey);
  const label = target ? `${target.name} (${target.email})` : action.email;

  await kvDelete(userKey);
  await kvDelete(key);

  await kvPut(
    `audit:user-status:${Date.now()}:${action.email}`,
    { actor: "email-approval-link", email: action.email, action: "declined-and-deleted", createdAt: new Date().toISOString() },
    180 * 24 * 60 * 60
  );

  return resultPage("Declined", `${label}'s request was deleted. They were not notified and have no access.`, true);
}
