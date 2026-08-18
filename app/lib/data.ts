import { createClient } from "../../utils/supabase/server";

export type DbDay = {
  id: number;
  week_id: number;
  day_number: 1 | 2 | 3;
  title: string;
  passage_reference: string;
  passage_text: string;
  thought: string;
  question: string;
};

export type DbWeek = {
  id: number;
  series_name: string;
  series_week_number: number;
  series_week_total: number;
  title: string;
  big_idea: string;
  verse_reference: string;
  verse_translation: string;
  verse_text: string;
  recap: string;
  heads_up: string | null;
  starters: string[];
  image_url: string | null;
  status: "draft" | "live";
  scheduled_publish_at: string | null;
  published_at: string | null;
};

export type WeekWithDays = DbWeek & { days: DbDay[] };

export type SeriesGroup = { name: string; weeks: WeekWithDays[] };

export type DbEvent = {
  id: number;
  title: string;
  event_date: string;
  time_label: string | null;
  location: string | null;
  detail: string | null;
  signup_url: string | null;
  image_url: string | null;
};

export type MenuSummary = {
  seriesName: string | null;
  seriesWeekNumber: number | null;
  verseReference: string | null;
  eventsCount: number;
  archiveCount: number;
};

// A "live" week is only actually visible once its scheduled publish time
// (if any) has passed — this is the same rule the RLS policies enforce,
// duplicated here so ordering/grouping logic has it too.
function effectivePublishTime(w: DbWeek): number {
  const t = w.scheduled_publish_at ?? w.published_at;
  return t ? new Date(t).getTime() : 0;
}

function sortDays(days: DbDay[]): DbDay[] {
  return [...days].sort((a, b) => a.day_number - b.day_number);
}

async function fetchPublishedWeeks(): Promise<WeekWithDays[]> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("weeks")
    .select("*, days(*)")
    .eq("status", "live")
    .or(`scheduled_publish_at.is.null,scheduled_publish_at.lte.${nowIso}`);

  if (error || !data) return [];

  return (data as (DbWeek & { days: DbDay[] })[])
    .map((w) => ({ ...w, days: sortDays(w.days) }))
    .sort((a, b) => effectivePublishTime(b) - effectivePublishTime(a));
}

export async function getCurrentWeek(): Promise<WeekWithDays | null> {
  const weeks = await fetchPublishedWeeks();
  return weeks[0] ?? null;
}

// Grouped by series, each series' weeks newest first, series ordered by
// their newest week — matches "newest first" without a second sort pass
// undoing the per-series order.
export async function getArchiveSeries(): Promise<SeriesGroup[]> {
  const weeks = await fetchPublishedWeeks();
  const order: string[] = [];
  const bySeries = new Map<string, WeekWithDays[]>();
  for (const w of weeks) {
    if (!bySeries.has(w.series_name)) {
      bySeries.set(w.series_name, []);
      order.push(w.series_name);
    }
    bySeries.get(w.series_name)!.push(w);
  }
  return order.map((name) => ({ name, weeks: bySeries.get(name)! }));
}

// RLS already hides drafts and not-yet-scheduled weeks from the anon
// role, so a missing row here means "not visible to students," not
// necessarily "doesn't exist" — either way the caller should 404.
export async function getPublishedWeekById(id: number): Promise<WeekWithDays | null> {
  if (!Number.isFinite(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weeks")
    .select("*, days(*)")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  const row = data as DbWeek & { days: DbDay[] };
  return { ...row, days: sortDays(row.days) };
}

export async function getEvents(): Promise<DbEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("events").select("*").order("event_date", { ascending: true });
  if (error || !data) return [];
  return data as DbEvent[];
}

export async function getMenuSummary(): Promise<MenuSummary> {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [current, eventsRes, archiveRes] = await Promise.all([
    getCurrentWeek(),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase
      .from("weeks")
      .select("*", { count: "exact", head: true })
      .eq("status", "live")
      .or(`scheduled_publish_at.is.null,scheduled_publish_at.lte.${nowIso}`),
  ]);
  return {
    seriesName: current?.series_name ?? null,
    seriesWeekNumber: current?.series_week_number ?? null,
    verseReference: current?.verse_reference ?? null,
    eventsCount: eventsRes.count ?? 0,
    archiveCount: archiveRes.count ?? 0,
  };
}

export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
