import Link from "next/link";
import AdminChrome from "../components/AdminChrome";
import WeeksList, { type WeekRow } from "./WeeksList";
import { createClient } from "../../../utils/supabase/server";
import { createBlankWeek, duplicateLastWeek } from "../week/actions";

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
        <WeeksList weeks={weeks} />
      )}
    </AdminChrome>
  );
}
