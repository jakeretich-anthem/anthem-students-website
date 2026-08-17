import { notFound } from "next/navigation";
import AdminChrome from "../../components/AdminChrome";
import WeekEditor from "./WeekEditor";
import { createClient } from "../../../../utils/supabase/server";
import type { DbDay, DbWeek } from "../../../lib/data";

export default async function AdminWeekEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const weekId = Number(id);
  if (!Number.isFinite(weekId)) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.from("weeks").select("*, days(*)").eq("id", weekId).maybeSingle();
  if (error || !data) notFound();

  const week = data as DbWeek;
  const days = [...(data.days as DbDay[])].sort((a, b) => a.day_number - b.day_number);

  return (
    <AdminChrome active={null}>
      <WeekEditor initialWeek={week} initialDays={days} />
    </AdminChrome>
  );
}
