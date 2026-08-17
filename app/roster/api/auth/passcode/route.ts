import { NextResponse } from "next/server";
import { kvGet, kvPut } from "../../../lib/kv";
import { setSessionCookie } from "../../../lib/auth";
import { timingSafeEqual, generateToken } from "../../../lib/crypto";

type OrgSettings = { access?: { mode?: string; passcode?: string } };

export async function POST(request: Request) {
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

  return NextResponse.json({ ok: true, expiresAt, message: "View-only mode enabled" });
}
