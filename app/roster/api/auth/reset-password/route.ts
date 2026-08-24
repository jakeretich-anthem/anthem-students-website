import { NextResponse } from "next/server";
import { kvDelete, kvGet, kvList, kvPut } from "../../../lib/kv";
import type { RosterUser } from "../../../lib/auth";
import { describePasswordProblem, hashPassword, hashToken } from "../../../lib/crypto";

// A reset is what someone does when they think their account is compromised,
// so it has to end any session opened with the old password.
async function revokeSessions(email: string) {
  const list = await kvList("session:");
  await Promise.all(
    list.keys.map(async (key) => {
      const sess = await kvGet<{ email?: string }>(key.name);
      if (sess?.email && sess.email.toLowerCase() === email.toLowerCase()) {
        await kvDelete(key.name);
      }
    })
  );
}

export async function POST(request: Request) {
  const { token, newPassword, confirmPassword } = await request.json();
  if (!token || !newPassword) return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Those passwords don't match." }, { status: 400 });
  }

  const problem = describePasswordProblem(newPassword);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const tokenHash = await hashToken(token);
  const rec = await kvGet<{ email?: string }>(`pwdreset:${tokenHash}`);
  if (!rec?.email) {
    return NextResponse.json(
      { error: "This reset link has expired or was already used. Request a new one." },
      { status: 400 }
    );
  }

  const user = await kvGet<RosterUser>(`user:${rec.email}`);
  if (!user) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

  user.passwordHash = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await kvPut(`user:${user.email}`, user);
  await kvDelete(`pwdreset:${tokenHash}`);
  await revokeSessions(rec.email);

  return NextResponse.json({ success: true, email: user.email });
}
