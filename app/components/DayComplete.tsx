"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function DayComplete({ weekId, dayNumber }: { weekId: number; dayNumber: number }) {
  const [done, setDone] = useState(false);
  const doneKey = `anthemDayDone-${weekId}-${dayNumber}`;

  useEffect(() => {
    try {
      setDone(localStorage.getItem(doneKey) === "true");
    } catch {
      // localStorage unavailable — completion just won't persist this visit
    }
  }, [doneKey]);

  function markDone() {
    setDone(true);
    try {
      localStorage.setItem(doneKey, "true");
    } catch {
      // localStorage unavailable
    }
  }

  return done ? (
    <Link href="/" className="btn ghost">
      Done · back to this week →
    </Link>
  ) : (
    <button className="btn primary" onClick={markDone}>
      I&rsquo;m done →
    </button>
  );
}
