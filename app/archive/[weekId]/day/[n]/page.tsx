import { notFound } from "next/navigation";
import StudentScreen from "../../../../components/StudentScreen";
import { archive, findArchiveWeek } from "../../../../data/content";

export function generateStaticParams() {
  return archive
    .flatMap((series) => series.weeks.filter((w) => !w.isCurrent))
    .flatMap((w) => w.days.map((d) => ({ weekId: w.id, n: String(d.number) })));
}

export default async function ArchiveDayPage({ params }: { params: Promise<{ weekId: string; n: string }> }) {
  const { weekId, n } = await params;
  const weekData = findArchiveWeek(weekId);
  if (!weekData || weekData.isCurrent) notFound();
  const day = weekData.days.find((d) => String(d.number) === n);
  if (!day) notFound();

  return (
    <StudentScreen
      appbar={{
        mode: "back",
        href: `/archive/${weekData.id}`,
        label: weekData.weekLabel,
        step: `Day ${day.number} / ${weekData.days.length}`,
      }}
      quiet
    >
      <p className="bigidea" style={{ fontSize: 23 }}>
        {day.title}
      </p>

      <div style={{ height: 13 }} />

      <div className="passage">
        <div className="pref">{day.passageReference}</div>
        <p>{day.passageText}</p>
      </div>

      <div className="thought">{day.thought}</div>

      <div className="dashrule" />

      <div className="question">{day.question}</div>

      <div className="journalnote">✎ This was written in your journal that week</div>
    </StudentScreen>
  );
}
