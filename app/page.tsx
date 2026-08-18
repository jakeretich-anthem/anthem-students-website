import Link from "next/link";
import StudentScreen from "./components/StudentScreen";
import Collapse from "./components/Collapse";
import WeekPath from "./components/WeekPath";
import TrackView from "./components/TrackView";
import { getCurrentWeek, getMenuSummary } from "./lib/data";

export default async function HomePage() {
  const [week, menu] = await Promise.all([getCurrentWeek(), getMenuSummary()]);

  if (!week) {
    return (
      <StudentScreen appbar={{ mode: "home" }} menu={menu}>
        <div className="emptystate">
          <div className="kicker">Nothing published yet</div>
          <p>This is where next week&rsquo;s stuff will show up. Check back after Wednesday night.</p>
        </div>
      </StudentScreen>
    );
  }

  return (
    <StudentScreen appbar={{ mode: "home" }} menu={menu}>
      <TrackView event="week_view" weekId={week.id} />
      <div className="tape">
        Series: {week.series_name} · Week {week.series_week_number} of {week.series_week_total}
      </div>
      <div className="rule" />

      <div className="kicker">This week&rsquo;s big idea</div>
      <p className="bigidea">{week.big_idea}</p>

      <div style={{ height: 14 }} />

      <Link href="/verse" className="versecard">
        <div className="versetext">&ldquo;{week.verse_text}&rdquo;</div>
        <div className="verseref">
          {week.verse_reference} · Tap to practice →
        </div>
      </Link>

      <div className="dashrule" />

      <WeekPath weekId={week.id} days={week.days} />

      <div style={{ height: 6 }} />

      <Collapse label="What we talked about">{week.recap}</Collapse>

      <Link href="/parents" className="linkrow">
        For parents →
      </Link>
    </StudentScreen>
  );
}
