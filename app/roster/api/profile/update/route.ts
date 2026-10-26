import { NextResponse } from "next/server";
import { kvPut } from "../../../lib/kv";
import { getSessionUser } from "../../../lib/auth";
import { deleteStoredPhoto, parsePhotoCrop } from "../../../lib/storage";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const updates = await request.json();
  for (const key of ["name", "leaderSince", "funFact"] as const) {
    if (typeof updates[key] === "string") user[key] = updates[key].trim().slice(0, 200);
  }

  // photoUrl "" removes the photo; undefined leaves it alone.
  const previousPhoto = user.photoUrl || "";
  if (updates.photoUrl !== undefined) {
    if (typeof updates.photoUrl !== "string") return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
    user.photoUrl = updates.photoUrl;
    if (!updates.photoUrl) user.photoCrop = null;
  }
  if (updates.photoCrop !== undefined) {
    const crop = parsePhotoCrop(updates.photoCrop);
    if (crop === undefined) return NextResponse.json({ error: "Invalid crop" }, { status: 400 });
    user.photoCrop = crop;
  }

  await kvPut(`user:${user.email}`, user);
  if (previousPhoto && previousPhoto !== (user.photoUrl || "")) await deleteStoredPhoto(previousPhoto);
  return NextResponse.json({ success: true, photoUrl: user.photoUrl || null, photoCrop: user.photoCrop || null });
}
