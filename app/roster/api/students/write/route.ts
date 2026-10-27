import { NextResponse } from "next/server";
import { requirePermission, type RosterUser } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";
import { kvPut } from "../../../lib/kv";
import { deleteStoredPhoto } from "../../../lib/storage";
import { SHEET_KEYS, STATUSES, type SheetKey, type Status } from "../../../lib/rosterSchema";

// Every action here mutates the roster, so this is POST-only. A GET would make
// `?action=delete` reachable by navigation — and because the session cookie is
// SameSite=Lax (sent on top-level cross-site GETs), a leader clicking a crafted
// link would delete a student. A cross-site POST gets no cookie at all.
//
// The body is the same urlencoded {action, payload} the client has always
// sent. Students are
// found by (sheet, id) only — rowIndex is accepted but ignored, since a row
// number the client is still holding from before a delete is stale.

const ALLOWED_ACTIONS = new Set(["add", "update", "delete"]);

// The app's field names -> roster_students columns. Anything else in a
// payload is ignored rather than trusted.
const FIELD_COLUMNS: Record<string, string> = {
  name: "name",
  grade: "grade",
  school: "school",
  birthday: "birthday",
  photoUrl: "photo_url",
  notes: "notes",
  status: "status",
  connected: "connected",
  lastConnected: "last_connected",
};

const MAX_LEN: Record<string, number> = { name: 200, notes: 5000, photoUrl: 2000 };
const DEFAULT_MAX_LEN = 200;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

class BadRequest extends Error {}

function truthy(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const s = String(v ?? "").trim().toLowerCase();
  return s === "true" || s === "yes" || s === "family connected with";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// Validates and converts the client's fields into column values. Throws
// BadRequest with a message the leader can act on.
function toColumns(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [field, raw] of Object.entries(fields)) {
    const column = FIELD_COLUMNS[field];
    if (!column) continue;

    if (field === "connected") {
      out[column] = truthy(raw);
      continue;
    }
    if (field === "status") {
      const status = String(raw ?? "").trim().toLowerCase();
      if (!STATUSES.includes(status as Status)) throw new BadRequest(`Unknown status: ${status || "(blank)"}`);
      out[column] = status;
      continue;
    }

    const value = raw == null ? "" : String(raw).trim();
    if (value.length > (MAX_LEN[field] ?? DEFAULT_MAX_LEN)) throw new BadRequest(`${field} is too long`);
    if (field === "name" && !value) throw new BadRequest("Name is required");
    if (field === "lastConnected" && value && !DATE_RE.test(value)) throw new BadRequest("Invalid connection date");
    if (field === "photoUrl" && value && !/^https:\/\//.test(value)) throw new BadRequest("Photo must be an https:// link");
    out[column] = value;
  }
  return out;
}

function isOwnStorageUrl(url: unknown): url is string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return typeof url === "string" && !!base && url.startsWith(`${base}/storage/v1/object/public/roster-thumbs/`);
}

// Deletes a student's old photo + thumbnail from Storage, unless another
// student still points at the same file.
async function releasePhotos(photoUrl: string | null, thumbUrl: string | null) {
  const db = supabaseAdmin();
  for (const [column, url] of [["photo_url", photoUrl], ["thumb_url", thumbUrl]] as const) {
    if (!url) continue;
    const { count } = await db.from("roster_students").select("id", { count: "exact", head: true }).eq(column, url);
    if (!count) await deleteStoredPhoto(url);
  }
}

