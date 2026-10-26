import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";
import { uploadPhotoToStorage } from "../../lib/storage";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const type = (formData.get("type") as string) || "student";
    if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });
    // The client downsizes before sending (see uploadOriginalPhoto), so anything
    // near Vercel's 4.5MB request cap here is a client that skipped that step.
    if (!(file.type || "").startsWith("image/")) {
      return NextResponse.json({ error: "That file isn't an image" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Photo is too large — try a smaller one" }, { status: 413 });
    }

    // Profile photos and logos → Supabase Storage (replaces the original R2 bucket)
    if (type === "leader" || type === "logo") {
      const { url, logoTone } = await uploadPhotoToStorage(file, type);
      return NextResponse.json({ url, logoTone });
    }

    // Student photos → Google Drive (unchanged, via the same Apps Script)
    return uploadToGoogleDrive(file);
  } catch (e) {
    return NextResponse.json({ error: "Upload error: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}

async function uploadToGoogleDrive(file: File) {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "Upload not configured" }, { status: 500 });

  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mimeType = file.type || "image/jpeg";
  const fileName = file.name || `upload_${Date.now()}.jpg`;
  const folderId = process.env.DRIVE_FOLDER_ID || "1p7TiaPjqEPGIBxFMUEwqIGwTi81HA15r";

  const res = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "uploadPhoto", fileName, mimeType, base64, folderId, _s: process.env.GAS_SHARED_SECRET || "" }),
  });
  const data = await res.json();

  if (data.url || data.fileUrl) return NextResponse.json({ url: data.url || data.fileUrl });
  return NextResponse.json({ error: data.error || "Upload failed" }, { status: 500 });
}
