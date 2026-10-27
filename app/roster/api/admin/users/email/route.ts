import { NextResponse } from "next/server";
import { kvPut } from "../../../../lib/kv";
import { requireAdmin } from "../../../../lib/auth";
import { renameUserEmail } from "../../../../lib/renameUser";

// Lets an admin change a leader's sign-in email from Adminland's Users tab.
// The leader keeps their password, sessions, notes and mentor assignments —
// see lib/renameUser for everything that moves with them.
export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });

  const { email, newEmail } = await request.json();
  if (!email || !newEmail) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const from = String(email).trim().toLowerCase();
  const to = String(newEmail).trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  if (from === to) return NextResponse.json({ success: true, email: to });

  const result = await renameUserEmail(from, to);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  await kvPut(
    `audit:user-status:${Date.now()}:${to}`,
    { actor: admin.user.email || "admin", email: to, previousEmail: from, action: "email-changed", createdAt: new Date().toISOString() },
    180 * 24 * 60 * 60
  );
  return NextResponse.json({ success: true, email: to });
}
