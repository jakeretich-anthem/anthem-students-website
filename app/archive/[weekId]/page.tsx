import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StudentScreen from "../../components/StudentScreen";
import ArchiveDayStatus from "../../components/ArchiveDayStatus";
import ArchiveDots from "../../components/ArchiveDots";
import { getCurrentWeek, getMenuSummary, getPublishedWeekById, formatShortDate } from "../../lib/data";

export default async function ArchiveWeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const id = Number(weekId);

  const [week, current, menu] = await Promise.all([
    getPublishedWeekById(id),
    getCurrentWeek(),
    getMenuSummary(),
  ]);
  if (!week) notFound();
  if (current?.id === week.id) redirect("/");

  const effectiveDate = week.scheduled_publish_at ?? week.published_at;

  return (
    <StudentScreen
      appbar={{
        mode: "back",
        href: "/archive",
        label: "Past weeks",
        step: effectiveDate ? formatShortDate(effectiveDate) : "",
      }}
      menu={menu}
      quiet
    >
      <div className="tape">
        W{week.series_week_number} · {week.verse_reference}
        {effectiveDate ? ` · ${formatShortDate(effectiveDate)}` : ""}
      </div>
      <div className="rule" />

      <div className="kicker">The big idea</div>
      <p className="bigidea">{week.big_idea}</p>

      <div style={{ height: 14 }} />

      <div className="versecard">
        <div className="versetext">&ldquo;{week.verse_text}&rdquo;</div>
        <div className="verseref">{week.verse_reference}</div>
      </div>

      <div className="dashrule" />

      <div className="pathhead">
        <span className="tape" style={{ color: "var(--ice)" }}>
          The path
        </span>
        <ArchiveDots weekId={week.id} dayNumbers={week.days.map((d) => d.day_number)} />
      </div>

      {week.days.map((d) => (
        <Link key={d.day_number} href={`/archive/${week.id}/day/${d.day_number}`} className="daycard">
          <span className="daynum">DAY {d.day_number}</span>
          <div>
            <div className="daytitle">{d.title}</div>
            <div className="daysub">{d.passage_reference.replace(" · WEB", "")}</div>
          </div>
          <ArchiveDayStatus weekId={week.id} dayNumber={d.day_number} />
        </Link>
      ))}
    </StudentScreen>
  );
}
