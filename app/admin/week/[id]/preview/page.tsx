import Link from "next/link";
import { notFound } from "next/navigation";
import StudentScreen from "../../../../components/StudentScreen";
import Collapse from "../../../../components/Collapse";
import { createClient } from "../../../../../utils/supabase/server";
import { getMenuSummary } from "../../../../lib/data";
import type { DbDay, DbWeek } from "../../../../lib/data";

export default async function AdminWeekPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const weekId = Number(id);
  if (!Number.isFinite(weekId)) notFound();

  const supabase = await createClient();
  const [{ data, error }, menu] = await Promise.all([
    supabase.from("weeks").select("*, days(*)").eq("id", weekId).maybeSingle(),
    getMenuSummary(),
  ]);
  if (error || !data) notFound();

  const week = data as DbWeek;
  const days = [...(data.days as DbDay[])].sort((a, b) => a.day_number - b.day_number);

  return (
    <StudentScreen appbar={{ mode: "home", label: "Preview · " + (week.status === "live" ? "Live" : "Draft") }} menu={menu}>
      <div className="tape">
        Series: {week.series_name || "—"} · Week {week.series_week_number} of {week.series_week_total}
      </div>
      <div className="rule" />

      <div className="kicker">This week&rsquo;s big idea</div>
      <p className="bigidea">{week.big_idea || "—"}</p>

      <div style={{ height: 14 }} />

      <div className="versecard">
        <div className="versetext">&ldquo;{week.verse_text || "—"}&rdquo;</div>
        <div className="verseref">{week.verse_reference}</div>
      </div>

      <div className="dashrule" />

      <div className="pathhead">
        <span className="tape" style={{ color: "var(--ice)" }}>
          Your week
        </span>
      </div>

      {days.map((d) => (
        <Link key={d.day_number} href={`/admin/week/${week.id}/preview/day/${d.day_number}`} className="daycard">
          <span className="daynum">DAY {d.day_number}</span>
          <div>
            <div className="daytitle">{d.title || "Untitled"}</div>
            <div className="daysub">{d.passage_reference.replace(" · WEB", "")}</div>
          </div>
          <span className="chev">›</span>
        </Link>
      ))}

      <div style={{ height: 6 }} />

      <Collapse label="What we talked about">{week.recap || "—"}</Collapse>

      <Link href="/parents" className="linkrow">
        For parents →
      </Link>
    </StudentScreen>
  );
}
