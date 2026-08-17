import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

type Interaction = { id: string; leaderEmail?: string; [key: string]: unknown };

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const section = url.searchParams.get("section");
  const index = url.searchParams.get("index");
  const key = `interactions:${sk}:${section}:${index}`;
  const data = await kvGet<Interaction[]>(key);
  return NextResponse.json({ interactions: data || [] });
}

export async function POST(request: Request) {
  const perm = await requirePermission("hangoutNotes", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const { sk, section, index, interaction, rowIndex, studentName } = body;

  const kvKey = `interactions:${sk}:${section}:${index}`;
  const existing = (await kvGet<Interaction[]>(kvKey)) || [];
  existing.push(interaction);
  await kvPut(kvKey, existing);

  const actKey = `activity:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  await kvPut(actKey, { ...interaction, studentName: studentName || "", sk, section, index, rowIndex }, 90 * 24 * 60 * 60);

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
  const { sk, section, index, interactionId, changes, rowIndex } = body;

  const kvKey = `interactions:${sk}:${section}:${index}`;
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
  const { sk, section, index, interactionId, rowIndex } = body;

  const kvKey = `interactions:${sk}:${section}:${index}`;
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
