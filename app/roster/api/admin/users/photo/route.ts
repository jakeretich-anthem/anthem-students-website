import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../../lib/kv";
import { requireAdmin, type RosterUser } from "../../../../lib/auth";

// Lets an admin set another leader's photo from Adminland's Users tab — the
// self-service equivalent (/roster/api/profile/update) only ever writes to
// the caller's own record. No self-protection check is needed here the way
// admin/update has one for role changes: changing someone's photo isn't a
// privilege-escalation risk.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { email, photoUrl, photoCrop } = await request.json();
  if (!email) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const key = `user:${String(email).toLowerCase()}`;
  const target = await kvGet<RosterUser>(key);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // A pure recrop (no new file) sends photoUrl as null — don't let that wipe
  // out the existing photo, only ever change photoUrl when one is provided.
  target.photoUrl = photoUrl ?? target.photoUrl;
  target.photoCrop = photoCrop ?? null;
  await kvPut(key, target);
  return NextResponse.json({ success: true });
}
