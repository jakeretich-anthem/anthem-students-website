import Link from "next/link";
import StudentScreen from "../components/StudentScreen";
import TrackView from "../components/TrackView";
import { getArchiveSeries, getCurrentWeek, getMenuSummary, formatShortDate } from "../lib/data";

export default async function ArchivePage() {
  const [series, current, menu] = await Promise.all([getArchiveSeries(), getCurrentWeek(), getMenuSummary()]);

  if (series.length === 0) {
    return (
      <StudentScreen appbar={{ mode: "home", label: "Past Weeks" }} menu={menu}>
        <div className="emptystate">
          <h1 className="kicker">Nothing in the archive yet</h1>
          <p>Past weeks show up here once they&rsquo;ve been published — none have gone out yet.</p>
        </div>
      </StudentScreen>
    );
  }

  return (
    <StudentScreen appbar={{ mode: "home", label: "Past Weeks" }} menu={menu}>
      <TrackView event="archive_view" />
      <h1 className="sr-only">Past weeks</h1>
      {series.map((s) => (
        <section className="stack snug" key={s.name}>
          <h2 className="sectionhead">Series: {s.name}</h2>
          <div className="list flush">
            {s.weeks.map((w) => {
              const isCurrent = current?.id === w.id;
              const effectiveDate = w.scheduled_publish_at ?? w.published_at;
              return (
                <Link className="arch" href={isCurrent ? "/" : `/archive/${w.id}`} key={w.id}>
                  <span className="archnum">W{w.series_week_number}</span>
                  <div>
                    <h3>{w.title}</h3>
                    <p>
                      {w.verse_reference}
                      {effectiveDate ? ` · ${formatShortDate(effectiveDate)}` : ""}
                    </p>
                  </div>
                  {isCurrent ? (
                    <span className="arch-badge">This week</span>
                  ) : (
                    <span className="chev" style={{ marginLeft: "auto" }}>
                      ›
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </StudentScreen>
  );
}
