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
          <h1 className="kicker">Nothing published yet</h1>
          <p>This is where next week&rsquo;s stuff will show up. Check back after Wednesday night.</p>
        </div>
      </StudentScreen>
    );
  }

  return (
    <StudentScreen appbar={{ mode: "home" }} menu={menu}>
      <TrackView event="week_view" weekId={week.id} />
      <div className="sectionhead">
        <span>Series: {week.series_name}</span>
        <span>
          Week {week.series_week_number} of {week.series_week_total}
        </span>
      </div>

      <div>
        <div className="kicker">This week&rsquo;s big idea</div>
        <h1 className="bigidea">{week.big_idea}</h1>
      </div>

      <Link href="/verse" className="versecard">
        <div className="versetext">&ldquo;{week.verse_text}&rdquo;</div>
        <div className="verseref">{week.verse_reference} · Tap to practice →</div>
      </Link>

      <WeekPath weekId={week.id} days={week.days} />

      <Collapse label="What we talked about">{week.recap}</Collapse>

      <Link href="/parents" className="linkrow">
        For parents →
      </Link>
    </StudentScreen>
  );
}
