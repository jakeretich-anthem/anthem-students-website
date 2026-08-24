import { kvGet } from "../../../../lib/kv";
import type { RosterUser } from "../../../../lib/auth";
import { hashToken } from "../../../../lib/crypto";
import { resultPage, reviewPage } from "../resultPage";

// The landing page for the "Review request" button in the admin notification
// email. Read-only by design: anything that follows a link in an inbox — mail
// security scanners, link previews, an accidental tap — lands here and changes
// nothing. Approving and declining are POSTs from the buttons on this page.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return resultPage("Missing link", "This review link is missing its token.", false);

  const action = await kvGet<{ email: string; createdAt?: number }>(`signupAction:${await hashToken(token)}`);
  if (!action) {
    return resultPage("Link expired", "This request has expired or was already decided.", false);
  }

  const target = await kvGet<RosterUser>(`user:${action.email}`);
  if (!target) return resultPage("Not found", "That account request no longer exists.", false);

  const requestedAt = target.createdAt || (action.createdAt ? new Date(action.createdAt).toISOString() : "");

  return reviewPage({
    token,
    name: target.name || "(no name given)",
    email: target.email || action.email,
    requestedAt: requestedAt ? new Date(requestedAt).toLocaleString("en-US") : "unknown",
  });
}
