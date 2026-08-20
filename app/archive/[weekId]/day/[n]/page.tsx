import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import StudentScreen from "../../../../components/StudentScreen";
import { getCurrentWeek, getMenuSummary, getPublishedWeekById } from "../../../../lib/data";

export default async function ArchiveDayPage({ params }: { params: Promise<{ weekId: string; n: string }> }) {
  const { weekId, n } = await params;
  const id = Number(weekId);

  const [week, current, menu] = await Promise.all([
    getPublishedWeekById(id),
    getCurrentWeek(),
    getMenuSummary(),
  ]);
  if (!week) notFound();
  if (current?.id === week.id) redirect(`/day/${n}`);

  const index = week.days.findIndex((d) => String(d.day_number) === n);
  if (index === -1) notFound();
  const day = week.days[index];
  const prev = week.days[index - 1];
  const next = week.days[index + 1];

  return (
    <StudentScreen
      appbar={{
        mode: "back",
        href: `/archive/${week.id}`,
        label: `Week ${week.series_week_number}`,
        step: `Day ${day.day_number} / ${week.days.length}`,
      }}
      menu={menu}
      quiet
    >
      <h1 className="pagetitle">{day.title}</h1>

      <div className="passage">
        <div className="pref">{day.passage_reference}</div>
        <p>{day.passage_text}</p>
      </div>

      <section className="stack snug">
        <h2 className="pref hot">The thought</h2>
        <div className="thought">{day.thought}</div>
      </section>

      <section className="stack snug">
        <h2 className="pref">Think about it</h2>
        <div className="question">{day.question}</div>
        <div className="journalnote">✎ This was written in your journal that week</div>
      </section>

      {(prev || next) && (
        <nav className="daynav">
          {prev && <Link href={`/archive/${week.id}/day/${prev.day_number}`}>← Day {prev.day_number}</Link>}
          {next && <Link href={`/archive/${week.id}/day/${next.day_number}`}>Day {next.day_number} →</Link>}
        </nav>
      )}
    </StudentScreen>
  );
}
