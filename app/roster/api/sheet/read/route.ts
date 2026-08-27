import { NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth";
import { describePayloadProblem } from "../../../lib/rosterSchema";

// The Apps Script maps columns by header name and emits the app's own field
// names, so this route forwards its payload untouched — it only checks the
// shape first. See app/roster/lib/rosterSchema.ts for the contract.
export async function GET() {
  // This returns every student's name, grade, school, birthday and photo — it
  // must never answer an anonymous caller. It did until this commit (IMP-06).
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    console.error("[roster/sheet] GOOGLE_SCRIPT_URL is not set on this server.");
    return NextResponse.json(
      { error: "The roster sheet isn't configured on the server (GOOGLE_SCRIPT_URL is missing)." },
      { status: 500 }
    );
  }

  let res: Response;
  try {
    const secret = process.env.GAS_SHARED_SECRET ? `&_s=${encodeURIComponent(process.env.GAS_SHARED_SECRET)}` : "";
    res = await fetch(scriptUrl + "?action=read" + secret, {
      next: { revalidate: 20, tags: ["roster-sheet"] },
    });
  } catch (err) {
    console.error("[roster/sheet] fetch to the Apps Script failed:", err);
    return NextResponse.json({ error: "Could not reach the Google Sheet." }, { status: 502 });
  }

  const text = await res.text();

  if (!res.ok) {
    console.error(`[roster/sheet] Apps Script returned ${res.status}:`, text.slice(0, 500));
    return NextResponse.json(
      { error: `The Google Sheet responded with ${res.status}.` },
      { status: 502 }
    );
  }

  // A misconfigured or unshared Apps Script deployment answers with an HTML
  // sign-in page and a 200, which used to sail through as "no students".
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[roster/sheet] Apps Script did not return JSON:", text.slice(0, 500));
    return NextResponse.json(
      { error: "The Google Sheet returned something that isn't JSON — check that the Apps Script is deployed and shared." },
      { status: 502 }
    );
  }

  const data = parsed as Record<string, unknown>;

  // The Apps Script reports its own failures as {"error": "..."} with a 200,
  // so this has to be checked explicitly rather than left to res.ok. The
  // common one is "Unauthorized", which means GAS_SHARED_SECRET here doesn't
  // match the secret the script expects.
  if (data && typeof data.error === "string") {
    const upstream = data.error;
    console.error("[roster/sheet] Apps Script rejected the request:", upstream);
    const hint =
      upstream.toLowerCase().includes("unauth")
        ? process.env.GAS_SHARED_SECRET
          ? " GAS_SHARED_SECRET on this server doesn't match the one the Apps Script expects."
          : " GAS_SHARED_SECRET isn't set on this server."
        : "";
    return NextResponse.json({ error: `The Google Sheet rejected the request: ${upstream}.${hint}` }, { status: 502 });
  }

  // Name the specific way the payload is wrong rather than "unexpected shape".
  // The last mapping regression rendered as plausible-looking but wrong data on
  // every card, which is far more expensive to notice than an error banner.
  const problem = describePayloadProblem(data);
  if (problem) {
    console.error(`[roster/sheet] ${problem}; keys:`, Object.keys(data ?? {}));
    return NextResponse.json(
      {
        error:
          `The Google Sheet returned an unexpected shape — ${problem}. ` +
          `Check that the Apps Script has been redeployed (Deploy → Manage deployments → New version).`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(data);
}
