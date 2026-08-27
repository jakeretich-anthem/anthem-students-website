import { NextResponse } from "next/server";
import { getSessionUser } from "../../lib/auth";

// Recropping an already-uploaded photo needs to draw it onto a <canvas> and
// read the pixels back out (toBlob), which the browser refuses to do for an
// image loaded straight from Drive/Supabase — those hosts don't reliably
// send CORS headers, so the canvas ends up "tainted". Fetching the bytes
// through our own origin sidesteps that entirely. The allowlist keeps this
// from becoming an open image-fetching proxy.
function isAllowedHost(host: string): boolean {
  if (host === "drive.google.com") return true;
  if (host.endsWith(".googleusercontent.com")) return true;
  try {
    const supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || "").host;
    if (supabaseHost && host === supabaseHost) return true;
  } catch {}
  return false;
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const target = new URL(request.url).searchParams.get("url");
  if (!target) return NextResponse.json({ error: "Missing url" }, { status: 400 });

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "https:" || !isAllowedHost(parsed.host)) {
    return NextResponse.json({ error: "Host not allowed" }, { status: 400 });
  }

  const res = await fetch(parsed.toString());
  if (!res.ok || !res.body) {
    return NextResponse.json({ error: "Could not fetch photo" }, { status: 502 });
  }

  return new NextResponse(res.body, {
    headers: {
      "Content-Type": res.headers.get("content-type") || "image/jpeg",
      "Cache-Control": "private, max-age=300",
    },
  });
}
