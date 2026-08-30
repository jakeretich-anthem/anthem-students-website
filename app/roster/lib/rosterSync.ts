import { supabaseAdmin } from "./supabaseAdmin";
import { kvPut } from "./kv";
import { describePayloadProblem, type RosterPayload, type SheetKey, type Student } from "./rosterSchema";

// Keeps roster_cache (the fast read-path the roster grid paints from) in step
// with the Google Sheet, which stays the source of truth. Two callers:
//   - app/roster/api/sync/route.ts, on a 5-minute Vercel Cron — catches
//     edits made directly in Sheets, outside the app.
//   - app/roster/api/sheet/write/route.ts, best-effort, right after an
//     app-side write — so the editing leader sees their own change in the
//     fast path immediately rather than waiting for the next cron tick.
//
// Photos: only Drive-style links (the only kind the app or the Apps Script's
// uploadPhoto() ever produce) get a re-hosted low-res thumbnail. Anything
// else (an already-direct googleusercontent.com URL, an /r2/ leftover) is
// left without one — the client already falls back to the initials avatar
// when there's no thumb, same as when there's no photo at all.

type CacheRow = {
  sk: SheetKey;
  id: string;
  row_index: number;
  name: string;
  grade: string;
  school: string;
  birthday: string;
  status: string;
  connected: boolean;
  last_connected: string;
  photo_url: string;
  thumb_url: string | null;
  notes: string;
  updated_at: string;
};

function driveFileId(photoUrl: string): string | null {
  const raw = photoUrl.trim();
  const mPath = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (mPath) return mPath[1];
  try {
    const u = new URL(raw);
    return u.searchParams.get("id");
  } catch {
    return null;
  }
}

async function fetchDriveThumbBytes(fileId: string): Promise<{ bytes: Buffer; contentType: string } | null> {
  try {
    const res = await fetch(`https://drive.google.com/thumbnail?id=${fileId}&sz=w64`);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) return null;
    const bytes = Buffer.from(await res.arrayBuffer());
    return { bytes, contentType };
  } catch {
    return null;
  }
}

async function refreshThumb(sk: SheetKey, id: string, photoUrl: string): Promise<string | null> {
  const fileId = photoUrl ? driveFileId(photoUrl) : null;
  if (!fileId) return null;

  const fetched = await fetchDriveThumbBytes(fileId);
  if (!fetched) return null;

  const ext = fetched.contentType.includes("png") ? "png" : "jpg";
  const key = `${sk}/${id}.${ext}`;
  const { error } = await supabaseAdmin()
    .storage.from("roster-thumbs")
    .upload(key, fetched.bytes, { contentType: fetched.contentType, upsert: true });
  if (error) return null;

  const {
    data: { publicUrl },
  } = supabaseAdmin().storage.from("roster-thumbs").getPublicUrl(key);
  // Cache-bust so a changed photo's thumbnail doesn't keep serving a stale
  // cached response under the same object key.
  return `${publicUrl}?v=${Date.now()}`;
}

async function fetchLiveSheet(): Promise<RosterPayload> {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) throw new Error("GOOGLE_SCRIPT_URL is not set on this server.");

  const secret = process.env.GAS_SHARED_SECRET ? `&_s=${encodeURIComponent(process.env.GAS_SHARED_SECRET)}` : "";
  // Deliberately a plain fetch, not the 20s-cached one sheet/read uses — this
  // job exists to reconcile against the live sheet.
  const res = await fetch(scriptUrl + "?action=read" + secret);
  const text = await res.text();
  if (!res.ok) throw new Error(`Apps Script returned ${res.status}`);

  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (typeof parsed.error === "string") throw new Error(`Apps Script rejected the request: ${parsed.error}`);

  const problem = describePayloadProblem(parsed);
  if (problem) throw new Error(`Unexpected sheet shape: ${problem}`);

  return parsed as unknown as RosterPayload;
}

export type SyncResult = {
  students: number;
  thumbsRefreshed: number;
  removed: number;
  errors: string[];
};

export async function syncRosterCache(): Promise<SyncResult> {
  const errors: string[] = [];
  const data = await fetchLiveSheet();
  const db = supabaseAdmin();

  const { data: existingRows } = await db.from("roster_cache").select("sk, id, photo_url, thumb_url");
  const existingBySkId = new Map((existingRows || []).map((r) => [`${r.sk}:${r.id}`, r]));

  const now = new Date().toISOString();
  const rows: CacheRow[] = [];
  const keepKeys = new Set<string>();
  let thumbsRefreshed = 0;

  for (const sk of ["hs", "ms"] as SheetKey[]) {
    const students: Student[] = data[sk]?.students || [];
    for (const s of students) {
      if (!s.id) continue;
      const key = `${sk}:${s.id}`;
      keepKeys.add(key);
      const existing = existingBySkId.get(key);

      let thumbUrl = existing?.thumb_url ?? null;
      const photoChanged = !existing || existing.photo_url !== (s.photoUrl || "");
      if (photoChanged || !thumbUrl) {
        try {
          const refreshed = await refreshThumb(sk, s.id, s.photoUrl || "");
          if (refreshed) {
            thumbUrl = refreshed;
            thumbsRefreshed++;
          } else if (photoChanged) {
            // Old photo is gone (URL changed to something we can't
            // thumbnail, or the fetch failed) — don't keep serving the
            // previous student's stale thumbnail under it.
            thumbUrl = null;
          }
        } catch (e) {
          errors.push(`thumb ${key}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }

      rows.push({
        sk,
        id: s.id,
        row_index: s.rowIndex,
        name: s.name || "",
        grade: s.grade || "",
        school: s.school || "",
        birthday: s.birthday || "",
        status: s.status || "core",
        connected: !!s.connected,
        last_connected: s.lastConnected || "",
        photo_url: s.photoUrl || "",
        thumb_url: thumbUrl,
        notes: s.notes || "",
        updated_at: now,
      });
    }
  }

  if (rows.length) {
    const { error } = await db.from("roster_cache").upsert(rows, { onConflict: "sk,id" });
    if (error) errors.push(`upsert: ${error.message}`);
  }

  const staleKeys = [...existingBySkId.keys()].filter((k) => !keepKeys.has(k));
  let removed = 0;
  for (const key of staleKeys) {
    const [sk, id] = key.split(":");
    const { error } = await db.from("roster_cache").delete().eq("sk", sk).eq("id", id);
    if (!error) removed++;
  }

  const result: SyncResult = { students: rows.length, thumbsRefreshed, removed, errors };
  await kvPut("sync:roster:lastRun", { at: now, ...result });
  return result;
}
