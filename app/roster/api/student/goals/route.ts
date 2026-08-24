import { NextResponse } from "next/server";
import { kvGet, kvList, kvPut } from "../../../lib/kv";
import { requirePermission } from "../../../lib/auth";

// Goals used to live in the sheet: the checkbox list was JSON-stringified into
// a "Goals" column and the primary goal sat in another. That column is gone,
// so both now live in roster_kv beside the hangout notes.
//
// Keyed by the student's stable sheet ID (column K), not by their position in
// the roster. Position changes every time a student is added or removed above
// them, which would silently re-file one student's goals onto another.

export type Goal = { text: string; done: boolean; primary?: boolean; createdAt?: string };
export type StudentGoals = { primaryGoal: string; goals: Goal[] };

const EMPTY: StudentGoals = { primaryGoal: "", goals: [] };

function keyFor(sk: string | null, id: string | null): string | null {
  if (!sk || !id) return null;
  return `goals:${sk}:${id}`;
}

export async function GET(request: Request) {
  // Unauthenticated until this commit (IMP-06). Reading is "view" rather than
  // the "edit" the PUT below requires, so a viewer session can still see goals.
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const url = new URL(request.url);
  const sk = url.searchParams.get("sk");
  const id = url.searchParams.get("id");
  if (!sk) return NextResponse.json({ error: "sk is required" }, { status: 400 });

  // No id: return every student's goals for this tab as an id -> goals map.
  // The roster cards each show a goal progress bar, so the alternative is one
  // request per student on every load.
  if (!id) {
    const prefix = `goals:${sk}:`;
    const { keys } = await kvList(prefix);
    const entries = await Promise.all(
      keys.map(async ({ name }) => [name.slice(prefix.length), (await kvGet<StudentGoals>(name)) || EMPTY] as const)
    );
    return NextResponse.json(Object.fromEntries(entries));
  }

  const data = await kvGet<StudentGoals>(keyFor(sk, id)!);
  return NextResponse.json(data || EMPTY);
}

export async function PUT(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const key = keyFor(body.sk, body.id);
  if (!key) return NextResponse.json({ error: "sk and id are required" }, { status: 400 });

  await kvPut(key, {
    primaryGoal: typeof body.primaryGoal === "string" ? body.primaryGoal : "",
    goals: Array.isArray(body.goals) ? body.goals : [],
  } satisfies StudentGoals);

  return NextResponse.json({ success: true });
}
