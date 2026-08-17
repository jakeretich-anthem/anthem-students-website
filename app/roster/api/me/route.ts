import { NextResponse } from "next/server";
import { trackMetric } from "../../lib/kv";
import { getSessionUser, safeUser } from "../../lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ user: null });
  await trackMetric("pageview");
  return NextResponse.json({ user: safeUser(user) });
}
