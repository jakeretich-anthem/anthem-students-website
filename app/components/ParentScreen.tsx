"use client";

import { useEffect, useState } from "react";
import Menu from "./Menu";
import type { MenuSummary } from "../lib/data";

export default function ParentScreen({
  eyebrow,
  title,
  menu,
  children,
}: {
  eyebrow: string;
  title: string;
  menu: MenuSummary;
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
    <div className="parent-screen">
      <div className="appbar parent-appbar">
        <div>
          <div className="parentsub">{eyebrow}</div>
          <h1 className="parenthead">{title}</h1>
        </div>
        <button className="burger parent-burger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          <i />
          <i />
          <i />
        </button>
      </div>
      <div className="screen-body stack">{children}</div>
      <Menu open={menuOpen} onClose={() => setMenuOpen(false)} data={menu} />
    </div>
  );
}
