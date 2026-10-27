import { NextResponse } from "next/server";
import { getSessionUser, hasPermission } from "../../lib/auth";
import { uploadPhotoToStorage } from "../../lib/storage";

const MAX_BYTES = 4 * 1024 * 1024;

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  // View-only passcode sessions are "users" too — they must not be able to
  // put files in Storage.
  if (user.role === "viewer") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

    // Leader photos, logos and student photos all go to Supabase Storage.
    // Student uploads may carry a small client-made thumbnail for the grid.
    if (type !== "leader" && type !== "logo" && type !== "student") {
      return NextResponse.json({ error: "Unknown upload type" }, { status: 400 });
    }
    if (type === "student" && !(await hasPermission(user, "roster", "edit"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const thumb = type === "student" ? formData.get("thumb") : null;
    const { url, thumbUrl, logoTone } = await uploadPhotoToStorage(file, type, thumb instanceof File ? thumb : null);
    return NextResponse.json({ url, thumbUrl, logoTone });
  } catch (e) {
    return NextResponse.json({ error: "Upload error: " + (e instanceof Error ? e.message : String(e)) }, { status: 500 });
  }
}
