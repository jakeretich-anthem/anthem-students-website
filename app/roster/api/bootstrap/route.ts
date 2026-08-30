import { NextResponse } from "next/server";
import { kvGetMap } from "../../lib/kv";
import { getSessionUser, hasPermission } from "../../lib/auth";

// Replaces five separate per-tab-pair fetches (goals, interaction counts,
// note counts, connection dates, photo crops — ten requests total, each
// re-checking session + permissions from scratch) with one request that
// checks auth once per module and reuses the same memoized session lookup
// (see the cache() wrapper on getSessionUser/getPermissionMatrix in
// lib/auth.ts) for the rest. Read-only; every write still goes through its
// own existing endpoint unchanged.

type Goal = { text: string; done: boolean; primary?: boolean; createdAt?: string };
type StudentGoals = { primaryGoal: string; goals: Goal[] };
type Interaction = { id: string; [key: string]: unknown };
type Note = { id: string; [key: string]: unknown };
type Connection = { id: string; date: string; [key: string]: unknown };
type PhotoCrop = { zoom: number; offX: number; offY: number };

function latestDate(list: Connection[]): string {
  return list.reduce((newest, c) => (c.date && c.date > newest ? c.date : newest), "");
}

const SKS = ["hs", "ms"] as const;

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const canSeeRoster = await hasPermission(user, "roster", "view");
  if (!canSeeRoster) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const canSeeNotes = await hasPermission(user, "hangoutNotes", "view");

  const [goals, noteCounts, connections, photoCrops, interactionCounts] = await Promise.all([
    Promise.all(SKS.map(async (sk) => [sk, await kvGetMap<StudentGoals>(`goals:${sk}:`)] as const)),
    Promise.all(SKS.map(async (sk) => [sk, await kvGetMap<Note[]>(`notes:${sk}:`)] as const)),
    Promise.all(SKS.map(async (sk) => [sk, await kvGetMap<Connection[]>(`connections:${sk}:`)] as const)),
    Promise.all(SKS.map(async (sk) => [sk, await kvGetMap<PhotoCrop>(`photoCrop:${sk}:`)] as const)),
    canSeeNotes
      ? Promise.all(SKS.map(async (sk) => [sk, await kvGetMap<Interaction[]>(`interactions:${sk}:`)] as const))
      : Promise.resolve(null),
  ]);

  const byTab = <T,>(pairs: readonly (readonly [string, Record<string, T | null>])[]) =>
    Object.fromEntries(pairs) as Record<(typeof SKS)[number], Record<string, T | null>>;

  const goalsByTab = byTab(goals);
  const noteCountsByTab: Record<string, Record<string, number>> = {};
  for (const [sk, map] of noteCounts) {
    noteCountsByTab[sk] = Object.fromEntries(Object.entries(map).map(([id, notes]) => [id, (notes || []).length]));
  }

  const connectionsByTab = byTab(connections);
  const connectionDatesByTab: Record<string, Record<string, { latest: string; count: number }>> = {};
  for (const [sk, map] of Object.entries(connectionsByTab)) {
    connectionDatesByTab[sk] = Object.fromEntries(
      Object.entries(map).map(([id, list]) => [id, { latest: latestDate(list || []), count: (list || []).length }])
    );
  }

  const photoCropsByTab = byTab(photoCrops);

  const interactionCountsByTab: Record<string, Record<string, number>> = { hs: {}, ms: {} };
  if (interactionCounts) {
    for (const [sk, map] of interactionCounts) {
      interactionCountsByTab[sk] = Object.fromEntries(
        Object.entries(map).map(([id, list]) => [id, (list || []).length])
      );
    }
  }

  return NextResponse.json({
    goals: goalsByTab,
    noteCounts: noteCountsByTab,
    connectionDates: connectionDatesByTab,
    photoCrops: photoCropsByTab,
    interactionCounts: interactionCountsByTab,
    interactionCountsOk: !!interactionCounts,
  });
}
