import { NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth";

// Every action here mutates the sheet, so this is POST-only. It used to be a
// GET that forwarded its query string to the Apps Script untouched, which made
// `?action=delete` reachable by navigation — and because the session cookie is
// SameSite=Lax (sent on top-level cross-site GETs), a leader clicking a crafted
// link would delete a student row. A cross-site POST gets no cookie at all.
//
// The Apps Script writes back through the same header lookup it reads with, so
// the payload still goes through untouched. (This used to run every field
// through denormalizeFields() to undo the compat layer's renames — see the
// deleted app/roster/lib/sheetSchema.ts.)

// Allowlisted server-side rather than trusted from the caller: the Apps Script
// also answers to `read` and the three no-op *Interaction actions, and there is
// no reason for this route to be able to reach any of them.
const ALLOWED_ACTIONS = new Set(["add", "update", "delete"]);

export async function POST(request: Request) {
  const perm = await requirePermission("roster", "edit");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) return NextResponse.json({ error: "GOOGLE_SCRIPT_URL not set" }, { status: 500 });

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(await request.text());
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = params.get("action") || "";
  if (!ALLOWED_ACTIONS.has(action)) {
    return NextResponse.json({ error: `Unsupported action: ${action || "(none)"}` }, { status: 400 });
  }

  try {
    if (process.env.GAS_SHARED_SECRET) params.set("_s", process.env.GAS_SHARED_SECRET);
    const res = await fetch(scriptUrl + "?" + params.toString());
    const text = await res.text();
    return new NextResponse(text, { headers: { "Content-Type": "application/json" } });
  } catch {
    return NextResponse.json({ error: "Could not reach Google Sheet" }, { status: 502 });
  }
}
