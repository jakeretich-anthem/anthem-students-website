import { NextResponse } from "next/server";
import { requirePermission } from "../../../lib/auth";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

// The fast path: one Supabase query against the roster_cache mirror (kept in
// step by lib/rosterSync.ts), so the grid can paint names, status, and
// low-res thumbnails before the much slower Apps Script round trip
// (sheet/read, still authoritative) resolves. See PLAN "Speed up the roster
// website" for the full picture.
export async function GET() {
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const { data, error } = await supabaseAdmin()
    .from("roster_cache")
    .select("sk, id, row_index, name, grade, school, birthday, status, connected, last_connected, photo_url, thumb_url, notes")
    .order("row_index", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const payload: Record<"hs" | "ms", { students: unknown[] }> = { hs: { students: [] }, ms: { students: [] } };
  for (const row of data || []) {
    const sk = row.sk as "hs" | "ms";
    if (!payload[sk]) continue;
    payload[sk].students.push({
      id: row.id,
      rowIndex: row.row_index,
      name: row.name,
      grade: row.grade,
      school: row.school,
      birthday: row.birthday,
      status: row.status,
      connected: row.connected,
      lastConnected: row.last_connected,
      photoUrl: row.photo_url,
      thumbUrl: row.thumb_url,
      notes: row.notes,
    });
  }

  return NextResponse.json(payload);
}
