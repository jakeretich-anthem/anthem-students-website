import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../../lib/kv";
import { requireAdmin, type RosterUser } from "../../../../lib/auth";
import { deleteStoredPhoto, parsePhotoCrop } from "../../../../lib/storage";

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
  // An empty string is the explicit "remove photo".
  const previousPhoto = target.photoUrl || "";
  if (typeof photoUrl === "string") target.photoUrl = photoUrl;
  const crop = parsePhotoCrop(photoCrop ?? null);
  if (crop === undefined) return NextResponse.json({ error: "Invalid crop" }, { status: 400 });
  target.photoCrop = target.photoUrl ? crop : null;
  await kvPut(key, target);
  if (previousPhoto && previousPhoto !== (target.photoUrl || "")) await deleteStoredPhoto(previousPhoto);
  return NextResponse.json({ success: true, photoUrl: target.photoUrl || null, photoCrop: target.photoCrop || null });
}
