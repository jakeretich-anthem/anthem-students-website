import { NextResponse } from "next/server";
import { kvGet } from "../../../lib/kv";
import { DEFAULT_ROSTER_SETTINGS, SETTINGS_KEY } from "../../../lib/settings";

// No auth — used for branding on the passcode/login gate screen.
export async function GET() {
  const stored = await kvGet(SETTINGS_KEY);
  const s = { ...DEFAULT_ROSTER_SETTINGS, ...(stored as typeof DEFAULT_ROSTER_SETTINGS) };
  return NextResponse.json({
    ministryName: s.ministryName,
    campus: s.campus,
    logoUrl: s.logoEnabled && s.logoUrl ? s.logoUrl : "",
    logoTone: s.logoTone || "light",
    logoEnabled: s.logoEnabled,
    gradeTabs: s.gradeTabs,
    tracking: s.tracking,
    appearance: s.appearance,
    permissions: s.permissions,
    accessMode: s.access?.mode || "leaders-only",
  });
}
