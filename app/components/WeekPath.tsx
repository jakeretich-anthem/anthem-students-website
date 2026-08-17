"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { DbDay } from "../lib/data";

export default function WeekPath({ weekId, days }: { weekId: number; days: DbDay[] }) {
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const next = new Set<number>();
      for (const d of days) {
        if (localStorage.getItem(`anthemDayDone-${weekId}-${d.day_number}`) === "true") next.add(d.day_number);
      }
      setDoneSet(next);
    } catch {
      // localStorage unavailable — path just shows nothing completed yet
    }
  }, [weekId, days]);

  return (
    <>
      <div className="pathhead">
        <span className="tape" style={{ color: "var(--ice)" }}>
          Your week
        </span>
        <span className="dots">
          {days.map((d) => (
            <i key={d.day_number} className={doneSet.has(d.day_number) ? "on" : ""} />
          ))}
        </span>
      </div>

      {days.map((d, i) => {
        const done = doneSet.has(d.day_number);
        const isNext = !done && !days.slice(0, i).some((prior) => !doneSet.has(prior.day_number));
        return (
          <Link
            key={d.day_number}
            href={`/day/${d.day_number}`}
            className={`daycard${done ? " done" : ""}${isNext ? " next" : ""}`}
          >
            <span className="daynum">DAY {d.day_number}</span>
            <div>
              <div className="daytitle">{d.title}</div>
              <div className="daysub">
                {done
                  ? `Done · ${d.passage_reference.replace(" · WEB", "")}`
                  : d.passage_reference.replace(" · WEB", "")}
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
