import Link from "next/link";
import { notFound } from "next/navigation";
import StudentScreen from "../../components/StudentScreen";
import DayComplete from "../../components/DayComplete";
import TrackView from "../../components/TrackView";
import { getCurrentWeek, getMenuSummary } from "../../lib/data";

export default async function DayPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const [week, menu] = await Promise.all([getCurrentWeek(), getMenuSummary()]);
  if (!week) notFound();

  const index = week.days.findIndex((d) => String(d.day_number) === n);
  if (index === -1) notFound();
  const day = week.days[index];
  const prev = week.days[index - 1];
  const next = week.days[index + 1];

  return (
    <StudentScreen
      appbar={{ mode: "back", href: "/", label: "This week", step: `Day ${day.day_number} / ${week.days.length}` }}
      menu={menu}
      quiet
    >
      <TrackView event="day_view" weekId={week.id} dayNumber={day.day_number} />
      <h1 className="pagetitle">{day.title}</h1>

      <div className="passage">
        <div className="pref">{day.passage_reference}</div>
        <p>{day.passage_text}</p>
      </div>

      {/* Passage, thought and question used to run together with a single
          dashed rule between two of them. Each block now says what it is. */}
      <section className="stack snug">
        <h2 className="pref hot">The thought</h2>
        <div className="thought">{day.thought}</div>
      </section>

      <section className="stack snug">
        <h2 className="pref">Think about it</h2>
        <div className="question">{day.question}</div>
        <div className="journalnote">✎ Write your answer in your journal</div>
      </section>

      <DayComplete weekId={week.id} dayNumber={day.day_number} />

      {(prev || next) && (
        <nav className="daynav">
          {prev && <Link href={`/day/${prev.day_number}`}>← Day {prev.day_number}</Link>}
          {next && <Link href={`/day/${next.day_number}`}>Day {next.day_number} →</Link>}
        </nav>
      )}
    </StudentScreen>
  );
}
