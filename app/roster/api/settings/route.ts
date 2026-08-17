import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../lib/kv";
import { requireAdmin } from "../../lib/auth";
import { DEFAULT_ROSTER_SETTINGS, deepMerge, SETTINGS_KEY } from "../../lib/settings";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const stored = await kvGet(SETTINGS_KEY);
  const settings = { ...DEFAULT_ROSTER_SETTINGS, ...(stored as object) };
  return NextResponse.json({ settings });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: "Admin access required" }, { status: 403 });

  const updates = await request.json();
  const current = (await kvGet(SETTINGS_KEY)) || {};
  const merged = deepMerge(DEFAULT_ROSTER_SETTINGS, current as object, updates);
  await kvPut(SETTINGS_KEY, merged);
  return NextResponse.json({ success: true, settings: merged });
}
