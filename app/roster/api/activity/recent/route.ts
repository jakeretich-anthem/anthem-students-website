import { NextResponse } from "next/server";
import { kvGet, kvList } from "../../../lib/kv";

type ActivityItem = { createdAt: string; [key: string]: unknown };

export async function GET() {
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
