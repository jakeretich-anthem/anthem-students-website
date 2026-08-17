"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { MenuSummary } from "../lib/data";

export default function Menu({
  open,
  onClose,
  data,
}: {
  open: boolean;
  onClose: () => void;
  data: MenuSummary;
}) {
  const pathname = usePathname();
  const [reduceEffects, setReduceEffects] = useState(false);

  useEffect(() => {
    setReduceEffects(document.documentElement.getAttribute("data-reduce-effects") === "true");
  }, []);

  function toggleReduceEffects() {
    const next = !reduceEffects;
    setReduceEffects(next);
    document.documentElement.setAttribute("data-reduce-effects", next ? "true" : "false");
    try {
      localStorage.setItem("anthemReduceEffects", next ? "true" : "false");
    } catch {
      // localStorage unavailable — the toggle still works for this visit
    }
  }

  const items = [
    {
      href: "/",
      label: "This Week",
      small: data.seriesName ? `${data.seriesName} · Week ${data.seriesWeekNumber}` : "Nothing published yet",
    },
    { href: "/verse", label: "Memory Verse", small: data.verseReference ?? "Nothing to practice yet" },
    { href: "/events", label: "Events", small: `${data.eventsCount} coming up` },
    { href: "/archive", label: "Past Weeks", small: `${data.archiveCount} in the archive` },
    { href: "/parents", label: "For Parents", small: "This week's guide" },
  ];

  return (
    <div className="menu" data-closed={!open} role="dialog" aria-modal="true" aria-label="Menu" aria-hidden={!open}>
      <div className="menu-inner">
        <div className="menu-head">
          <div className="wordmark">Anthem Students</div>
          <button className="menu-close" onClick={onClose} aria-label="Close menu">
            ✕
          </button>
        </div>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`menuitem${pathname === item.href ? " active" : ""}`}
            onClick={onClose}
          >
            {item.label}
            <small>{item.small}</small>
          </Link>
        ))}
        <div className="toggle">
          <span>Reduce screen effects</span>
          <button
            className="sw"
            data-on={reduceEffects}
            role="switch"
            aria-checked={reduceEffects}
            aria-label="Reduce screen effects"
            onClick={toggleReduceEffects}
          />
        </div>
      </div>
    </div>
  );
}
