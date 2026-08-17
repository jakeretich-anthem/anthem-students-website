import ParentScreen from "../components/ParentScreen";
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
      <div className="card">
        <div className="parentsub" style={{ marginBottom: 7 }}>
          What we covered
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "#d3d8e3" }}>{week.recap}</p>
      </div>

      {week.heads_up && (
        <>
          <div style={{ height: 11 }} />
          <div className="callout">
            <div className="clabel">⚑ Heads up</div>
            <p>{week.heads_up}</p>
          </div>
        </>
      )}

      {week.starters.length > 0 && (
        <>
          <div style={{ height: 13 }} />
          <div className="parentsub">Three ways in</div>
          {week.starters.map((starter, i) => (
            <div className="starter" key={starter}>
              <b>{String(i + 1).padStart(2, "0")}</b>
              <p>{starter}</p>
            </div>
          ))}
        </>
      )}

      <div style={{ height: 13 }} />

      <div className="card" style={{ borderColor: "rgba(201,169,97,.28)" }}>
        <div className="parentsub" style={{ marginBottom: 6 }}>
          Their verse this week
        </div>
        <p style={{ fontSize: 16, color: "#fff", fontWeight: 500, lineHeight: 1.45 }}>&ldquo;{week.verse_text}&rdquo;</p>
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: "var(--gold)",
            marginTop: 7,
            letterSpacing: ".14em",
          }}
        >
          {week.verse_reference.toUpperCase()}
        </p>
      </div>
    </ParentScreen>
  );
}
