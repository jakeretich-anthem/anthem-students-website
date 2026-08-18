import { notFound } from "next/navigation";
import StudentScreen from "../../components/StudentScreen";
import DayComplete from "../../components/DayComplete";
import TrackView from "../../components/TrackView";
import { getCurrentWeek, getMenuSummary } from "../../lib/data";

export default async function DayPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const [week, menu] = await Promise.all([getCurrentWeek(), getMenuSummary()]);
  if (!week) notFound();

  const day = week.days.find((d) => String(d.day_number) === n);
  if (!day) notFound();

  return (
    <StudentScreen
      appbar={{ mode: "back", href: "/", label: "This week", step: `Day ${day.day_number} / ${week.days.length}` }}
      menu={menu}
      quiet
    >
      <TrackView event="day_view" weekId={week.id} dayNumber={day.day_number} />
      <p className="bigidea" style={{ fontSize: 23 }}>
        {day.title}
      </p>

      <div style={{ height: 13 }} />

      <div className="passage">
        <div className="pref">{day.passage_reference}</div>
        <p>{day.passage_text}</p>
      </div>

      <div className="thought">{day.thought}</div>

      <div className="dashrule" />

      <div className="question">{day.question}</div>

      <div className="journalnote">✎ Write your answer in your journal</div>

      <DayComplete weekId={week.id} dayNumber={day.day_number} />
    </StudentScreen>
  );
}
