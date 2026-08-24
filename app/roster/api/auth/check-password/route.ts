import { NextResponse } from "next/server";
import { kvGet } from "../../../lib/kv";
import { timingSafeEqual } from "../../../lib/crypto";
import { checkRateLimit, clientKey, tooManyRequests } from "../../../lib/rateLimit";

// NOTE: this endpoint has no callers in the client (nothing in clientScript.ts
// fetches it) and no auth, which makes it an oracle for the shared passcode —
// it will confirm a guess to anyone who asks. Rate-limited here so it can't be
// brute-forced, but it is a candidate for deletion.

type OrgSettings = { access?: { mode?: string; passcode?: string } };

export async function POST(request: Request) {
  const ip = clientKey(request);
  if (ip) {
    const limit = await checkRateLimit("check-password", `ip:${ip}`, 10, 15 * 60);
    if (!limit.ok) return tooManyRequests("Too many attempts.", limit.retryAfter);
  }

  const { password } = await request.json();
  const settings = await kvGet<OrgSettings>("settings:org");
  const correct =
    settings?.access?.mode === "shared-passcode" && settings.access.passcode
      ? settings.access.passcode
      : process.env.SITE_PASSWORD || "";
  return NextResponse.json({ ok: timingSafeEqual(password || "", correct) });
}
