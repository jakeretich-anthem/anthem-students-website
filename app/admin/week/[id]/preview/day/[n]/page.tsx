import { notFound } from "next/navigation";
import StudentScreen from "../../../../../../components/StudentScreen";
import { createClient } from "../../../../../../../utils/supabase/server";
import { getMenuSummary } from "../../../../../../lib/data";
import type { DbDay, DbWeek } from "../../../../../../lib/data";

export default async function AdminWeekPreviewDayPage({
  params,
}: {
  params: Promise<{ id: string; n: string }>;
}) {
  const { id, n } = await params;
  const weekId = Number(id);
  if (!Number.isFinite(weekId)) notFound();

  const supabase = await createClient();
  const [{ data, error }, menu] = await Promise.all([
    supabase.from("weeks").select("*, days(*)").eq("id", weekId).maybeSingle(),
    getMenuSummary(),
  ]);
  if (error || !data) notFound();

  const week = data as DbWeek;
  const days = [...(data.days as DbDay[])].sort((a, b) => a.day_number - b.day_number);
  const day = days.find((d) => String(d.day_number) === n);
  if (!day) notFound();

  return (
    <StudentScreen
      appbar={{
        mode: "back",
        href: `/admin/week/${week.id}/preview`,
        label: "This week",
        step: `Day ${day.day_number} / ${days.length}`,
      }}
      menu={menu}
      quiet
    >
      <p className="bigidea" style={{ fontSize: 23 }}>
        {day.title || "Untitled"}
      </p>

      <div style={{ height: 13 }} />

      <div className="passage">
        <div className="pref">{day.passage_reference}</div>
        <p>{day.passage_text}</p>
      </div>

      <div className="thought">{day.thought}</div>

      <div className="dashrule" />

      <div className="question">{day.question}</div>

      <div className="journalnote">✎ Write your answer in your journal</div>
    </StudentScreen>
  );
}
