// One-time cutover: copy the roster out of the Google Sheet into
// roster_students, and every Drive photo into Supabase Storage. Delete this
// file once the cutover is done.
//
//   node --env-file=.env.local scripts/migrate-roster-from-sheet.mjs <outDir>          # dry run
//   node --env-file=.env.local scripts/migrate-roster-from-sheet.mjs <outDir> --apply  # write
//
// Safe to re-run: rows upsert by (sk,id), and photos already copied (tracked
// in <outDir>/photo-map.json by Drive file id) are not re-uploaded.
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const [outDir, flag] = process.argv.slice(2);
if (!outDir) throw new Error("usage: migrate-roster-from-sheet.mjs <outDir> [--apply]");
const APPLY = flag === "--apply";
mkdirSync(outDir, { recursive: true });

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const FIELDS = ["name", "grade", "school", "birthday", "status", "connected", "lastConnected", "notes"];
const COL = { lastConnected: "last_connected", photoUrl: "photo_url" };
const col = (f) => COL[f] || f;

async function fetchSheet() {
  const secret = process.env.GAS_SHARED_SECRET ? `&_s=${encodeURIComponent(process.env.GAS_SHARED_SECRET)}` : "";
  const res = await fetch(process.env.GOOGLE_SCRIPT_URL + "?action=read" + secret);
  const text = await res.text();
  if (!res.ok) throw new Error(`Apps Script returned ${res.status}`);
  const data = JSON.parse(text);
  if (data.error) throw new Error(`Apps Script: ${data.error}`);
  for (const sk of ["hs", "ms"]) {
    if (!Array.isArray(data[sk]?.students)) throw new Error(`sheet payload missing ${sk}.students`);
  }
  return data;
}

function driveFileId(url) {
  const raw = String(url || "").trim();
  if (!raw.includes("drive.google.com") && !raw.includes("docs.google.com")) return null;
  const m = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m) return m[1];
  try {
    return new URL(raw).searchParams.get("id");
  } catch {
    return null;
  }
}

async function fetchImage(url) {
  const res = await fetch(url);
  const type = res.headers.get("content-type") || "";
  if (!res.ok || !type.startsWith("image/")) throw new Error(`${res.status} ${type}`);
  return { bytes: Buffer.from(await res.arrayBuffer()), type };
}

async function upload(bucket, key, img) {
  const { error } = await db.storage.from(bucket).upload(key, img.bytes, { contentType: img.type, upsert: false });
  if (error) throw new Error(`${bucket}/${key}: ${error.message}`);
  return db.storage.from(bucket).getPublicUrl(key).data.publicUrl;
}