async function addStudent(sk: SheetKey, person: Record<string, unknown>) {
  const db = supabaseAdmin();
  const cols = toColumns(person);
  if (!cols.name) throw new BadRequest("Name is required");

  // A student added as already-connected gets today stamped as their date.
  if (cols.connected && !cols.last_connected) cols.last_connected = todayISO();
  if (cols.photo_url && isOwnStorageUrl(person.thumbUrl)) cols.thumb_url = person.thumbUrl;

  const { data: last } = await db
    .from("roster_students")
    .select("row_index")
    .eq("sk", sk)
    .order("row_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const rowIndex = (last?.row_index ?? 1) + 1;

  const { data, error } = await db
    .from("roster_students")
    .insert({ ...cols, sk, row_index: rowIndex })
    .select("id, row_index, last_connected")
    .single();
  if (error) throw new Error(error.message);

  return { success: true, id: data.id, newRowIndex: data.row_index, lastConnected: data.last_connected };
}

async function updateStudent(sk: SheetKey, id: string, fields: Record<string, unknown>) {
  const db = supabaseAdmin();
  const { data: current, error: readErr } = await db
    .from("roster_students")
    .select("connected, photo_url, thumb_url")
    .eq("sk", sk)
    .eq("id", id)
    .maybeSingle();
  if (readErr) throw new Error(readErr.message);
  if (!current) throw new BadRequest("Could not find that student — they may have been removed. Reload to see the latest roster.");

  const patch = toColumns(fields);

  // The last-connection date is stamped only when Connected flips OFF -> ON.
  // It records the last time this family was actually connected with, so
  // switching the toggle back off deliberately leaves the date alone. An
  // explicit lastConnected from the client (it sends its own local "today")
  // wins over the server's UTC date.
  if (patch.connected === true && !current.connected && !("last_connected" in patch)) {
    patch.last_connected = todayISO();
  }

  // A changed photo invalidates the low-res thumbnail made for the old one,
  // unless the upload that produced the new photo sent a fresh one with it.
  const photoChanged = "photo_url" in patch && patch.photo_url !== current.photo_url;
  if (photoChanged) patch.thumb_url = isOwnStorageUrl(fields.thumbUrl) ? fields.thumbUrl : null;

  const { data, error } = await db
    .from("roster_students")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("sk", sk)
    .eq("id", id)
    .select("last_connected, row_index")
    .single();
  if (error) throw new Error(error.message);

  if (photoChanged) await releasePhotos(current.photo_url, current.thumb_url);

  return { success: true, rowIndex: data.row_index, lastConnected: data.last_connected };
}

async function deleteStudent(sk: SheetKey, id: string) {
  const { data, error } = await supabaseAdmin()
    .from("roster_students")
    .delete()
    .eq("sk", sk)
    .eq("id", id)
    .select("photo_url, thumb_url")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new BadRequest("Could not find that student — they may already have been removed.");
  await releasePhotos(data.photo_url, data.thumb_url);
  return { success: true };
}

// Feeds the same flat, timestamp-keyed log the hangout/connection/note writes
// use (see api/student/interactions) — the Activity tab reads across every
// type. Best-effort: a failure here must never surface as a failure of the
// actual write.
async function logActivity(action: string, sk: string, id: string, payload: Record<string, unknown>, actor: RosterUser) {
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
    { type, studentName, sk, id, leader: actor.name || "Someone", leaderEmail: actor.email || undefined, createdAt: new Date().toISOString() },
    90 * 24 * 60 * 60
  );
}

export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  let action: string;
  let payload: Record<string, unknown>;
  try {
    const params = new URLSearchParams(await request.text());
    action = params.get("action") || "";
    payload = JSON.parse(params.get("payload") || "{}");
    if (!payload || typeof payload !== "object") throw new Error();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
  }

  const sk = String(payload.sheet || "") as SheetKey;
  if (!SHEET_KEYS.includes(sk)) return NextResponse.json({ error: "Unknown roster tab" }, { status: 400 });
  const id = typeof payload.id === "string" ? payload.id : "";
  if (action !== "add" && !id) return NextResponse.json({ error: "Missing student id" }, { status: 400 });

  try {
    let result: Record<string, unknown>;
    if (action === "add") {
      result = await addStudent(sk, (payload.person as Record<string, unknown>) || {});
    } else if (action === "update") {
      result = await updateStudent(sk, id, (payload.fields as Record<string, unknown>) || {});
    } else {
      result = await deleteStudent(sk, id);
    }

    try {
      await logActivity(action, sk, (result.id as string) || id, payload, perm.user);
    } catch (e) {
      console.error("[roster/students/write] activity log failed:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof BadRequest) return NextResponse.json({ error: e.message }, { status: 400 });
    console.error(`[roster/students/write] ${action} failed:`, e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Couldn't save that change — please try again." }, { status: 500 });
  }
}
