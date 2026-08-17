import Link from "next/link";
import StudentScreen from "./components/StudentScreen";
import Collapse from "./components/Collapse";
import WeekPath from "./components/WeekPath";
import { days, verse, week } from "./data/content";

export default function HomePage() {
  return (
    <StudentScreen appbar={{ mode: "home" }}>
      <div className="tape">
        Series: {week.seriesName} · Week {week.seriesWeekNumber} of {week.seriesWeekTotal}
      </div>
      <div className="rule" />

      <div className="kicker">This week&rsquo;s big idea</div>
      <p className="bigidea">{week.bigIdea}</p>

      <div style={{ height: 14 }} />

      <Link href="/verse" className="versecard">
        <div className="versetext">&ldquo;{verse.text}&rdquo;</div>
        <div className="verseref">
          {verse.reference} · Tap to practice →
        </div>
      </Link>

      <div className="dashrule" />

      <WeekPath days={days} />

      <div style={{ height: 6 }} />

      <Collapse label="What we talked about">{week.recap}</Collapse>

      <Link href="/parents" className="linkrow">
        For parents →
      </Link>
    </StudentScreen>
  );
}
