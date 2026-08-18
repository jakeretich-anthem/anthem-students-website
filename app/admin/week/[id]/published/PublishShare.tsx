"use client";

import { useState } from "react";
import type { WeekStats } from "../../../../lib/analytics";

type CopyTarget = "message" | "parent";

function defaultMessage(studentUrl: string): string {
  // The mockup's wording, with the real link. It's a starting point, not a
  // template — the box below is editable precisely because the leader who
  // ran the night knows what that night needs to sound like.
  const bare = studentUrl.replace(/^https?:\/\//, "");
  return `Ok so tonight got real. This week's stuff is up — 3 days, like 4 minutes each.\n\n${bare}`;
}

export default function PublishShare({
  weekId,
  weekTitle,
  isLive,
  studentUrl,
  parentUrl,
  qrDataUrl,
  stats,
}: {
  weekId: number;
  weekTitle: string;
  isLive: boolean;
  studentUrl: string;
  parentUrl: string;
  qrDataUrl: string;
  stats: WeekStats;
}) {
  const [message, setMessage] = useState(() => defaultMessage(studentUrl));
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy(text: string, target: CopyTarget) {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      setTimeout(() => setCopied((c) => (c === target ? null : c)), 2000);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission).
      // Say so — a button that silently does nothing is worse than one that
      // tells you to select the text yourself.
      setCopyFailed(true);
    }
  }

  const qrFilename = `anthem-week-${weekId}-qr.png`;

  return (
    <>
      {!isLive && (
        <div className="admin-notlive">
          This week is still a draft, so the link below won&rsquo;t show anything to a student yet. Publish it in the
          editor first.
        </div>
      )}

      <div className="admin-publish-grid">
        <div>
          <label className="admin-label" htmlFor="share-message">
            Send this to the group chat
          </label>
          <textarea
            id="share-message"
            className="admin-sharebox"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            aria-label="Group chat message"
          />

          <div className="admin-actions" style={{ marginTop: 11 }}>
            <button className="btn primary" type="button" onClick={() => copy(message, "message")}>
              {copied === "message" ? "Copied ✓" : "Copy message"}
            </button>
            <button className="btn ghost" type="button" onClick={() => copy(parentUrl, "parent")}>
              {copied === "parent" ? "Copied ✓" : "Copy parent link"}
            </button>
          </div>

          {copyFailed && (
            <p className="admin-copyfail">
              Your browser wouldn&rsquo;t let us reach the clipboard — select the text above and copy it by hand.
            </p>
          )}

          <div className="admin-linknote">
            <div>
              PARENT LINK ·{" "}
              <a href={parentUrl} target="_blank" rel="noreferrer">
                {parentUrl.replace(/^https?:\/\//, "")}
              </a>
            </div>
            <div>
              QR CODE FOR THE PROJECTOR ·{" "}
              <a href={qrDataUrl} download={qrFilename}>
                download
              </a>
            </div>
          </div>

          <div className="admin-qr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code linking to ${studentUrl}`} width={128} height={128} />
            <div>
              <div className="admin-msub">{weekTitle || "This week"}</div>
              <a className="btn ghost admin-qr-btn" href={qrDataUrl} download={qrFilename}>
                Download QR
              </a>
            </div>
          </div>
        </div>

        <div>
          <div className="admin-label">Did anyone open it</div>

          {/* Four numbers, not a dashboard (SPEC §6). Each one counts people,
              not taps — deduped on the anonymous token described in SPEC §3. */}
          <div style={{ padding: "14px 0" }}>
            <div className="admin-bignum">{stats.opensThisWeek}</div>
            <div className="admin-numlabel">Opens this week</div>
          </div>

          <dl className="admin-numrows">
            <div>
              <dt>Last week</dt>
              <dd className="up">{stats.opensLastWeek}</dd>
            </div>
            <div>
              <dt>Parent guide opens</dt>
              <dd>{stats.parentGuideOpens}</dd>
            </div>
            <div>
              <dt>Reached day 3</dt>
              <dd>{stats.reachedDay3}</dd>
            </div>
          </dl>

          <p className="admin-privacynote">
            Counted anonymously. No names, no emails, no IP addresses, no cookies — nothing here can be traced to a
            student.
          </p>
        </div>
      </div>
    </>
  );
}
