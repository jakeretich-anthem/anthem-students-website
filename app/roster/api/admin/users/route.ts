import { NextResponse } from "next/server";
import { kvGet, kvList } from "../../../lib/kv";
import { requireAdmin, type RosterUser } from "../../../lib/auth";

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const list = await kvList("user:");
  const users = [];
  for (const key of list.keys) {
    const u = await kvGet<RosterUser>(key.name);
    if (u) users.push({ name: u.name, email: u.email, role: u.role, status: u.status || null, createdAt: u.createdAt, leaderSince: u.leaderSince });
  }
  return NextResponse.json({ users });
}
