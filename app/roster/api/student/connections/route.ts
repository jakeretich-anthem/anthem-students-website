import { NextResponse } from "next/server";
import { kvGet, kvList, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

// Every time a leader connects with a student's family, a dated row lands here.
//
// Column B of the sheet ("Last connection date") only ever holds the most
// recent one, because a spreadsheet cell can hold exactly one date — so the
// history it overwrote each time was simply lost. The sheet stays the source
// of truth for "when was the last one" (the Apps Script stamps it on an
// OFF -> ON flip, and other tooling reads that column); this store keeps the
// full log behind it, so a leader can see and correct the individual days.
//
// Keyed by the student's stable sheet ID (column K), never by row position —
// see the note in ../notes/route.ts for what happened the two times a store
// here was keyed by index instead.

export type Connection = {
  id: string;
  date: string; // YYYY-MM-DD, the day the family was actually connected with
  note?: string;
  leader?: string;
  leaderEmail?: string;
  createdAt?: string;
  updatedAt?: string;
};

function keyFor(sk: string, id: string): string {
  return `connections:${sk}:${id}`;
}

// The log is the authority on "when was the last connection", so this is what
// the roster reads back after every write. Dates are YYYY-MM-DD, which sorts
// lexicographically, so no parsing is needed to find the newest.
function latestDate(list: Connection[]): string {
  return list.reduce((newest, c) => (c.date && c.date > newest ? c.date : newest), "");
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// A typo'd year ("0225") would sort as the oldest connection ever recorded and
// quietly make a student look overdue forever, so the shape is checked here
// rather than trusted from the date picker that normally produces it.
function readDate(value: unknown): string | null {
  const date = typeof value === "string" ? value.trim() : "";
  if (!DATE_RE.test(date)) return null;
  return Number.isNaN(new Date(date + "T00:00:00").getTime()) ? null : date;
}

function sorted(list: Connection[]): Connection[] {
  return [...list].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

export async function GET(request: Request) {
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const id = url.searchParams.get("id");
  if (!sk) return NextResponse.json({ error: "sk is required" }, { status: 400 });

  // No id: an id -> latest-date map for the whole tab, asked once per tab on
  // load. The roster needs every student's last connection date to work out
  // who has gone stale, and one request per card would be 60+ of them.
  if (!id) {
    const prefix = `connections:${sk}:`;
    const { keys } = await kvList(prefix);
    const entries = await Promise.all(
      keys.map(async ({ name }) => {
        const list = (await kvGet<Connection[]>(name)) || [];
        return [name.slice(prefix.length), { latest: latestDate(list), count: list.length }] as const;
      })
    );
    return NextResponse.json({ latest: Object.fromEntries(entries) });
  }

  const data = (await kvGet<Connection[]>(keyFor(sk, id))) || [];
  return NextResponse.json({ connections: sorted(data), latest: latestDate(data) });
}

export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id } = body;
  if (!sk || !id) return NextResponse.json({ error: "sk and id are required" }, { status: 400 });

  const date = readDate(body.date);
  if (!date) return NextResponse.json({ error: "A connection needs a valid date" }, { status: 400 });

  const connection: Connection = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    note: typeof body.note === "string" ? body.note.trim() : "",
    // Taken from the session, never from the body — this is a record of who
    // actually made the contact.
    leader: user.name || "Someone",
    leaderEmail: user.email || undefined,
    createdAt: new Date().toISOString(),
  };

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Connection[]>(kvKey)) || [];
  existing.push(connection);
  await kvPut(kvKey, existing);

  // Same flat, timestamp-keyed log the hangout feed writes to (see
  // api/student/interactions) — the Activity tab reads across every type.
  const studentName = typeof body.studentName === "string" ? body.studentName : "";
  const actKey = `activity:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  await kvPut(
    actKey,
    { type: "connection", leader: connection.leader, leaderEmail: connection.leaderEmail, date: connection.date, summary: connection.note || "", studentName, sk, id, createdAt: connection.createdAt },
    90 * 24 * 60 * 60
  );

  return NextResponse.json({ success: true, connection, latest: latestDate(existing) });
}

// Unlike a note, a connection isn't one leader's writing — it's the ministry's
// record that this family was reached on this day. Anyone who can edit the
// roster can correct a wrong date, so there's no author check here.
export async function PUT(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const { sk, id, connectionId } = body;
  if (!sk || !id || !connectionId) {
    return NextResponse.json({ error: "sk, id and connectionId are required" }, { status: 400 });
  }

  const date = readDate(body.date);
  if (!date) return NextResponse.json({ error: "A connection needs a valid date" }, { status: 400 });

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Connection[]>(kvKey)) || [];
  const index = existing.findIndex((c) => c.id === connectionId);
  if (index === -1) return NextResponse.json({ error: "Connection not found" }, { status: 404 });

  existing[index] = {
    ...existing[index],
    date,
    note: typeof body.note === "string" ? body.note.trim() : existing[index].note || "",
    updatedAt: new Date().toISOString(),
  };
  await kvPut(kvKey, existing);

  return NextResponse.json({ success: true, connection: existing[index], latest: latestDate(existing) });
}

export async function DELETE(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const { sk, id, connectionId } = body;
  if (!sk || !id || !connectionId) {
    return NextResponse.json({ error: "sk, id and connectionId are required" }, { status: 400 });
  }

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Connection[]>(kvKey)) || [];
  if (!existing.some((c) => c.id === connectionId)) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  const updated = existing.filter((c) => c.id !== connectionId);
  await kvPut(kvKey, updated);

  return NextResponse.json({ success: true, latest: latestDate(updated) });
}
