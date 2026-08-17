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
