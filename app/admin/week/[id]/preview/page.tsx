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
      <div className="sectionhead">
        <span>Series: {week.series_name || "—"}</span>
        <span>
          Week {week.series_week_number} of {week.series_week_total}
        </span>
      </div>

      <div>
        <div className="kicker">This week&rsquo;s big idea</div>
        <h1 className="bigidea">{week.big_idea || "—"}</h1>
      </div>

      <div className="versecard">
        <div className="versetext">&ldquo;{week.verse_text || "—"}&rdquo;</div>
        <div className="verseref">{week.verse_reference}</div>
      </div>

      <section className="stack snug">
        <h2 className="sectionhead ice">Your week</h2>

        <div className="list">
          {days.map((d) => (
            <Link key={d.day_number} href={`/admin/week/${week.id}/preview/day/${d.day_number}`} className="daycard">
              <span className="daynum">DAY {d.day_number}</span>
              <span>
                <span className="daytitle">{d.title || "Untitled"}</span>
                <span className="daysub">{d.passage_reference.replace(" · WEB", "")}</span>
              </span>
              <span className="chev">›</span>
            </Link>
          ))}
        </div>
      </section>

      <Collapse label="What we talked about">{week.recap || "—"}</Collapse>

      <Link href="/parents" className="linkrow">
        For parents →
      </Link>
    </StudentScreen>
  );
}
