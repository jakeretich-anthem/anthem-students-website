"use client";

import { useEffect, useState } from "react";

export default function ArchiveDayStatus({ weekId, dayNumber }: { weekId: number; dayNumber: number }) {
  const [done, setDone] = useState(false);

  useEffect(() => {
    try {
      setDone(localStorage.getItem(`anthemDayDone-${weekId}-${dayNumber}`) === "true");
    } catch {
      // localStorage unavailable — status just won't be known this visit
    }
  }, [weekId, dayNumber]);

  return (
    <span className="chev" style={done ? { color: "#3dffa0" } : undefined}>
      {done ? "✓" : "›"}
    </span>
  );
}
