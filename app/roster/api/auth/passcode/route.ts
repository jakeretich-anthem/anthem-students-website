import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { setSessionCookie } from "../../../lib/auth";
import { timingSafeEqual, generateToken } from "../../../lib/crypto";
import { checkRateLimit, clearRateLimit, clientKey, tooManyRequests } from "../../../lib/rateLimit";

type OrgSettings = { access?: { mode?: string; passcode?: string } };

export async function POST(request: Request) {
  const ip = clientKey(request);
  if (ip) {
    // Loose on purpose: the view-only passcode is shared, so a group arriving
    // together shares one public IP and would otherwise lock each other out.
    const limit = await checkRateLimit("passcode", `ip:${ip}`, 30, 15 * 60);
    if (!limit.ok) {
      return tooManyRequests(
        `Too many attempts. Try again in ${Math.ceil(limit.retryAfter / 60)} minutes.`,
        limit.retryAfter
      );
    }
  }

  let passcode = "";
  try {
    ({ passcode = "" } = await request.json());
  } catch {
    // no body
  }

  let correct = "";
  const settings = await kvGet<OrgSettings>("settings:org");
  if (settings?.access?.mode === "shared-passcode" && settings.access.passcode) {
    correct = settings.access.passcode;
  } else {
    correct = process.env.SITE_PASSWORD || "";
  }
  if (!correct || !passcode) return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });
  if (!timingSafeEqual(passcode, correct)) return NextResponse.json({ error: "Invalid passcode" }, { status: 401 });

  const TTL = 8 * 60 * 60;
  const token = generateToken();
  const expiresAt = Date.now() + TTL * 1000;
  await kvPut(`session:${token}`, { type: "passcode", expiresAt }, TTL);
  await setSessionCookie(token, TTL);
  if (ip) await clearRateLimit("passcode", `ip:${ip}`);

  return NextResponse.json({ ok: true, expiresAt, message: "View-only mode enabled" });
}
