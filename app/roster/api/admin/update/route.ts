import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvList, kvPut } from "../../../lib/kv";
import { requireAdmin, type RosterUser } from "../../../lib/auth";
import { emailLayout, sendEmail } from "../../../lib/email";
import { siteOrigin } from "../../../lib/origin";

async function audit(entry: Record<string, unknown> & { email: string }) {
  await kvPut(`audit:user-status:${Date.now()}:${entry.email}`, { ...entry, createdAt: new Date().toISOString() }, 180 * 24 * 60 * 60);
}

// Drop any outstanding email approve/decline token for this address, so a stale
// link in an inbox can't resurrect a decision already made in Adminland.
async function dropSignupTokens(email: string) {
  const list = await kvList("signupAction:");
  await Promise.all(
    list.keys.map(async (key) => {
      const rec = await kvGet<{ email?: string }>(key.name);
      if (rec?.email?.toLowerCase() === email.toLowerCase()) await kvDelete(key.name);
    })
  );
}

export async function POST(request: Request) {
  const admin = await requireAdmin();
  if (!admin.ok) return NextResponse.json({ error: admin.error }, { status: admin.status });
  const actingUser = admin.user;

  const { email, role, status, notifyUser, action } = await request.json();
  if (!email) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const lower = String(email).toLowerCase();
  const key = `user:${lower}`;
  const target = await kvGet<RosterUser>(key);
  if (!target) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (lower === actingUser.email?.toLowerCase() && (action === "delete" || role !== "admin")) {
    return NextResponse.json({ error: "You cannot change your own admin status." }, { status: 403 });
  }

  // Declining from Adminland behaves exactly like declining from the email
  // link: the account is deleted and the person is told nothing.
  if (action === "delete") {
    await kvDelete(key);
    await dropSignupTokens(lower);
    await audit({ actor: actingUser.email || "admin", email: lower, action: "declined-and-deleted" });
    return NextResponse.json({ success: true, deleted: true });
  }

  if (!["approved", "pending", "admin", "leader"].includes(role)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const wasPending = target.role === "pending" || target.status === "pending_approval";
  target.role = role;
  if (status) target.status = status;
  if (role !== "pending" && target.status !== "denied") target.status = "approved";
  await kvPut(key, target);
  if (role !== "pending") await dropSignupTokens(lower);

  // Approving someone who was waiting is the one case where they're expecting
  // to hear back, so it notifies unless the caller explicitly opts out.
  const isApproval = wasPending && role !== "pending";
  const shouldNotify = notifyUser ?? isApproval;

  if (shouldNotify && target.email) {
    const approved = target.status === "approved" || role !== "pending";
    await sendEmail({
      to: target.email,
      subject: approved ? "You're approved — welcome to ASM Roster" : "Your ASM Roster access changed",
      html: approved
        ? emailLayout({
            heading: "Your account is approved",
            body: `<p style="margin:0">Hi ${target.name ? target.name.split(" ")[0] : "there"} — you now have leader access to the ASM Roster. Sign in with the email and password you signed up with.</p>`,
            button: { label: "Sign in →", url: `${siteOrigin(request)}/roster` },
            footer: "Forgot the password you set? Use the “Forgot password?” link on the sign-in screen.",
          })
        : emailLayout({
            heading: "Your access has changed",
            body: `<p style="margin:0">Your ASM Roster access is currently on hold. Reach out to your team admin if you think this is a mistake.</p>`,
          }),
    });
  }

  await audit({
    actor: actingUser.email || "admin",
    email: target.email || lower,
    role,
    status: target.status || null,
    notifyUser: !!shouldNotify,
  });

  return NextResponse.json({ success: true });
}
