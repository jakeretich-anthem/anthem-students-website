import StudentScreen from "../components/StudentScreen";
import TrackView from "../components/TrackView";
import { getEvents, getMenuSummary } from "../lib/data";

function eventDateParts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    weekday: d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

export default async function EventsPage() {
  const [events, menu] = await Promise.all([getEvents(), getMenuSummary()]);

  return (
    <StudentScreen appbar={{ mode: "home", label: "Events" }} menu={menu}>
      <TrackView event="events_view" />
      <h1 className="sr-only">Events</h1>
      <div className="sectionhead">
        <span>Next 60 days</span>
      </div>

      {events.length === 0 ? (
        <div className="emptystate">
          <div className="kicker">Nothing on the calendar yet</div>
          <p>Check back soon — upcoming dates will show up here.</p>
        </div>
      ) : (
        <div className="list">
          {events.map((evt) => {
            const { weekday, day, month } = eventDateParts(evt.event_date);
            const meta = [evt.time_label, evt.location].filter(Boolean).join(" · ");
            return (
              <div className="evt" key={evt.id}>
                {evt.image_url && (
                  // Flat card above the scanlines, same rule as scripture:
                  // chrome carries the retro treatment, content doesn't.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className="evtimg" src={evt.image_url} alt="" />
                )}
                <div className="evtdate">
                  <span className="evtdow">{weekday}</span>
                  <b>{day}</b>
                  <span>{month}</span>
                </div>
                <div className="evt-body">
                  <h3>{evt.title}</h3>
                  {meta && <p className="evt-meta">{meta}</p>}
                  {evt.detail && <p className="evt-detail">{evt.detail}</p>}
                  {evt.signup_url && (
                    <a className="evt-signup" href={evt.signup_url} target="_blank" rel="noreferrer">
                      Sign up →
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </StudentScreen>
  );
}
