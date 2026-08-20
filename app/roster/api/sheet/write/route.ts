import { NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth";
import { denormalizeFields, type SheetKey } from "../../../lib/sheetSchema";

// Reads are translated out of the Apps Script's scrambled column mapping
// (app/roster/lib/sheetSchema.ts), so writes have to be translated back into
// it or an edit would land in the neighbouring column. The two mappings are
// exact inverses — see the note at the top of sheetSchema.ts.
function translatePayload(raw: string | null): string | null {
  if (!raw) return raw;

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return raw; // not ours to rewrite; forward untouched
  }

  const sheet = payload.sheet;
  if (sheet !== "hs" && sheet !== "ms") return raw;
  const sk = sheet as SheetKey;

  // action=update sends `fields`; action=add sends `person`.
  if (payload.fields && typeof payload.fields === "object") {
    payload.fields = denormalizeFields(sk, payload.fields as Record<string, unknown>);
  }
  if (payload.person && typeof payload.person === "object") {
    payload.person = denormalizeFields(sk, payload.person as Record<string, unknown>);
  }

  return JSON.stringify(payload);
}

export async function GET(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "GOOGLE_SCRIPT_URL not set" }, { status: 500 });
  try {
    const params = new URL(request.url).searchParams;
    const translated = translatePayload(params.get("payload"));
    if (translated !== null) params.set("payload", translated);
    if (process.env.GAS_SHARED_SECRET) params.set("_s", process.env.GAS_SHARED_SECRET);
    const res = await fetch(scriptUrl + "?" + params.toString());
    const text = await res.text();
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
