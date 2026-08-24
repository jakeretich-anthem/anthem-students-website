import { kvGet } from "../lib/kv";
import { SETTINGS_KEY } from "../lib/settings";

// The roster's own mark, used unless an org has uploaded a logo in settings.
const FALLBACK_ICONS = [
  { src: "/roster-icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/roster-icon-512.png", sizes: "512x512", type: "image/png" },
];

type OrgSettings = { ministryName?: string; logoEnabled?: boolean; logoUrl?: string };

export async function GET() {
  const settings = await kvGet<OrgSettings>(SETTINGS_KEY);
  const name = settings?.ministryName || "Anthem Students";
  const year = new Date().getFullYear();

  const icons: { src: string; sizes: string; type: string }[] = [];
  if (settings?.logoEnabled && settings?.logoUrl) {
    icons.push({ src: settings.logoUrl, sizes: "192x192", type: "image/png" });
    icons.push({ src: settings.logoUrl, sizes: "512x512", type: "image/png" });
  }
  icons.push(...FALLBACK_ICONS);

  const manifest = {
    name: `ASM ${year} · ${name}`,
    short_name: name.length > 12 ? "ASM Roster" : name,
    description: `Worship Grow Go · ${name} Mentorship Roster`,
    start_url: "/roster",
    display: "standalone",
    background_color: "#0a0a0f",
    theme_color: "#0a0a0f",
    icons,
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
