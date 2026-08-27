import { NextResponse } from "next/server";
import { kvPut } from "../../../lib/kv";
import { getSessionUser } from "../../../lib/auth";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updates = await request.json();
  const editable: (keyof typeof user)[] = ["name", "leaderSince", "funFact", "photoUrl", "photoCrop"];
  for (const key of editable) {
    if (updates[key] !== undefined) (user as Record<string, unknown>)[key] = updates[key];
  }
  await kvPut(`user:${user.email}`, user);
  return NextResponse.json({ success: true });
}
