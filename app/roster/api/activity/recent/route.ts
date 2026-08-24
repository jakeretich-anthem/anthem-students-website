import { NextResponse } from "next/server";
import { kvGet, kvList } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

type ActivityItem = { createdAt: string; [key: string]: unknown };

export async function GET() {
  // Activity items name students and the leaders who logged them. Reading this
  // was unauthenticated until this commit (IMP-06); activity/stats next door
  // was already gated the same way.
  const perm = await requirePermission("activity", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const list = await kvList("activity:");
  const keys = list.keys.slice(-50).reverse();
  const items: ActivityItem[] = [];
  for (const key of keys) {
    const item = await kvGet<ActivityItem>(key.name);
    if (item) items.push(item);
  }
  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ items: items.slice(0, 30) });
}
