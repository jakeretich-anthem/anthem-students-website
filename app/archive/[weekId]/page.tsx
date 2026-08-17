import Link from "next/link";
import { notFound } from "next/navigation";
import StudentScreen from "../../components/StudentScreen";
import { archive, findArchiveWeek } from "../../data/content";

export function generateStaticParams() {
  return archive.flatMap((series) => series.weeks.filter((w) => !w.isCurrent).map((w) => ({ weekId: w.id })));
}

export default async function ArchiveWeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const weekData = findArchiveWeek(weekId);
  if (!weekData || weekData.isCurrent) notFound();

  return (
    <StudentScreen appbar={{ mode: "back", href: "/archive", label: "Past weeks", step: weekData.date }} quiet>
      <div className="tape">
        {weekData.weekLabel} · {weekData.passage} · {weekData.date}
      </div>
      <div className="rule" />

      <div className="kicker">The big idea</div>
      <p className="bigidea">{weekData.bigIdea}</p>

      <div style={{ height: 14 }} />

      <div className="versecard">
        <div className="versetext">&ldquo;{weekData.verseText}&rdquo;</div>
        <div className="verseref">{weekData.verseReference}</div>
      </div>

      <div className="dashrule" />

      <div className="pathhead">
        <span className="tape" style={{ color: "var(--ice)" }}>
          The path
        </span>
        <span className="dots">
          {weekData.days.map((d) => (
            <i key={d.number} className="on" />
          ))}
        </span>
      </div>

      {weekData.days.map((d) => (
        <Link key={d.number} href={`/archive/${weekData.id}/day/${d.number}`} className="daycard done">
          <span className="daynum">DAY {d.number}</span>
          <div>
            <div className="daytitle">{d.title}</div>
            <div className="daysub">{d.passageReference.replace(" · WEB", "")}</div>
          </div>
          <span className="chev" style={{ color: "#3dffa0" }}>
            ✓
          </span>
        </Link>
      ))}
    </StudentScreen>
  );
}
