import { NextResponse } from "next/server";
import { requirePermission } from "../../lib/auth";
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import { rowToStudent, STUDENT_COLUMNS, type StudentRow } from "../../lib/rosterSchema";

// The whole roster in one query. roster_students is the source of truth (the
// Google Sheet it was copied from is a frozen backup), so there's no second,
// slower fetch to reconcile against any more.
export async function GET() {
  // This returns every student's name, grade, school, birthday and photo — it
  // must never answer an anonymous caller.
  const perm = await requirePermission("roster", "view");
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const { data, error } = await supabaseAdmin()
    .from("roster_students")
    .select(STUDENT_COLUMNS)
    .order("row_index", { ascending: true });

  if (error) {
    console.error("[roster/students] read failed:", error.message);
    return NextResponse.json({ error: "Couldn't load the roster from the database." }, { status: 500 });
  }

  const payload: Record<"hs" | "ms", { students: unknown[] }> = { hs: { students: [] }, ms: { students: [] } };
  for (const row of (data || []) as StudentRow[]) {
    payload[row.sk]?.students.push(rowToStudent(row));
  }

  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}
