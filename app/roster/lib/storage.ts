import { supabaseAdmin } from "./supabaseAdmin";

// Replaces the original R2 bucket. Uploads go straight to a public Supabase
// Storage bucket and we hand back the public URL directly — no need to port
// the original's "/r2/<key>" proxy route.
export async function uploadPhotoToStorage(
  file: File,
  type: "leader" | "logo"
): Promise<{ url: string; logoTone: "dark" | "light" | null }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  const ext = mimeType.includes("png") ? "png" : mimeType.includes("svg") ? "svg" : "jpg";
  const key =
    type === "logo" ? `logo_${Date.now()}.${ext}` : `photos/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabaseAdmin()
    .storage.from("roster-photos")
    .upload(key, buffer, { contentType: mimeType, upsert: false });
  if (error) throw new Error(error.message);

  const {
    data: { publicUrl },
  } = supabaseAdmin().storage.from("roster-photos").getPublicUrl(key);

  let logoTone: "dark" | "light" | null = null;
  if (type === "logo" && !mimeType.includes("svg")) {
    const sample = buffer.subarray(0, 2048);
    const avg = sample.length ? sample.reduce((a, b) => a + b, 0) / sample.length : 128;
    logoTone = avg < 127 ? "dark" : "light";
  }

  return { url: publicUrl, logoTone };
}

// Removes a photo this app uploaded, once nothing points at it any more. Only
// ever touches roster-photos objects — a Drive link or someone else's URL is
// left alone. Best-effort: a leftover file costs a few KB, a thrown error here
// would fail the save that replaced it.
export async function deleteStoredPhoto(url: string | null | undefined): Promise<void> {
  if (!url) return;
  const marker = "/storage/v1/object/public/roster-photos/";
  const i = url.indexOf(marker);
  if (i < 0) return;
  const key = decodeURIComponent(url.slice(i + marker.length).split("?")[0]);
  if (!key.startsWith("photos/")) return;
  try {
    await supabaseAdmin().storage.from("roster-photos").remove([key]);
  } catch {
    // see above
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
