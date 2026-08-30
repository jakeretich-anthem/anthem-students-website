import { NextResponse } from "next/server";
import { requireAdmin } from "../../lib/auth";
import { syncRosterCache } from "../../lib/rosterSync";

// Reconciles roster_cache against the live Google Sheet — the safety net for
// edits made directly in Sheets (outside the app), and the thing that
// generates/refreshes low-res thumbnails in Supabase Storage. Two ways in:
//   - Vercel Cron (see vercel.json), which always calls with GET and is
//     authenticated by CRON_SECRET (Vercel adds the Authorization header
//     automatically once that env var is set on the project).
//   - An admin, manually (POST), from a "Sync now" control — authenticated
//     by the normal admin session.
async function handleSync(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const perm = await requireAdmin();
    if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });
  }

  try {
    const result = await syncRosterCache();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[roster/sync] failed:", message);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}
