import { supabaseAdmin } from "./supabaseAdmin";
import type { AnalyticsEventType } from "./analyticsEvents";

export type WeekStats = {
  opensThisWeek: number;
  opensLastWeek: number;
  parentGuideOpens: number;
  reachedDay3: number;
};

const EMPTY_STATS: WeekStats = {
  opensThisWeek: 0,
  opensLastWeek: 0,
  parentGuideOpens: 0,
  reachedDay3: 0,
};

type CountRow = { anon_id: string | null };

// Every headline number is "how many people," not "how many taps" — one
// student refreshing the page five times is one open. anon_id is the only
// thing that makes that distinction possible, and dedupe is the only thing
// it's used for (SPEC §3). Rows with no anon_id can't be deduped against
// anything, so each counts once.
function countPeople(rows: CountRow[] | null): number {
  if (!rows) return 0;
  const seen = new Set<string>();
  let anonymousRows = 0;
  for (const row of rows) {
    if (row.anon_id) seen.add(row.anon_id);
    else anonymousRows++;
  }
  return seen.size + anonymousRows;
}

async function countDistinct(
  weekId: number,
  eventType: AnalyticsEventType,
  dayNumber?: number
): Promise<number> {
  let query = supabaseAdmin().from("analytics_events").select("anon_id").eq("week_id", weekId).eq("event_type", eventType);
  if (dayNumber !== undefined) query = query.eq("day_number", dayNumber);

  const { data, error } = await query;
  if (error) {
    console.error(`[analytics] count ${eventType} failed:`, error.message);
    return 0;
  }
  return countPeople(data as CountRow[]);
}

// "Last week" is the week published immediately before this one, not a
// rolling seven days — the comparison a leader actually wants on Thursday
// morning is against the last thing they sent.
async function previousWeekId(week: { id: number; created_at?: string }): Promise<number | null> {
  const { data, error } = await supabaseAdmin()
    .from("weeks")
    .select("id")
    .lt("id", week.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { id: number }).id;
}

// The four numbers on the publish screen — and the whole of what the
// analytics log is for. No drill-down, no cohorts, no exports (SPEC §6).
export async function getWeekStats(weekId: number): Promise<WeekStats> {
  try {
    const prevId = await previousWeekId({ id: weekId });

    const [opensThisWeek, parentGuideOpens, reachedDay3, opensLastWeek] = await Promise.all([
      countDistinct(weekId, "week_view"),
      countDistinct(weekId, "parent_guide_view"),
      countDistinct(weekId, "day_view", 3),
      prevId === null ? Promise.resolve(0) : countDistinct(prevId, "week_view"),
    ]);

    return { opensThisWeek, opensLastWeek, parentGuideOpens, reachedDay3 };
  } catch (err) {
    // A publish screen that renders with zeros beats one that 500s — the
    // copyable message and QR code matter more than the numbers.
    console.error("[analytics] stats failed:", err);
    return EMPTY_STATS;
  }
}
