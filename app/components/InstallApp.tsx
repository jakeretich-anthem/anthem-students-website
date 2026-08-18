"use client";

import { useEffect, useState } from "react";

// "Save site as app" — a home-screen install, not an app store download.
// Three states, because the browsers genuinely differ:
//   prompt       Chrome/Edge/Android — a real one-tap install prompt
//   instructions iOS Safari — no install API exists, so we say the steps
//   installed    already opened from the home screen — nothing to offer
type Mode = "prompt" | "instructions" | "installed";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __anthemInstallPrompt: InstallPromptEvent | null;
  }
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari's own flag — it doesn't report the standalone display mode.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function InstallApp() {
  const [mode, setMode] = useState<Mode>("instructions");
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    function sync() {
      if (isStandalone()) {
        setMode("installed");
        return;
      }
      setMode(window.__anthemInstallPrompt ? "prompt" : "instructions");
    }
    sync();

    window.addEventListener("anthem:installable", sync);
    window.addEventListener("anthem:installed", sync);
    return () => {
      window.removeEventListener("anthem:installable", sync);
      window.removeEventListener("anthem:installed", sync);
    };
  }, []);

  async function handleClick() {
    const deferred = window.__anthemInstallPrompt;
    if (!deferred) {
      setShowSteps((v) => !v);
      return;
    }

    // The event is single-use: once prompted, it can't be replayed, so it's
    // cleared either way and the button falls back to the manual steps.
    window.__anthemInstallPrompt = null;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setMode("installed");
      else setMode("instructions");
    } catch {
      setMode("instructions");
    }
  }

  if (mode === "installed") return null;

  return (
    <div className="menu-install">
      <button className="menu-installbtn" type="button" onClick={handleClick} aria-expanded={showSteps}>
        Save site as app
      </button>
      {showSteps && (
        <p className="menu-installsteps">
          On iPhone: tap the share button at the bottom of Safari, then <strong>Add to Home Screen</strong>. On Android:
          open the browser menu, then <strong>Install app</strong>. It saves this page like an app — nothing to download.
        </p>
      )}
    </div>
  );
}
