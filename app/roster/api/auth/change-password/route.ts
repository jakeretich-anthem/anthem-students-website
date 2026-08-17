import { NextResponse } from "next/server";
import { kvPut } from "../../../lib/kv";
import { getSessionUser } from "../../../lib/auth";
import { hashPassword, validatePasswordStrength, verifyPassword } from "../../../lib/crypto";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !user.email) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { oldPassword, newPassword, confirmPassword } = await request.json();
  if (!oldPassword || !newPassword || !confirmPassword) {
    return NextResponse.json({ error: "All fields required" }, { status: 400 });
  }
  if (newPassword !== confirmPassword) return NextResponse.json({ error: "New passwords do not match" }, { status: 400 });
  if (!validatePasswordStrength(newPassword)) return NextResponse.json({ error: "Weak password" }, { status: 400 });
  if (!user.passwordHash || !(await verifyPassword(oldPassword, user.passwordHash))) {
    return NextResponse.json({ error: "Old password incorrect" }, { status: 401 });
  }

  user.passwordHash = await hashPassword(newPassword);
  await kvPut(`user:${user.email}`, user);
  return NextResponse.json({ success: true });
}
