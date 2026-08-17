import { NextResponse } from "next/server";
import { kvGet, kvList } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

type ActivityItem = { leader?: string; studentName?: string; createdAt: string };

export async function GET() {
  const perm = await requirePermission("activity", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const list = await kvList("activity:");
  const leaderCounts: Record<string, number> = {};
  const studentCounts: Record<string, number> = {};
  const now = new Date();
  let thisMonth = 0;

  for (const key of list.keys) {
    const item = await kvGet<ActivityItem>(key.name);
    if (!item) continue;
    if (item.leader) leaderCounts[item.leader] = (leaderCounts[item.leader] || 0) + 1;
    if (item.studentName) studentCounts[item.studentName] = (studentCounts[item.studentName] || 0) + 1;
    const d = new Date(item.createdAt);
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) thisMonth++;
  }

  const topLeaders = Object.entries(leaderCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));
  const topStudents = Object.entries(studentCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count }));

  return NextResponse.json({
    totalInteractions: list.keys.length,
    uniqueLeaders: Object.keys(leaderCounts).length,
    uniqueStudents: Object.keys(studentCounts).length,
    thisMonth,
    topLeaders,
    topStudents,
  });
}
