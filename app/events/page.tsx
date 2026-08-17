import StudentScreen from "../components/StudentScreen";
import { events } from "../data/content";

export default function EventsPage() {
  return (
    <StudentScreen appbar={{ mode: "home", label: "Events" }}>
      <div className="tape">Next 60 days</div>
      <div className="rule" />

      {events.map((evt) => (
        <div className="evt" key={evt.title}>
          <div className="evtdate">
            <b>{evt.day}</b>
            <span>{evt.month}</span>
          </div>
          <div>
            <h5>{evt.title}</h5>
            <p>
              {evt.timeLabel} · {evt.location}
              <br />
              {evt.detail}
            </p>
          </div>
        </div>
      ))}

      <div style={{ height: 6 }} />

      <a className="btn primary" href="#" target="_blank" rel="noreferrer">
        Sign up for the retreat
      </a>

      <div style={{ height: 9 }} />

      <button className="card" style={{ width: "100%", textAlign: "center" }}>
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 10,
            letterSpacing: ".14em",
            color: "var(--ash)",
            textTransform: "uppercase",
          }}
        >
          Add all to your calendar
        </div>
      </button>
    </StudentScreen>
  );
}
