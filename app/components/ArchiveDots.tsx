"use client";

import { useEffect, useState } from "react";

export default function ArchiveDots({ weekId, dayNumbers }: { weekId: number; dayNumbers: number[] }) {
  const [doneSet, setDoneSet] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const next = new Set<number>();
      for (const n of dayNumbers) {
        if (localStorage.getItem(`anthemDayDone-${weekId}-${n}`) === "true") next.add(n);
      }
      setDoneSet(next);
    } catch {
      // localStorage unavailable — dots just show nothing completed
    }
  }, [weekId, dayNumbers]);

  return (
    <span className="dots">
      {dayNumbers.map((n) => (
        <i key={n} className={doneSet.has(n) ? "on" : ""} />
      ))}
    </span>
  );
}
