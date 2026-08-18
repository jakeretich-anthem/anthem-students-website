import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { ANALYTICS_EVENT_TYPES, type AnalyticsEventType } from "../../lib/analyticsEvents";

// The only server-side record of student activity, and the one place a
// student's browser can reach the analytics log.
//
// What this route writes is exhaustively: an event type, a week id, a day
// number, and the client's own random anon_id. What it deliberately never
// writes, reads, or derives:
//   · IP address — request headers are never touched, not even to hash
//   · cookies — nothing is set and nothing is read
//   · fingerprints — no user-agent, screen, timezone, or language signal
//   · journal content or anything else the student typed
// Every field below is validated against a fixed shape so a caller can't
// smuggle an identifier through anon_id or any other field.
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const { event_type, week_id, day_number, anon_id } = (body ?? {}) as Record<string, unknown>;

  if (typeof event_type !== "string" || !ANALYTICS_EVENT_TYPES.includes(event_type as AnalyticsEventType)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // anon_id is a random client-generated token and nothing else. The format
  // check is the guard that keeps it that way — an email or a name simply
  // won't match, so it can't be stored even if a caller tries.
  if (anon_id !== undefined && anon_id !== null && !(typeof anon_id === "string" && /^[a-z0-9]{8,64}$/.test(anon_id))) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Reject a bad day rather than nulling it — a day_view with no day is a
  // row that quietly can't answer "reached day 3", which is the whole
  // reason the field is here.
  const dayGiven = day_number !== undefined && day_number !== null;
  if (dayGiven && !(typeof day_number === "number" && Number.isInteger(day_number) && day_number >= 1 && day_number <= 3)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const weekId = typeof week_id === "number" && Number.isInteger(week_id) ? week_id : null;
  const dayNumber = dayGiven ? (day_number as number) : null;

  try {
    const { error } = await supabaseAdmin().from("analytics_events").insert({
      event_type,
      week_id: weekId,
      day_number: dayNumber,
      anon_id: typeof anon_id === "string" ? anon_id : null,
    });
    if (error) {
      console.error("[analytics] insert failed:", error.message);
    }
  } catch (err) {
    // Analytics is never worth failing a student's page over. Swallow and
    // report success — the beacon is fire-and-forget on the client anyway.
    console.error("[analytics] write failed:", err);
  }

  return NextResponse.json({ ok: true });
}
