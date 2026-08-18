import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import AdminChrome from "../../../components/AdminChrome";
import PublishShare from "./PublishShare";
import { createClient } from "../../../../../utils/supabase/server";
import { getWeekStats } from "../../../../lib/analytics";

type PublishedWeek = {
  id: number;
  series_name: string;
  series_week_number: number;
  title: string;
  status: "draft" | "live";
  scheduled_publish_at: string | null;
  published_at: string | null;
};

// The link a student actually taps. Prefer the church's configured domain
// from settings; fall back to the host this admin screen was served from, so
// the screen still hands out a working link before settings is filled in.
async function siteOrigin(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  const { data } = await supabase.from("settings").select("site_domain").eq("id", 1).maybeSingle();
  const configured = (data as { site_domain?: string } | null)?.site_domain?.trim();
  if (configured) {
    return configured.startsWith("http") ? configured.replace(/\/$/, "") : `https://${configured.replace(/\/$/, "")}`;
  }

  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  return `${proto}://${host}`;
}

export default async function PublishAndSendPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const weekId = Number(id);
  if (!Number.isFinite(weekId)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("weeks")
    .select("id, series_name, series_week_number, title, status, scheduled_publish_at, published_at")
    .eq("id", weekId)
    .maybeSingle();
  if (error || !data) notFound();

  const week = data as PublishedWeek;
  const [origin, stats] = await Promise.all([siteOrigin(supabase), getWeekStats(week.id)]);

  const studentUrl = origin;
  const parentUrl = `${origin}/parents`;

  // Rendered server-side so the screen has a real, downloadable image the
  // moment it loads — nothing to wait on when someone's standing at the
  // projector. Sized and quiet-zoned for a room, not a phone.
  const qrDataUrl = await QRCode.toDataURL(studentUrl, {
    width: 640,
    margin: 3,
    errorCorrectionLevel: "M",
    color: { dark: "#06060aff", light: "#ffffffff" },
  });

  const liveAt = week.published_at ?? week.scheduled_publish_at;
  const subtitle =
    week.status === "live"
      ? liveAt
        ? `Published ${new Date(liveAt).toLocaleString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : "Published"
      : "Still a draft — publish it in the editor before you send this";

  return (
    <AdminChrome active="this-week">
      <div className="admin-mhead">
        <div>
          <h1>
            {week.series_name || "Untitled series"} · Week {week.series_week_number}{" "}
            {week.status === "live" ? "is live" : "is not live yet"}
          </h1>
          <div className="admin-msub">{subtitle}</div>
        </div>
        <span className={`admin-status-badge ${week.status}`}>{week.status === "live" ? "● Live" : "Draft"}</span>
      </div>

      <PublishShare
        weekId={week.id}
        weekTitle={week.title}
        isLive={week.status === "live"}
        studentUrl={studentUrl}
        parentUrl={parentUrl}
        qrDataUrl={qrDataUrl}
        stats={stats}
      />
    </AdminChrome>
  );
}
