import Link from "next/link";
import StudentScreen from "../components/StudentScreen";
import { archive } from "../data/content";

export default function ArchivePage() {
  return (
    <StudentScreen appbar={{ mode: "home", label: "Past Weeks" }}>
      {archive.map((series, si) => (
        <div key={series.name}>
          <div className="tape">Series: {series.name}</div>
          <div className="rule" />
          {series.weeks.map((w) => (
            <Link className="arch" href={w.isCurrent ? "/" : `/archive/${w.id}`} key={w.id}>
              <span className="archnum">{w.weekLabel}</span>
              <div>
                <h5>{w.title}</h5>
                <p>
                  {w.passage} · {w.date}
                  {w.progress ? ` · ${w.progress}` : ""}
                </p>
              </div>
              <span className="chev" style={{ marginLeft: "auto", color: w.complete ? "#3dffa0" : undefined }}>
                {w.complete ? "✓" : "›"}
              </span>
            </Link>
          ))}
          {si < archive.length - 1 && <div style={{ height: 18 }} />}
        </div>
      ))}
    </StudentScreen>
  );
}
