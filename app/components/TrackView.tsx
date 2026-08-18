"use client";

import { useEffect, useRef } from "react";
import type { AnalyticsEventType } from "../lib/analyticsEvents";

const ANON_KEY = "anthemAnonId";

// A random token in localStorage, generated on the device, never sent
// anywhere but the analytics route and never paired with anything that
// identifies a person. It exists so one student refreshing a page counts
// as one open instead of five (SPEC §3) — that is its entire job.
function anonId(): string | null {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id || !/^[a-z0-9]{8,64}$/.test(id)) {
      id = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    // No localStorage (private mode, storage disabled) — the view still
    // counts, it just can't be deduped against this student's other visits.
    return null;
  }
}

export function trackEvent(eventType: AnalyticsEventType, weekId?: number | null, dayNumber?: number | null) {
  const body = JSON.stringify({
    event_type: eventType,
    week_id: weekId ?? null,
    day_number: dayNumber ?? null,
    anon_id: anonId(),
  });

  try {
    // keepalive so the beacon still goes out if the student taps straight
    // through to the next screen.
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Analytics never breaks a page.
  }
}

export default function TrackView({
  event,
  weekId,
  dayNumber,
}: {
  event: AnalyticsEventType;
  weekId?: number | null;
  dayNumber?: number | null;
}) {
  // React runs effects twice in dev StrictMode, and re-renders shouldn't
  // re-log a view either — one mount is one open.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    trackEvent(event, weekId, dayNumber);
  }, [event, weekId, dayNumber]);

  return null;
}
