import type { MetadataRoute } from "next";

// Backs the "Save site as app" button in the menu. Installing is the whole
// point of the manifest here — SPEC §6 rules out a native/downloadable app,
// and this isn't one: it's the same web pages, saved to a home screen, with
// no store presence and nothing to update.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Anthem Students",
    short_name: "Anthem",
    description: "One link, sent every Thursday, for the week between Wednesday nights.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#06060a",
    theme_color: "#06060a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
