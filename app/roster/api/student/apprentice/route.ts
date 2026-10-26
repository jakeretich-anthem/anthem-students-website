import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";
import { logActivity } from "../../../lib/activity";

// Marks a student as a student apprentice. Lives in roster_kv under
// `apprentice:{sk}:{id}` — keyed by the stable sheet ID like goals and
// mentors, present only while the student is one. The roster gets everyone's
// flag at once from /roster/api/bootstrap.

type Apprentice = { since: string; by: string };

function keyFor(sk: unknown, id: unknown): string | null {
  if ((sk !== "hs" && sk !== "ms") || typeof id !== "string" || !id) return null;
  return `apprentice:${sk}:${id}`;
}

async function setFlag(key: string, on: boolean, by: string): Promise<boolean> {
  const existing = await kvGet<Apprentice>(key);
  if (on === !!existing) return false;
  if (on) await kvPut(key, { since: new Date().toISOString(), by } satisfies Apprentice);
  else await kvDelete(key);
  return true;
}

export async function PUT(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const key = keyFor(body.sk, body.id);
  if (!key) return NextResponse.json({ error: "sk and id are required" }, { status: 400 });
  const on = body.apprentice === true;

  const changed = await setFlag(key, on, perm.user.email || perm.user.name);
  if (changed) {
    await logActivity(perm.user, {
      type: "apprentice_changed",
      summary: on ? "Marked as a student apprentice" : "No longer a student apprentice",
      studentName: typeof body.studentName === "string" ? body.studentName : "",
      sk: body.sk,
      id: body.id,
    });
  }
  return NextResponse.json({ success: true, apprentice: on });
}

// Bulk mark/unmark from the roster's multi-select.
export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const on = body.apprentice === true;
  const targets = Array.isArray(body.students) ? (body.students as { sk: unknown; id: unknown }[]) : [];
  if (!targets.length || targets.length > 500) {
    return NextResponse.json({ error: "students must be a non-empty list" }, { status: 400 });
  }

  const updated: string[] = [];
  let changed = 0;
  for (const t of targets) {
    const key = keyFor(t.sk, t.id);
    if (!key) continue;
    if (await setFlag(key, on, perm.user.email || perm.user.name)) changed++;
    updated.push(`${t.sk}:${t.id}`);
  }

  if (changed) {
    await logActivity(perm.user, {
      type: "apprentice_bulk",
      summary: `${on ? "Marked" : "Unmarked"} ${changed} student${changed === 1 ? "" : "s"} as apprentice${changed === 1 ? "" : "s"}`,
    });
  }
  return NextResponse.json({ success: true, apprentice: on, updated });
}
