import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anthem Students",
  description: "One link, sent every Thursday, for the week between Wednesday nights.",
  // iOS ignores the manifest's display mode — these are what make a
  // home-screen save open chromeless instead of in a Safari tab.
  appleWebApp: {
    capable: true,
    title: "Anthem",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06060a",
};

// Reads the reduce-effects preference before first paint so there's no
// scanline/glow flash on load. Kept as a tiny inline script (not a React
// effect) for the same reason dark-mode toggles do this.
const REDUCE_EFFECTS_INIT = `
(function () {
  try {
    var v = localStorage.getItem("anthemReduceEffects");
    if (v === "true") {
      document.documentElement.setAttribute("data-reduce-effects", "true");
    }
  } catch (e) {}
})();
`;

// Chrome fires beforeinstallprompt once, and often before React has
// hydrated — so it's caught here and parked on window for the menu's
// install button to pick up whenever it mounts. Without this the button
// would miss the event on a cold load and fall back to instructions on a
// browser that could have installed in one tap.
const INSTALL_PROMPT_INIT = `
(function () {
  window.__anthemInstallPrompt = null;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    window.__anthemInstallPrompt = e;
    window.dispatchEvent(new Event("anthem:installable"));
  });
  window.addEventListener("appinstalled", function () {
    window.__anthemInstallPrompt = null;
    window.dispatchEvent(new Event("anthem:installed"));
  });
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script dangerouslySetInnerHTML={{ __html: REDUCE_EFFECTS_INIT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_PROMPT_INIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
