import { supabaseAdmin } from "./supabaseAdmin";

// Replaces the original R2 bucket. Uploads go straight to a public Supabase
// Storage bucket and we hand back the public URL directly — no need to port
// the original's "/r2/<key>" proxy route. Student photos (which used to go to
// Google Drive) land under students/, with an optional small thumbnail in
// roster-thumbs for the grid's first paint.
export async function uploadPhotoToStorage(
  file: File,
  type: "leader" | "logo" | "student",
  thumb?: File | null
): Promise<{ url: string; thumbUrl: string | null; logoTone: "dark" | "light" | null }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const ext = extFor(mimeType);
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const key =
    type === "logo" ? `logo_${Date.now()}.${ext}` : type === "student" ? `students/${unique}.${ext}` : `photos/${unique}.${ext}`;

  const { error } = await supabaseAdmin()
    .storage.from("roster-photos")
    .upload(key, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabaseAdmin().storage.from("roster-photos").getPublicUrl(key);

  let thumbUrl: string | null = null;
  if (type === "student" && thumb && (thumb.type || "").startsWith("image/") && thumb.size <= MAX_THUMB_BYTES) {
    const thumbKey = `students/${unique}.${extFor(thumb.type)}`;
    const { error: thumbErr } = await supabaseAdmin()
      .storage.from("roster-thumbs")
      .upload(thumbKey, Buffer.from(await thumb.arrayBuffer()), { contentType: thumb.type, upsert: false });
    // Best-effort: without a thumb the grid just loads the full photo.
    if (!thumbErr) thumbUrl = supabaseAdmin().storage.from("roster-thumbs").getPublicUrl(thumbKey).data.publicUrl;
  }

  let logoTone: "dark" | "light" | null = null;
  if (type === "logo" && !mimeType.includes("svg")) {
    const sample = buffer.subarray(0, 2048);
    const avg = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : 128;
    logoTone = avg < 127 ? "dark" : "light";
  }

  return { url: publicUrl, thumbUrl, logoTone };
}

const MAX_THUMB_BYTES = 200 * 1024;

function extFor(mimeType: string): string {
  return mimeType.includes("png") ? "png" : mimeType.includes("svg") ? "svg" : mimeType.includes("webp") ? "webp" : "jpg";
}

// Removes a photo or thumbnail this app uploaded, once nothing points at it
// any more. Only ever touches objects under photos/ or students/ in our two
// buckets — a Drive link, a logo or someone else's URL is left alone.
// Best-effort: a leftover file costs a few KB, a thrown error here would fail
// the save that replaced it.
export async function deleteStoredPhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  for (const bucket of ["roster-photos", "roster-thumbs"]) {
    const marker = `/storage/v1/object/public/${bucket}/`;
    const i = url.indexOf(marker);
    if (i < 0) continue;
    const key = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
    if (!key.startsWith("photos/") && !key.startsWith("students/") && !(bucket === "roster-thumbs" && /^(hs|ms)\//.test(key))) return;
    try {
      await supabaseAdmin().storage.from(bucket).remove([key]);
    } catch {
      // see above
    }
    return;
  }
}

export type PhotoCrop = { zoom: number; offX: number; offY: number };

// undefined = not a valid crop (reject), null = no crop.
export function parsePhotoCrop(raw: unknown): PhotoCrop | null | undefined {
  if (raw === null) return null;
  if (!raw || typeof raw !== "object") return undefined;
  const c = raw as Record<string, unknown>;
  const zoom = Number(c.zoom), offX = Number(c.offX), offY = Number(c.offY);
  if (![zoom, offX, offY].every(Number.isFinite) || zoom < 1 || zoom > 20) return undefined;
  return { zoom, offX, offY };
}
