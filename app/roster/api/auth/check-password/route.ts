import { NextResponse } from "next/server";
import { kvGet } from "../../../lib/kv";
import { timingSafeEqual } from "../../../lib/crypto";

type OrgSettings = { access?: { mode?: string; passcode?: string } };

export async function POST(request: Request) {
  const { password } = await request.json();
  const settings = await kvGet<OrgSettings>("settings:org");
  const correct =
    settings?.access?.mode === "shared-passcode" && settings.access.passcode
      ? settings.access.passcode
      : process.env.SITE_PASSWORD || "";
  return NextResponse.json({ ok: timingSafeEqual(password || "", correct) });
}
