import { NextResponse } from "next/server";
import { kvGet, kvList } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

type ActivityItem = { type?: string; leader?: string; studentName?: string; sk?: string; date?: string; createdAt: string };

// Activity records carry a 90-day TTL (see api/student/interactions), so every
// time-based number here describes a rolling 90-day window, not all time. The
// dashboard says so on the cards that use them. All-time hangout totals come
// from the untrimmed interactions store instead, summed on the client.
const WINDOW_DAYS = 90;

// A hangout's `date` is the day the leader says it happened; `createdAt` is
// when they got around to logging it. The first is what people mean by "when
// was that hangout", so prefer it and fall back only when it's missing.
function occurredAt(item: ActivityItem): Date | null {
  const bare = (item.date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  // A bare YYYY-MM-DD parses as UTC midnight, which lands on the previous day
  // for any negative-offset server — enough to file a Sunday hangout under
  // Saturday in the weekday breakdown. Pin it to noon UTC instead.
  const d = bare ? new Date(Date.UTC(+bare[1], +bare[2] - 1, +bare[3], 12)) : new Date(item.createdAt);
  return isNaN(d.getTime()) ? null : d;
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const perm = await requirePermission("activity", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const list = await kvList("activity:");
  const leaderCounts: Record<string, number> = {};
  const studentCounts: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  const byDayOfWeek = [0, 0, 0, 0, 0, 0, 0];
  const bySk: Record<string, number> = { hs: 0, ms: 0 };
  const recentLeaders = new Set<string>();

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  let thisMonth = 0;
  let last7 = 0;
  let last30 = 0;
  let earliest: number | null = null;
  let totalHangouts = 0;

  for (const key of list.keys) {
    const item = await kvGet<ActivityItem>(key.name);
    if (!item) continue;
    // This dashboard is specifically about hangouts — the activity: prefix
    // now also carries connections, notes, and roster edits (see the Activity
    // tab), so skip everything but hangouts here. A missing `type` is a
    // pre-existing record from before this field existed, and those are all
    // hangouts (the only writer at the time).
    if (item.type && item.type !== "hangout") continue;
    totalHangouts++;
    if (item.leader) leaderCounts[item.leader] = (leaderCounts[item.leader] || 0) + 1;
    if (item.studentName) studentCounts[item.studentName] = (studentCounts[item.studentName] || 0) + 1;
    if (item.sk === "hs" || item.sk === "ms") bySk[item.sk]++;

    const when = occurredAt(item);
    if (!when) continue;

    const age = (now.getTime() - when.getTime()) / dayMs;
    if (age >= 0 && age < 7) {
      last7++;
      if (item.leader) recentLeaders.add(item.leader);
    }
    if (age >= 0 && age < 30) last30++;
    if (when.getMonth() === now.getMonth() && when.getFullYear() === now.getFullYear()) thisMonth++;
    if (earliest === null || when.getTime() < earliest) earliest = when.getTime();

    byDayOfWeek[when.getUTCDay()]++;
    const k = dayKey(when);
    perDay[k] = (perDay[k] || 0) + 1;
  }

  const top = (counts: Record<string, number>, n: number) =>
    Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([name, count]) => ({ name, count }));

  // Twelve weeks of buckets, oldest first, so the client can draw a trend
  // without re-deriving week boundaries from raw rows.
  const byWeek: { label: string; count: number }[] = [];
  for (let w = 11; w >= 0; w--) {
    const end = new Date(now.getTime() - w * 7 * dayMs);
    const start = new Date(end.getTime() - 7 * dayMs);
    let count = 0;
    for (const [day, n] of Object.entries(perDay)) {
      const t = new Date(day + "T12:00:00Z").getTime();
      if (t > start.getTime() && t <= end.getTime()) count += n;
    }
    byWeek.push({ label: dayKey(end).slice(5), count });
  }

  const busiest = Object.entries(perDay).sort((a, b) => b[1] - a[1])[0];

  return NextResponse.json({
    totalInteractions: totalHangouts,
    uniqueLeaders: Object.keys(leaderCounts).length,
    uniqueStudents: Object.keys(studentCounts).length,
    thisMonth,
    last7,
    last30,
    activeLeaders7: recentLeaders.size,
    daysLogged: Object.keys(perDay).length,
    firstLoggedAt: earliest ? new Date(earliest).toISOString() : null,
    busiestDay: busiest ? { date: busiest[0], count: busiest[1] } : null,
    byDayOfWeek,
    byWeek,
    bySk,
    windowDays: WINDOW_DAYS,
    topLeaders: top(leaderCounts, 8),
    topStudents: top(studentCounts, 8),
  });
}
