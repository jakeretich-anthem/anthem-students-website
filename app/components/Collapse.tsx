"use client";

import { useState } from "react";

export default function Collapse({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button className="collapse" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{label}</span>
        <span className="chev" style={{ marginLeft: 0 }}>
          {open ? "⌃" : "⌄"}
        </span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </div>
  );
}
