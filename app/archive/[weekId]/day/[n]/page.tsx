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

  const day = week.days.find((d) => String(d.day_number) === n);
  if (!day) notFound();

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

      <div className="journalnote">✎ This was written in your journal that week</div>
    </StudentScreen>
  );
}
