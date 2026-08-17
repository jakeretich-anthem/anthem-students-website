import { NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth";

export async function GET(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "GOOGLE_SCRIPT_URL not set" }, { status: 500 });
  try {
    const params = new URL(request.url).searchParams;
    if (process.env.GAS_SHARED_SECRET) params.set("_s", process.env.GAS_SHARED_SECRET);
    const res = await fetch(scriptUrl + "?" + params.toString());
    const text = await res.text();
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
