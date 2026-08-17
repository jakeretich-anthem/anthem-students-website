import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { requireAdmin } from "../../../lib/auth";

type OrgSettings = { permissions?: unknown };

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const settings = (await kvGet<OrgSettings>("settings:org")) || {};
  return NextResponse.json({ permissions: settings.permissions || {} });
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { permissions } = await request.json();
  const settings = (await kvGet<OrgSettings>("settings:org")) || {};
  settings.permissions = permissions || settings.permissions || {};
  await kvPut("settings:org", settings);
  return NextResponse.json({ success: true, permissions: settings.permissions });
}
