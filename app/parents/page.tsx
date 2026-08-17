import ParentScreen from "../components/ParentScreen";
import { verse, week } from "../data/content";

export default function ParentsPage() {
  return (
    <ParentScreen eyebrow="Parent guide" title="Week of Aug 13">
      <div className="card">
        <div className="parentsub" style={{ marginBottom: 7 }}>
          What we covered
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.55, color: "#d3d8e3" }}>{week.recap}</p>
      </div>

      <div style={{ height: 11 }} />

      <div className="callout">
        <div className="clabel">⚑ Heads up</div>
        <p>{week.headsUp}</p>
      </div>

      <div style={{ height: 13 }} />

      <div className="parentsub">Three ways in</div>
      {week.starters.map((starter, i) => (
        <div className="starter" key={starter}>
          <b>{String(i + 1).padStart(2, "0")}</b>
          <p>{starter}</p>
        </div>
      ))}

      <div style={{ height: 13 }} />

      <div className="card" style={{ borderColor: "rgba(201,169,97,.28)" }}>
        <div className="parentsub" style={{ marginBottom: 6 }}>
          Their verse this week
        </div>
        <p style={{ fontSize: 16, color: "#fff", fontWeight: 500, lineHeight: 1.45 }}>&ldquo;{verse.text}&rdquo;</p>
        <p
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10.5,
            color: "var(--gold)",
            marginTop: 7,
            letterSpacing: ".14em",
          }}
        >
          {verse.reference.toUpperCase()}
        </p>
      </div>
    </ParentScreen>
  );
}
