import StudentScreen from "../components/StudentScreen";
import TrackView from "../components/TrackView";
import { getEvents, getMenuSummary } from "../lib/data";

function eventDateParts(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return {
    day: String(d.getUTCDate()).padStart(2, "0"),
    month: d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

export default async function EventsPage() {
  const [events, menu] = await Promise.all([getEvents(), getMenuSummary()]);

  return (
    <StudentScreen appbar={{ mode: "home", label: "Events" }} menu={menu}>
      <TrackView event="events_view" />
      <div className="tape">Next 60 days</div>
      <div className="rule" />

      {events.length === 0 ? (
        <div className="emptystate">
          <div className="kicker">Nothing on the calendar yet</div>
          <p>Check back soon — upcoming dates will show up here.</p>
        </div>
      ) : (
        events.map((evt) => {
          const { day, month } = eventDateParts(evt.event_date);
          return (
            <div className="evt" key={evt.id}>
              {evt.image_url && (
                // Flat card above the scanlines, same rule as scripture:
                // chrome carries the retro treatment, content doesn't.
                // eslint-disable-next-line @next/next/no-img-element
                <img className="evtimg" src={evt.image_url} alt="" />
              )}
              <div className="evtdate">
                <b>{day}</b>
                <span>{month}</span>
              </div>
              <div>
                <h5>{evt.title}</h5>
                <p>
                  {[evt.time_label, evt.location].filter(Boolean).join(" · ")}
                  {evt.detail ? (
                    <>
                      <br />
                      {evt.detail}
                    </>
                  ) : null}
                </p>
                {evt.signup_url && (
                  <a className="evt-signup" href={evt.signup_url} target="_blank" rel="noreferrer">
                    Sign up →
                  </a>
                )}
              </div>
            </div>
          );
        })
      )}
    </StudentScreen>
  );
}
