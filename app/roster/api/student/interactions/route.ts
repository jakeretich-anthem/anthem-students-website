import { NextResponse } from "next/server";
import { kvGet, kvList, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

// Hangout notes are keyed by the student's stable sheet ID (column K), not by
// their position in the roster. The key used to be
// `interactions:{sk}:{section}:{index}`, which broke twice over: changing a
// student's Connection Status moved them to a different section and orphaned
// their notes, and deleting any student shifted every later student's index by
// one, silently re-filing their notes onto the wrong person.

type Interaction = { id: string; leaderEmail?: string; [key: string]: unknown };

export async function GET(request: Request) {
  // Pastoral notes about minors. Reading them was unauthenticated until this
  // commit (IMP-06) even though every write path here was already gated.
  const perm = await requirePermission("hangoutNotes", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const id = url.searchParams.get("id");
  if (!sk) return NextResponse.json({ error: "sk is required" }, { status: 400 });

  // No id: return an id -> count map for the whole tab. The roster's "Most
  // interactions" sort used to read a column the Apps Script maintained; that
  // column is gone from the sheet, so the count comes from here now.
  if (!id) {
    const prefix = `interactions:${sk}:`;
    const { keys } = await kvList(prefix);
    const entries = await Promise.all(
      keys.map(async ({ name }) => {
        const notes = await kvGet<Interaction[]>(name);
        return [name.slice(prefix.length), (notes || []).length] as const;
      })
    );
    return NextResponse.json({ counts: Object.fromEntries(entries) });
  }

  const data = await kvGet<Interaction[]>(`interactions:${sk}:${id}`);
  return NextResponse.json({ interactions: data || [] });
}

export async function POST(request: Request) {
  const perm = await requirePermission("hangoutNotes", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const { sk, id, interaction, rowIndex, studentName } = body;

  const kvKey = `interactions:${sk}:${id}`;
  const existing = (await kvGet<Interaction[]>(kvKey)) || [];
  existing.push(interaction);
  await kvPut(kvKey, existing);

  const actKey = `activity:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  await kvPut(actKey, { ...interaction, studentName: studentName || "", sk, id, rowIndex }, 90 * 24 * 60 * 60);

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (scriptUrl && rowIndex !== undefined) {
    const params = new URLSearchParams({ action: "addInteraction", payload: JSON.stringify({ sheet: sk, rowIndex, interaction }) });
    fetch(scriptUrl + "?" + params).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

export async function PUT(request: Request) {
  const perm = await requirePermission("hangoutNotes", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id, interactionId, changes, rowIndex } = body;

  const kvKey = `interactions:${sk}:${id}`;
  const existing = (await kvGet<Interaction[]>(kvKey)) || [];
  const noteIndex = existing.findIndex((n) => n.id === interactionId);
  if (noteIndex === -1) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  const note = existing[noteIndex];
  if (user.role !== "admin" && note.leaderEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  existing[noteIndex] = { ...note, ...changes, updatedAt: new Date().toISOString() };
  await kvPut(kvKey, existing);

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (scriptUrl && rowIndex !== undefined) {
    const params = new URLSearchParams({ action: "updateInteraction", payload: JSON.stringify({ sheet: sk, rowIndex, interactionId, changes }) });
    fetch(scriptUrl + "?" + params).catch(() => {});
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
  const perm = await requirePermission("hangoutNotes", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  const user = perm.user;

  const body = await request.json();
  const { sk, id, interactionId, rowIndex } = body;

  const kvKey = `interactions:${sk}:${id}`;
  const existing = (await kvGet<Interaction[]>(kvKey)) || [];
  const note = existing.find((n) => n.id === interactionId);
  if (!note) return NextResponse.json({ error: "Note not found" }, { status: 404 });

  if (user.role !== "admin" && note.leaderEmail !== user.email) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = existing.filter((n) => n.id !== interactionId);
  await kvPut(kvKey, updated);

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (scriptUrl && rowIndex !== undefined) {
    const params = new URLSearchParams({ action: "deleteInteraction", payload: JSON.stringify({ sheet: sk, rowIndex, interactionId }) });
    fetch(scriptUrl + "?" + params).catch(() => {});
  }

  return NextResponse.json({ success: true });
}
