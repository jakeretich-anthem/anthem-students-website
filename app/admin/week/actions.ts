"use server";

import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";

const BLANK_WEEK = {
  series_name: "",
  series_week_number: 1,
  series_week_total: 1,
  title: "",
  big_idea: "",
  verse_reference: "",
  verse_translation: "WEB",
  verse_text: "",
  recap: "",
};

const BLANK_DAY = {
  title: "",
  passage_reference: "",
  passage_text: "",
  thought: "",
  question: "",
};

export async function createBlankWeek() {
  const supabase = await createClient();

  const { data: week, error } = await supabase.from("weeks").insert(BLANK_WEEK).select("id").single();
  if (error || !week) throw new Error(error?.message ?? "Failed to create week");

  const { error: daysError } = await supabase
    .from("days")
    .insert([1, 2, 3].map((day_number) => ({ week_id: week.id, day_number, ...BLANK_DAY })));
  if (daysError) throw new Error(daysError.message);

  redirect(`/admin/week/${week.id}`);
}

// "Duplicate last week" carries the most recently created week's series,
// content, and day structure forward into a brand new draft — editing
// rather than starting from a blank page. It never touches publish
// state or the source week's image.
export async function duplicateLastWeek() {
  const supabase = await createClient();

  const { data: last, error: lastError } = await supabase
    .from("weeks")
    .select("*, days(*)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastError) throw new Error(lastError.message);

  if (!last) {
    await createBlankWeek();
    return;
  }

  const { data: week, error } = await supabase
    .from("weeks")
    .insert({
      series_name: last.series_name,
      series_week_number: last.series_week_number + 1,
      series_week_total: last.series_week_total,
      title: last.title,
      big_idea: last.big_idea,
      verse_reference: last.verse_reference,
      verse_translation: last.verse_translation,
      verse_text: last.verse_text,
      recap: last.recap,
      heads_up: last.heads_up,
      starters: last.starters,
    })
    .select("id")
    .single();
  if (error || !week) throw new Error(error?.message ?? "Failed to duplicate week");

  const sourceDays = [...(last.days as Array<Record<string, unknown>>)].sort(
    (a, b) => (a.day_number as number) - (b.day_number as number)
  );
  if (sourceDays.length > 0) {
    const { error: daysError } = await supabase.from("days").insert(
      sourceDays.map((d) => ({
        week_id: week.id,
        day_number: d.day_number,
        title: d.title,
        passage_reference: d.passage_reference,
        passage_text: d.passage_text,
        thought: d.thought,
        question: d.question,
      }))
    );
    if (daysError) throw new Error(daysError.message);
  }

  redirect(`/admin/week/${week.id}`);
}
