import Link from "next/link";
import StudentScreen from "../components/StudentScreen";
import { getArchiveSeries, getCurrentWeek, getMenuSummary, formatShortDate } from "../lib/data";

export default async function ArchivePage() {
  const [series, current, menu] = await Promise.all([getArchiveSeries(), getCurrentWeek(), getMenuSummary()]);

  if (series.length === 0) {
    return (
      <StudentScreen appbar={{ mode: "home", label: "Past Weeks" }} menu={menu}>
        <div className="emptystate">
          <div className="kicker">Nothing in the archive yet</div>
          <p>Past weeks show up here once they&rsquo;ve been published — none have gone out yet.</p>
        </div>
      </StudentScreen>
    );
  }

  return (
    <StudentScreen appbar={{ mode: "home", label: "Past Weeks" }} menu={menu}>
      {series.map((s, si) => (
        <div key={s.name}>
          <div className="tape">Series: {s.name}</div>
          <div className="rule" />
          {s.weeks.map((w) => {
            const isCurrent = current?.id === w.id;
            const effectiveDate = w.scheduled_publish_at ?? w.published_at;
            return (
              <Link className="arch" href={isCurrent ? "/" : `/archive/${w.id}`} key={w.id}>
                <span className="archnum">W{w.series_week_number}</span>
                <div>
                  <h5>{w.title}</h5>
                  <p>
                    {w.verse_reference}
                    {effectiveDate ? ` · ${formatShortDate(effectiveDate)}` : ""}
                  </p>
                </div>
                {isCurrent ? (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontFamily: "var(--mono)",
                      fontSize: 9.5,
                      letterSpacing: ".12em",
                      textTransform: "uppercase",
                      color: "#3dffa0",
                      flex: "none",
                    }}
                  >
                    This week
                  </span>
                ) : (
                  <span className="chev" style={{ marginLeft: "auto" }}>
                    ›
                  </span>
                )}
              </Link>
            );
          })}
          {si < series.length - 1 && <div style={{ height: 18 }} />}
        </div>
      ))}
    </StudentScreen>
  );
}
