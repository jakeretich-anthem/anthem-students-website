import { notFound } from "next/navigation";
import StudentScreen from "../../components/StudentScreen";
import DayComplete from "../../components/DayComplete";
import { days } from "../../data/content";

export function generateStaticParams() {
  return days.map((d) => ({ n: String(d.number) }));
}

export default async function DayPage({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params;
  const day = days.find((d) => String(d.number) === n);
  if (!day) notFound();

  return (
    <StudentScreen
      appbar={{ mode: "back", href: "/", label: "This week", step: `Day ${day.number} / ${days.length}` }}
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

      <div className="journalnote">✎ Write your answer in your journal</div>

      <DayComplete dayNumber={day.number} />
    </StudentScreen>
  );
}
