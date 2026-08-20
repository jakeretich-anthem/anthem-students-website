import ParentScreen from "../components/ParentScreen";
import TrackView from "../components/TrackView";
import { getCurrentWeek, getMenuSummary, formatShortDate } from "../lib/data";

export default async function ParentsPage() {
  const [week, menu] = await Promise.all([getCurrentWeek(), getMenuSummary()]);

  if (!week) {
    return (
      <ParentScreen eyebrow="Parent guide" title="No guide yet" menu={menu}>
        <div className="emptystate">
          <div className="kicker">Nothing published yet</div>
          <p>A new guide goes out every week the students get new content — check back after Wednesday night.</p>
        </div>
      </ParentScreen>
    );
  }

  const effectiveDate = week.scheduled_publish_at ?? week.published_at;

  return (
    <ParentScreen
      eyebrow="Parent guide"
      title={effectiveDate ? `Week of ${formatShortDate(effectiveDate)}` : week.title}
      menu={menu}
    >
      <TrackView event="parent_guide_view" weekId={week.id} />
      <section className="card">
        <h2 className="parent-sectionhead">What we covered</h2>
        <p className="parent-recap">{week.recap}</p>
      </section>

      {week.heads_up && (
        <section className="callout">
          <h2 className="clabel">⚑ Heads up</h2>
          <p>{week.heads_up}</p>
        </section>
      )}

      {week.starters.length > 0 && (
        <section className="stack snug">
          <h2 className="parent-sectionhead">Three ways in</h2>
          <div className="list flush">
            {week.starters.map((starter, i) => (
              <div className="starter" key={starter}>
                <b>{String(i + 1).padStart(2, "0")}</b>
                <p>{starter}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card parent-versecard">
        <h2 className="parent-sectionhead">Their verse this week</h2>
        <p className="parent-versetext">&ldquo;{week.verse_text}&rdquo;</p>
        <p className="parent-verseref">{week.verse_reference.toUpperCase()}</p>
      </section>
    </ParentScreen>
  );
}
