import { NextResponse } from "next/server";

export async function GET() {
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "GOOGLE_SCRIPT_URL not set" }, { status: 500 });
  try {
    const secret = process.env.GAS_SHARED_SECRET ? `&_s=${encodeURIComponent(process.env.GAS_SHARED_SECRET)}` : "";
    const res = await fetch(scriptUrl + "?action=read" + secret);
    const text = await res.text();
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
