import { NextResponse } from "next/server";
import { kvPut } from "../../../lib/kv";
import { getSessionUser } from "../../../lib/auth";

// The roster only has these two tabs; "last" defers to whichever one this
// device was left on. Anything else would send the leader to a tab that isn't
// there, so it's rejected rather than stored.
const DEFAULT_TABS = ["hs", "ms", "last"];

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updates = await request.json();
  const editable: (keyof typeof user)[] = ["name", "leaderSince", "funFact", "photoUrl"];
  for (const key of editable) {
    if (updates[key] !== undefined) (user as Record<string, unknown>)[key] = updates[key];
  }
  if (typeof updates.defaultTab === "string" && DEFAULT_TABS.includes(updates.defaultTab)) {
    user.defaultTab = updates.defaultTab;
  }
  await kvPut(`user:${user.email}`, user);
  return NextResponse.json({ success: true });
}
