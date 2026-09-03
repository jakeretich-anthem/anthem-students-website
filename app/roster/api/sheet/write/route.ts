import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { requirePermission, type RosterUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { kvPut } from "../../../lib/kv";

// Every action here mutates the sheet, so this is POST-only. It used to be a
// GET that forwarded its query string to the Apps Script untouched, which made
// `?action=delete` reachable by navigation — and because the session cookie is
// SameSite=Lax (sent on top-level cross-site GETs), a leader clicking a crafted
// link would delete a student row. A cross-site POST gets no cookie at all.
//
// The Apps Script writes back through the same header lookup it reads with, so
// the payload still goes through untouched. (This used to run every field
// through denormalizeFields() to undo the compat layer's renames — see the
// deleted app/roster/lib/sheetSchema.ts.)

// Allowlisted server-side rather than trusted from the caller: the Apps Script
// also answers to `read` and the three no-op *Interaction actions, and there is
// no reason for this route to be able to reach any of them.
const ALLOWED_ACTIONS = new Set(["add", "update", "delete"]);

// Maps the app's own field names (the ones the client sends in `fields`/
// `person`) to roster_cache's snake_case columns. Best-effort keeps the fast
// read-cache in step with the sheet the instant an app-side edit lands,
// rather than waiting for the next sync cron — see lib/rosterSync.ts for the
// periodic reconciliation that's the actual safety net.
const CACHE_FIELD_MAP: Record<string, string> = {
  name: "name",
  grade: "grade",
  school: "school",
  birthday: "birthday",
  photoUrl: "photo_url",
  notes: "notes",
  status: "status",
  connected: "connected",
};

async function patchCache(action: string, sk: string, payload: Record<string, unknown>, result: Record<string, unknown>) {
  const db = supabaseAdmin();
  const now = new Date().toISOString();

  if (action === "delete") {
    await db.from("roster_cache").delete().eq("sk", sk).eq("id", payload.id);
    return;
  }

  if (action === "add") {
    const person = (payload.person as Record<string, unknown>) || {};
    await db.from("roster_cache").upsert(
      {
        sk,
        id: result.id,
        row_index: result.newRowIndex,
        name: person.name || "",
        grade: person.grade || "",
        school: person.school || "",
        birthday: person.birthday || "",
        status: person.status || "core",
        connected: !!person.connected,
        last_connected: result.lastConnected || "",
        photo_url: person.photoUrl || "",
        thumb_url: null,
        notes: person.notes || "",
        updated_at: now,
      },
      { onConflict: "sk,id" }
    );
    return;
  }

  // update
  const fields = (payload.fields as Record<string, unknown>) || {};
  const patch: Record<string, unknown> = { updated_at: now };
  for (const [field, value] of Object.entries(fields)) {
    if (CACHE_FIELD_MAP[field]) patch[CACHE_FIELD_MAP[field]] = value;
  }
  // A changed photo invalidates any cached low-res thumbnail for the old one
  // — the next sync (or the progressive full-res loader in the meantime)
  // regenerates it rather than the grid showing the previous photo's thumb.
  if ("photoUrl" in fields) patch.thumb_url = null;
  if (typeof result.lastConnected === "string" && result.lastConnected) patch.last_connected = result.lastConnected;
  if (Object.keys(patch).length > 1) {
    await db.from("roster_cache").update(patch).eq("sk", sk).eq("id", payload.id);
  }
}

// Feeds the same flat, timestamp-keyed log the hangout/connection/note writes
// use (see api/student/interactions) — the Activity tab reads across every
// type. Best-effort: a failure here must never surface as a failure of the
// actual sheet write, same reasoning as patchCache() above.
async function logActivity(action: string, sk: string, payload: Record<string, unknown>, actor: RosterUser) {
  let type: string;
  let studentName = "";
  if (action === "add") {
    type = "student_added";
    studentName = String((payload.person as Record<string, unknown> | undefined)?.name || "");
  } else if (action === "update") {
    type = "student_updated";
    const fields = (payload.fields as Record<string, unknown> | undefined) || {};
    studentName = String(fields.name || payload.studentName || "");
  } else {
    type = "student_removed";
    studentName = String(payload.studentName || "");
  }
  if (!studentName) return;

  const actKey = `activity:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  await kvPut(
    actKey,
    { type, studentName, sk, id: payload.id, leader: actor.name || "Someone", leaderEmail: actor.email || undefined, createdAt: new Date().toISOString() },
    90 * 24 * 60 * 60
  );
}

export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "GOOGLE_SCRIPT_URL not set" }, { status: 500 });

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = params.get("action") || "";
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
  }

  try {
    if (process.env.GAS_SHARED_SECRET) params.set("_s", process.env.GAS_SHARED_SECRET);
    const res = await fetch(scriptUrl + "?" + params.toString());
    const text = await res.text();
    // Bust the read cache added in sheet/read/route.ts so the next roster
    // load — even a fraction of a second later — sees this write.
    revalidateTag("roster-sheet");

    try {
      const payload = JSON.parse(params.get("payload") || "{}") as Record<string, unknown>;
      const result = JSON.parse(text) as Record<string, unknown>;
      if (!result.error && typeof payload.sheet === "string") {
        await patchCache(action, payload.sheet, payload, result);
        await logActivity(action, payload.sheet, payload, perm.user);
      }
    } catch (e) {
      // Best-effort — the periodic sync (lib/rosterSync.ts) reconciles any
      // miss here, so a failure patching the fast-cache must never surface
      // as a failure of the actual sheet write.
      console.error("[roster/sheet/write] cache patch failed:", e instanceof Error ? e.message : e);
    }

    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
