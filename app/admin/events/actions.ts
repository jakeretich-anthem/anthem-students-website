"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "../../../utils/supabase/server";

// Events are the one admin surface that writes straight to a student-facing
// page with no draft state — /events reads the table directly. So these
// actions validate rather than trusting the form, and every one of them
// revalidates both the admin list and the student screen it feeds.

export type EventActionResult = { ok: true } | { ok: false; error: string };

function text(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim() : "";
}

function optionalText(form: FormData, key: string): string | null {
  const v = text(form, key);
  return v === "" ? null : v;
}

function validate(form: FormData): { title: string; event_date: string } | { error: string } {
  const title = text(form, "title");
  if (!title) return { error: "An event needs a title." };

  const event_date = text(form, "event_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(event_date)) return { error: "Pick a date for the event." };

  const signup = text(form, "signup_url");
  if (signup) {
    let parsed: URL;
    try {
      parsed = new URL(signup);
    } catch {
      return { error: "The sign-up link isn't a valid URL — include https://" };
    }
    // Students tap this link. Only ever hand them http(s), never a
    // javascript: or data: URL pasted into the form.
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { error: "The sign-up link has to be an http:// or https:// address." };
    }
  }

  return { title, event_date };
}

function fields(form: FormData, title: string, event_date: string) {
  return {
    title,
    event_date,
    time_label: optionalText(form, "time_label"),
    location: optionalText(form, "location"),
    detail: optionalText(form, "detail"),
    signup_url: optionalText(form, "signup_url"),
    image_url: optionalText(form, "image_url"),
  };
}

function revalidate() {
  revalidatePath("/admin/events");
  revalidatePath("/events");
}

export async function createEvent(form: FormData): Promise<EventActionResult> {
  const checked = validate(form);
  if ("error" in checked) return { ok: false, error: checked.error };

  const supabase = await createClient();
  const { error } = await supabase.from("events").insert(fields(form, checked.title, checked.event_date));
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function updateEvent(form: FormData): Promise<EventActionResult> {
  const id = Number(form.get("id"));
  if (!Number.isInteger(id)) return { ok: false, error: "That event no longer exists." };

  const checked = validate(form);
  if ("error" in checked) return { ok: false, error: checked.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from("events")
    .update({ ...fields(form, checked.title, checked.event_date), updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}

export async function deleteEvent(id: number): Promise<EventActionResult> {
  if (!Number.isInteger(id)) return { ok: false, error: "That event no longer exists." };

  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  revalidate();
  return { ok: true };
}
