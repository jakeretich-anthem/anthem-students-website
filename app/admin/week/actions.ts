"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "../../../utils/supabase/server";
import type { NotesDraft } from "../../lib/notesDraft";

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

// Accepting a parsed-notes draft. This is the only thing the notes feature
// ever writes, and what it writes is a draft: status stays at the column
// default ('draft'), published_at and scheduled_publish_at stay null. The
// leader lands in the editor and decides what happens next (SPEC §6,
// "Automatic publishing" is out of scope).
//
// The parser's field names map onto the schema's here — week_title → title,
// verse_ref → verse_reference, label → title, passage_ref →
// passage_reference. Fields the notes can't supply (verse text, passage
// text, series) are left blank for the leader to fill in rather than
// guessed at.
export async function createWeekFromDraft(draft: NotesDraft) {
  const supabase = await createClient();

  const { data: week, error } = await supabase
    .from("weeks")
    .insert({
      ...BLANK_WEEK,
      title: draft.week_title,
      big_idea: draft.big_idea,
      verse_reference: draft.verse_ref,
      recap: draft.recap,
    })
    .select("id")
    .single();
  if (error || !week) throw new Error(error?.message ?? "Failed to create week from notes");

  const { error: daysError } = await supabase.from("days").insert(
    draft.days.slice(0, 3).map((day, i) => ({
      week_id: week.id,
      day_number: i + 1,
      ...BLANK_DAY,
      title: day.label,
      passage_reference: day.passage_ref,
      thought: day.thought,
      question: day.question,
    }))
  );
  if (daysError) throw new Error(daysError.message);

  redirect(`/admin/week/${week.id}`);
}

export type DeleteWeekResult = { ok: true } | { ok: false; error: string };

// Deleting a week takes its three days with it (days.week_id is ON DELETE
// CASCADE) and blanks the week_id on its analytics rows (ON DELETE SET
// NULL), so past opens still count toward totals without pointing at a
// week that no longer exists.
//
// Middleware already gates every /admin path, and a server action posts to
// the path it was rendered on — but this is the one action that destroys
// content a leader can't get back, so it re-checks the session itself
// rather than inheriting the guarantee.
export async function deleteWeek(id: number): Promise<DeleteWeekResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "That week no longer exists." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "You're signed out — sign in again and retry." };

  const { data, error } = await supabase.from("weeks").delete().eq("id", id).select("id");
  if (error) return { ok: false, error: error.message };
  // RLS refusals come back as zero rows deleted rather than an error, so a
  // silent no-op is reported instead of shown as a success.
  if (!data || data.length === 0) return { ok: false, error: "That week couldn't be deleted — reload and try again." };

  // A deleted week may have been the live one, which changes what every
  // student-facing page renders.
  revalidatePath("/admin/weeks");
  revalidatePath("/");
  revalidatePath("/archive");
  revalidatePath("/parents");
  return { ok: true };
}
