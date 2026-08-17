import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { requireAdmin, type RosterUser } from "../../../lib/auth";
import { sendEmail } from "../../../lib/email";

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const actingUser = admin.user;

  const { email, role, status, notifyUser } = await request.json();
  if (!email || !["approved", "pending", "admin", "leader"].includes(role)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (email.toLowerCase() === actingUser.email?.toLowerCase() && role !== "admin") {
    return NextResponse.json({ error: "You cannot change your own admin status." }, { status: 403 });
  }

  const key = `user:${email.toLowerCase()}`;
  const target = await kvGet<RosterUser>(key);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  target.role = role;
  if (status) target.status = status;
  if (role !== "pending" && target.status !== "denied") target.status = "approved";
  await kvPut(key, target);

  if (notifyUser) {
    const approved = target.status === "approved" || role !== "pending";
    await sendEmail({
      to: target.email!,
      subject: approved ? "Account approved" : "Account denied",
      html: approved ? "<p>Your account has been approved. You can now log in.</p>" : "<p>Your account request was not approved.</p>",
    });
  }

  await kvPut(
    `audit:user-status:${Date.now()}:${target.email}`,
    {
      actor: actingUser.email,
      email: target.email,
      role,
      status: target.status || null,
      notifyUser: !!notifyUser,
      createdAt: new Date().toISOString(),
    },
    180 * 24 * 60 * 60
  );

  return NextResponse.json({ success: true });
}
