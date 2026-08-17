"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Day } from "../data/content";

export default function WeekPath({ days }: { days: Day[] }) {
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const next = new Set<number>();
      for (const d of days) {
        if (localStorage.getItem(`anthemDayDone${d.number}`) === "true") next.add(d.number);
      }
      setDoneSet(next);
    } catch {
      // localStorage unavailable — path just shows nothing completed yet
    }
  }, [days]);

  return (
    <>
      <div className="pathhead">
        <span className="tape" style={{ color: "var(--ice)" }}>
          Your week
        </span>
        <span className="dots">
          {days.map((d) => (
            <i key={d.number} className={doneSet.has(d.number) ? "on" : ""} />
          ))}
        </span>
      </div>

      {days.map((d, i) => {
        const done = doneSet.has(d.number);
        const isNext = !done && !days.slice(0, i).some((prior) => !doneSet.has(prior.number));
        return (
          <Link
            key={d.number}
            href={`/day/${d.number}`}
            className={`daycard${done ? " done" : ""}${isNext ? " next" : ""}`}
          >
            <span className="daynum">DAY {d.number}</span>
            <div>
              <div className="daytitle">{d.title}</div>
              <div className="daysub">
                {done
                  ? `Done · ${d.passageReference.replace(" · WEB", "")}`
                  : `${d.minutes} min · ${d.passageReference.replace(" · WEB", "")}`}
              </div>
            </div>
            <span className="chev" style={done ? { color: "#3dffa0" } : undefined}>
              {done ? "✓" : "›"}
            </span>
          </Link>
        );
      })}
    </>
  );
}
