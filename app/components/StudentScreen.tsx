"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Menu from "./Menu";

type AppBar =
  | { mode: "home"; label?: string }
  | { mode: "back"; href: string; label: string; step: string };

export default function StudentScreen({
  appbar,
  quiet,
  children,
}: {
  appbar: AppBar;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className={`screen${quiet ? " quiet" : ""}`}>
      <div className="appbar">
        {appbar.mode === "home" ? (
          <div className="wordmark">{appbar.label ?? "Anthem Students"}</div>
        ) : (
          <Link href={appbar.href} className="backbtn">
            ← {appbar.label}
          </Link>
        )}
        <div className="appbar-right">
          {appbar.mode === "back" && <div className="stepmark">{appbar.step}</div>}
          <button className="burger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
            <i />
            <i />
            <i />
          </button>
        </div>
      </div>
      <div className="screen-body">{children}</div>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} />
    </div>
  );
}
