import StudentScreen from "../components/StudentScreen";
import VerseTrainer from "./VerseTrainer";
import TrackView from "../components/TrackView";
import { getCurrentWeek, getMenuSummary } from "../lib/data";

export default async function VersePage() {
  const [week, menu] = await Promise.all([getCurrentWeek(), getMenuSummary()]);

  if (!week) {
    return (
      <StudentScreen appbar={{ mode: "back", href: "/", label: "This week", step: "Memory verse" }} menu={menu}>
        <div className="emptystate">
          <div className="kicker">No verse yet</div>
          <p>A memory verse shows up here as soon as a week is published.</p>
        </div>
      </StudentScreen>
    );
  }

  return (
    <>
      <TrackView event="verse_practice" weekId={week.id} />
      <VerseTrainer reference={week.verse_reference} text={week.verse_text} menu={menu} />
    </>
  );
}
