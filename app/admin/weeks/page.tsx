import Link from "next/link";
import AdminChrome from "../components/AdminChrome";
import { createClient } from "../../../utils/supabase/server";
import { createBlankWeek, duplicateLastWeek } from "../week/actions";

type WeekRow = {
  id: number;
  series_name: string;
  series_week_number: number;
  title: string;
  status: "draft" | "live";
  scheduled_publish_at: string | null;
  published_at: string | null;
};

export default async function AdminWeeksPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("weeks")
    .select("id, series_name, series_week_number, title, status, scheduled_publish_at, published_at")
    .order("created_at", { ascending: false });
  const weeks = (data ?? []) as WeekRow[];

  return (
    <AdminChrome active="all-weeks">
      <div className="admin-mhead">
        <div>
          <h1>All Weeks</h1>
          <div className="admin-msub">{weeks.length} total</div>
        </div>
        <div className="admin-actions" style={{ marginTop: 0 }}>
          <form action={duplicateLastWeek}>
            <button className="btn ghost" type="submit">
              Duplicate last week
            </button>
          </form>
          <form action={createBlankWeek}>
            <button className="btn ghost" type="submit">
              Start blank
            </button>
          </form>
          <Link className="btn primary" href="/admin/week/new">
            + New week from notes
          </Link>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="emptystate">
          <div className="kicker">No weeks yet</div>
          <p>Start with a new week to get the first one drafted.</p>
        </div>
      ) : (
        <div className="admin-weeks-list">
          {weeks.map((w) => {
            const scheduled = w.scheduled_publish_at ? new Date(w.scheduled_publish_at) : null;
            return (
              <Link key={w.id} href={`/admin/week/${w.id}`} className="admin-weeks-row">
                <div>
                  <h5>
                    {w.series_name || "Untitled series"} · Week {w.series_week_number}
                    {w.title ? ` — ${w.title}` : ""}
                  </h5>
                  <p>
                    {w.status === "live"
                      ? w.published_at
                        ? `Published ${new Date(w.published_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                        : "Published"
                      : scheduled
                      ? `Draft · goes live ${scheduled.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                      : "Draft"}
                  </p>
                </div>
                <span className={`admin-status-badge ${w.status}`}>{w.status === "live" ? "● Live" : "Draft"}</span>
                <span className="chev">›</span>
              </Link>
            );
          })}
        </div>
      )}
    </AdminChrome>
  );
}
