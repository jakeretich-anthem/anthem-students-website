"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteWeek } from "../week/actions";

export type WeekRow = {
  id: number;
  series_name: string;
  series_week_number: number;
  title: string;
  status: "draft" | "live";
  scheduled_publish_at: string | null;
  published_at: string | null;
};

function stateLine(w: WeekRow): string {
  if (w.status === "live") {
    return w.published_at
      ? `Published ${new Date(w.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
      : "Published";
  }
  if (w.scheduled_publish_at) {
    const scheduled = new Date(w.scheduled_publish_at);
    return `Draft · goes live ${scheduled.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`;
  }
  return "Draft";
}

export default function WeeksList({ weeks }: { weeks: WeekRow[] }) {
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Two taps, no browser confirm() — same pattern the events admin uses, and
  // it survives a phone screen where a native dialog is easy to fat-finger.
  async function remove(id: number) {
    setBusy(true);
    setError(null);
    const result = await deleteWeek(id);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfirmingDelete(null);
    router.refresh();
  }

  return (
    <>
      {error && <div className="admin-error">{error}</div>}
      <div className="admin-weeks-list">
        {weeks.map((w) => (
          <div key={w.id} className="admin-weeks-row">
            <Link href={`/admin/week/${w.id}`} className="admin-weeks-rowbody">
              <h3>
                {w.series_name || "Untitled series"} · Week {w.series_week_number}
                {w.title ? ` — ${w.title}` : ""}
              </h3>
              <p>{stateLine(w)}</p>
            </Link>
            <span className={`admin-status-badge ${w.status}`}>{w.status === "live" ? "● Live" : "Draft"}</span>
            <div className="admin-week-tools">
              {confirmingDelete === w.id ? (
                <>
                  {/* A live week is what students see when they open the link,
                      so its confirm says so rather than reading like a draft's. */}
                  <span className="admin-msub">
                    {w.status === "live" ? "Delete the live week?" : "Delete for good?"}
                  </span>
                  <button
                    className="admin-linkbtn danger"
                    type="button"
                    disabled={busy}
                    onClick={() => remove(w.id)}
                  >
                    Yes, delete
                  </button>
                  <button
                    className="admin-linkbtn"
                    type="button"
                    disabled={busy}
                    onClick={() => setConfirmingDelete(null)}
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  className="admin-linkbtn danger"
                  type="button"
                  onClick={() => {
                    setConfirmingDelete(w.id);
                    setError(null);
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
