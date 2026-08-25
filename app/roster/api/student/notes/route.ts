import { NextResponse } from "next/server";
import { kvGet, kvList, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

// Quick notes a leader jots about a student — "asked about baptism", "moved
// houses". Distinct from the hangout log next door, which records a specific
// meeting on a specific date; these are the running observations that used to
// have nowhere to go but the sheet's single NOTES cell.
//
// That cell (column J) is still read and shown, pinned above this list. It just
// isn't written here — one shared cell can't hold a per-author history, and
// two leaders typing into it at once would overwrite each other.
//
// Keyed by the student's stable sheet ID (column K), not by their position in
// the roster, for the same reason the hangout log is: adding or deleting any
// student shifts every later index by one and would silently re-file one
// student's notes onto another.

export type Note = {
  id: string;
  text: string;
  leader?: string;
  leaderEmail?: string;
  createdAt?: string;
  updatedAt?: string;
};

function keyFor(sk: string, id: string): string {
  return `notes:${sk}:${id}`;
}

export async function GET(request: Request) {
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const id = url.searchParams.get("id");
  if (!sk) return NextResponse.json({ error: "sk is required" }, { status: 400 });

  // No id: an id -> count map for the whole tab, so the roster load can ask
  // once per tab rather than once per card. Same shape the hangout log uses.
  if (!id) {
    const prefix = `notes:${sk}:`;
    const { keys } = await kvList(prefix);
    const entries = await Promise.all(
      keys.map(async ({ name }) => {
        const notes = await kvGet<Note[]>(name);
        return [name.slice(prefix.length), (notes || []).length] as const;
      })
    );
    return NextResponse.json({ counts: Object.fromEntries(entries) });
  }

  const data = await kvGet<Note[]>(keyFor(sk, id));
  return NextResponse.json({ notes: data || [] });
}

export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id } = body;
  if (!sk || !id) return NextResponse.json({ error: "sk and id are required" }, { status: 400 });

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "A note can't be empty" }, { status: 400 });

  // Authorship is taken from the session, never from the request body — it's
  // what the edit/delete ownership check below reads.
  const note: Note = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    leader: user.name || "Someone",
    leaderEmail: user.email || undefined,
    createdAt: new Date().toISOString(),
  };

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Note[]>(kvKey)) || [];
  existing.push(note);
  await kvPut(kvKey, existing);

  return NextResponse.json({ success: true, note });
}

export async function PUT(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id, noteId } = body;
  if (!sk || !id || !noteId) return NextResponse.json({ error: "sk, id and noteId are required" }, { status: 400 });

  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "A note can't be empty" }, { status: 400 });

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Note[]>(kvKey)) || [];
  const noteIndex = existing.findIndex((n) => n.id === noteId);
  if (noteIndex === -1) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const note = existing[noteIndex];
  if (user.role !== "admin" && note.leaderEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  existing[noteIndex] = { ...note, text, updatedAt: new Date().toISOString() };
  await kvPut(kvKey, existing);

  return NextResponse.json({ success: true, note: existing[noteIndex] });
}

export async function DELETE(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id, noteId } = body;
  if (!sk || !id || !noteId) return NextResponse.json({ error: "sk, id and noteId are required" }, { status: 400 });

  const kvKey = keyFor(sk, id);
  const existing = (await kvGet<Note[]>(kvKey)) || [];
  const note = existing.find((n) => n.id === noteId);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  if (user.role !== "admin" && note.leaderEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await kvPut(kvKey, existing.filter((n) => n.id !== noteId));

  return NextResponse.json({ success: true });
}