async function copyPhoto(sk, id, fileId) {
  const full = await fetchImage(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`);
  const thumb = await fetchImage(`https://drive.google.com/thumbnail?id=${fileId}&sz=w128`);
  const suffix = randomBytes(6).toString("hex");
  const ext = (t) => (t.type.includes("png") ? "png" : "jpg");
  return {
    url: await upload("roster-photos", `students/${sk}/${id}-${suffix}.${ext(full)}`, full),
    thumbUrl: await upload("roster-thumbs", `${sk}/${id}-${suffix}.${ext(thumb)}`, thumb),
  };
}

const sheet = await fetchSheet();
writeFileSync(path.join(outDir, `sheet-snapshot-${Date.now()}.json`), JSON.stringify(sheet, null, 2));
console.log(`sheet: hs=${sheet.hs.students.length} ms=${sheet.ms.students.length}`);

// Sanity checks that would make a straight copy unsafe.
for (const sk of ["hs", "ms"]) {
  const ids = sheet[sk].students.map((s) => s.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) throw new Error(`${sk}: duplicate ids ${dupes.join(",")}`);
  const fallbackIds = ids.filter((id) => /^r\d+$/.test(id));
  if (fallbackIds.length) throw new Error(`${sk}: rows without a real ID column value: ${fallbackIds.join(",")}`);
}

const mapPath = path.join(outDir, "photo-map.json");
const photoMap = existsSync(mapPath) ? JSON.parse(readFileSync(mapPath, "utf8")) : {};

if (!APPLY) {
  // Dry run: how far has the old mirror drifted from the sheet?
  const { data: cache } = await db.from("roster_cache").select("*");
  const byKey = new Map(cache.map((r) => [`${r.sk}:${r.id}`, r]));
  let drift = 0;
  for (const sk of ["hs", "ms"]) {
    for (const s of sheet[sk].students) {
      const r = byKey.get(`${sk}:${s.id}`);
      if (!r) { console.log(`  new since mirror: ${sk}:${s.id}`); drift++; continue; }
      for (const f of [...FIELDS, "photoUrl"]) {
        if (String(r[col(f)] ?? "") !== String(s[f] ?? "")) drift++;
      }
      byKey.delete(`${sk}:${s.id}`);
    }
  }
  console.log(`mirror drift: ${drift} field differences, ${byKey.size} rows in mirror but not in sheet`);
  const drivePhotos = ["hs", "ms"].flatMap((sk) => sheet[sk].students.filter((s) => driveFileId(s.photoUrl)));
  const otherPhotos = ["hs", "ms"].flatMap((sk) => sheet[sk].students.filter((s) => s.photoUrl && !driveFileId(s.photoUrl)));
  console.log(`photos: ${drivePhotos.length} on Drive, ${otherPhotos.length} other: ${otherPhotos.map((s) => s.photoUrl).join(" ")}`);
  console.log("dry run only — pass --apply to write");
  process.exit(0);
}

// ── Apply ────────────────────────────────────────────────────────────
const failures = [];
const now = new Date().toISOString();
for (const sk of ["hs", "ms"]) {
  const rows = [];
  for (const s of sheet[sk].students) {
    let photoUrl = s.photoUrl || "";
    let thumbUrl = null;
    const fileId = driveFileId(photoUrl);
    if (fileId) {
      try {
        photoMap[fileId] ||= await copyPhoto(sk, s.id, fileId);
        writeFileSync(mapPath, JSON.stringify(photoMap, null, 2));
        ({ url: photoUrl, thumbUrl } = photoMap[fileId]);
      } catch (e) {
        failures.push(`${sk}:${s.id} ${s.name}: ${e.message} — kept Drive link`);
      }
    }
    rows.push({
      sk, id: s.id, row_index: s.rowIndex, name: s.name, grade: s.grade || "", school: s.school || "",
      birthday: s.birthday || "", status: s.status || "core", connected: !!s.connected,
      last_connected: s.lastConnected || "", photo_url: photoUrl, thumb_url: thumbUrl, notes: s.notes || "",
      updated_at: now,
    });
  }
  const { error } = await db.from("roster_students").upsert(rows, { onConflict: "sk,id" });
  if (error) throw new Error(`upsert ${sk}: ${error.message}`);
  const keep = rows.map((r) => r.id);
  const { data: extra } = await db.from("roster_students").select("id").eq("sk", sk);
  const stale = extra.map((r) => r.id).filter((id) => !keep.includes(id));
  if (stale.length) await db.from("roster_students").delete().eq("sk", sk).in("id", stale);
}

// ── Verify: every field (other than the photo URLs) equals the sheet ──
const { data: after } = await db.from("roster_students").select("*");
const byKey = new Map(after.map((r) => [`${r.sk}:${r.id}`, r]));
const diffs = [];
for (const sk of ["hs", "ms"]) {
  for (const s of sheet[sk].students) {
    const r = byKey.get(`${sk}:${s.id}`);
    if (!r) { diffs.push(`${sk}:${s.id} missing`); continue; }
    for (const f of [...FIELDS, "rowIndex"]) {
      const dbVal = f === "rowIndex" ? r.row_index : r[col(f)];
      const want = f === "connected" ? !!s[f] : f === "status" ? (s[f] || "core") : (s[f] ?? "");
      if (String(dbVal) !== String(want)) diffs.push(`${sk}:${s.id} ${f}: sheet=${JSON.stringify(want)} db=${JSON.stringify(dbVal)}`);
    }
    const fileId = driveFileId(s.photoUrl);
    const expectedPhoto = fileId && photoMap[fileId] ? photoMap[fileId].url : s.photoUrl || "";
    if (r.photo_url !== expectedPhoto) diffs.push(`${sk}:${s.id} photo mismatch`);
  }
}
const total = sheet.hs.students.length + sheet.ms.students.length;
if (after.length !== total) diffs.push(`row count: sheet=${total} db=${after.length}`);

// Per-student data in roster_kv that would be orphaned by an id mismatch.
const { data: kvRows } = await db.from("roster_kv").select("key")
  .or("key.like.goals:%,key.like.interactions:%,key.like.notes:%,key.like.mentors:%,key.like.connections:%,key.like.photoCrop:%,key.like.apprentice:%");
const orphans = kvRows.map((r) => r.key).filter((k) => {
  const [, sk, id] = k.split(":");
  return !byKey.has(`${sk}:${id}`);
});

const report = { at: now, sheet: { hs: sheet.hs.students.length, ms: sheet.ms.students.length }, db: after.length,
  photosCopied: Object.keys(photoMap).length, photoFailures: failures, diffs, orphanedKvKeys: orphans };
writeFileSync(path.join(outDir, "migration-report.json"), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, orphanedKvKeys: orphans.length }, null, 2));
if (diffs.length) process.exit(1);
