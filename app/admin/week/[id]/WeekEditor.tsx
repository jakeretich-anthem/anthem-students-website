"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "../../../../utils/supabase/client";
import { duplicateLastWeek } from "../actions";
import type { DbDay, DbWeek } from "../../../lib/data";

type FormWeek = Omit<DbWeek, "starters" | "scheduled_publish_at"> & {
  starters: [string, string, string];
  scheduled_publish_at: string; // datetime-local value, "" when unset
};

type SaveState = "idle" | "saving" | "saved" | "error";

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

function padStarters(arr: string[]): [string, string, string] {
  return [arr[0] ?? "", arr[1] ?? "", arr[2] ?? ""];
}

export default function WeekEditor({ initialWeek, initialDays }: { initialWeek: DbWeek; initialDays: DbDay[] }) {
  const [week, setWeek] = useState<FormWeek>({
    ...initialWeek,
    starters: padStarters(initialWeek.starters ?? []),
    scheduled_publish_at: toDatetimeLocal(initialWeek.scheduled_publish_at),
  });
  const [days, setDays] = useState<DbDay[]>(initialDays);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [uploading, setUploading] = useState(false);

  const skipFirstRun = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (skipFirstRun.current) {
      skipFirstRun.current = false;
      return;
    }
    setSaveState("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void save();
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [week, days]);

  async function save() {
    setSaveState("saving");
    const supabase = createClient();

    const { error: weekError } = await supabase
      .from("weeks")
      .update({
        series_name: week.series_name,
        series_week_number: week.series_week_number,
        series_week_total: week.series_week_total,
        title: week.title,
        big_idea: week.big_idea,
        verse_reference: week.verse_reference,
        verse_translation: week.verse_translation,
        verse_text: week.verse_text,
        recap: week.recap,
        heads_up: week.heads_up,
        starters: week.starters,
        image_url: week.image_url,
        status: week.status,
        scheduled_publish_at: fromDatetimeLocal(week.scheduled_publish_at),
        published_at: week.published_at,
      })
      .eq("id", week.id);

    const dayResults = await Promise.all(
      days.map((d) =>
        supabase
          .from("days")
          .update({
            title: d.title,
            passage_reference: d.passage_reference,
            passage_text: d.passage_text,
            thought: d.thought,
            question: d.question,
          })
          .eq("id", d.id)
      )
    );
    const dayError = dayResults.find((r) => r.error)?.error;

    setSaveState(weekError || dayError ? "error" : "saved");
  }

  function updateWeek<K extends keyof FormWeek>(key: K, value: FormWeek[K]) {
    setWeek((w) => ({ ...w, [key]: value }));
  }

  function updateStarter(i: number, value: string) {
    setWeek((w) => {
      const next = [...w.starters] as [string, string, string];
      next[i] = value;
      return { ...w, starters: next };
    });
  }

  function updateDay(dayNumber: number, key: keyof DbDay, value: string) {
    setDays((ds) => ds.map((d) => (d.day_number === dayNumber ? { ...d, [key]: value } : d)));
  }

  function toggleStatus() {
    setWeek((w) => {
      const goingLive = w.status !== "live";
      return {
        ...w,
        status: goingLive ? "live" : "draft",
        published_at: goingLive && !w.published_at ? new Date().toISOString() : w.published_at,
      };
    });
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    const path = `week-${week.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("week-images").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("week-images").getPublicUrl(path);
      updateWeek("image_url", data.publicUrl);
    }
    setUploading(false);
  }

  const autosaveLabel =
    saveState === "saving"
      ? "Saving…"
      : saveState === "saved"
      ? "◉ Saved"
      : saveState === "error"
      ? "Save failed"
      : "";

  return (
    <>
      <div className="admin-mhead">
        <div>
          <h1>
            {week.series_name || "Untitled series"} · Week {week.series_week_number}
          </h1>
          <div className="admin-msub">{week.title || "Untitled week"}</div>
        </div>
        <div className="admin-mhead-right">
          {autosaveLabel && (
            <span className="admin-autosave" data-state={saveState}>
              {autosaveLabel}
            </span>
          )}
          <span className={`admin-status-badge ${week.status}`}>{week.status === "live" ? "● Live" : "Draft"}</span>
        </div>
      </div>

      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Series name</label>
          <input
            className="admin-input"
            value={week.series_name}
            onChange={(e) => updateWeek("series_name", e.target.value)}
          />
        </div>
        <div className="admin-fgrid cols-3" style={{ margin: 0 }}>
          <div className="admin-field">
            <label className="admin-label">Week #</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              value={week.series_week_number}
              onChange={(e) => updateWeek("series_week_number", Number(e.target.value))}
            />
          </div>
          <div className="admin-field">
            <label className="admin-label">Of</label>
            <input
              className="admin-input"
              type="number"
              min={1}
              value={week.series_week_total}
              onChange={(e) => updateWeek("series_week_total", Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Week title</label>
          <input className="admin-input" value={week.title} onChange={(e) => updateWeek("title", e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Big idea — one sentence</label>
          <input
            className="admin-input"
            value={week.big_idea}
            onChange={(e) => updateWeek("big_idea", e.target.value)}
          />
        </div>
      </div>

      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Verse reference</label>
          <input
            className="admin-input"
            value={week.verse_reference}
            onChange={(e) => updateWeek("verse_reference", e.target.value)}
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Translation</label>
          <input
            className="admin-input"
            value={week.verse_translation}
            onChange={(e) => updateWeek("verse_translation", e.target.value)}
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Verse text</label>
        <textarea
          className="admin-input"
          value={week.verse_text}
          onChange={(e) => updateWeek("verse_text", e.target.value)}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Recap — what we talked about</label>
        <textarea
          className="admin-input tall"
          value={week.recap}
          onChange={(e) => updateWeek("recap", e.target.value)}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Heads up for parents (optional)</label>
        <textarea
          className="admin-input"
          value={week.heads_up ?? ""}
          onChange={(e) => updateWeek("heads_up", e.target.value)}
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Conversation starters</label>
        {week.starters.map((s, i) => (
          <input
            key={i}
            className="admin-input"
            style={{ marginBottom: i < 2 ? 8 : 0 }}
            value={s}
            onChange={(e) => updateStarter(i, e.target.value)}
            placeholder={`Starter ${i + 1}`}
          />
        ))}
      </div>

      <div className="admin-field">
        <label className="admin-label">Week graphic</label>
        <div className="admin-imgpick">
          <div
            className="admin-imgpick-preview"
            style={week.image_url ? { backgroundImage: `url(${week.image_url})` } : undefined}
          />
          <div>
            <input type="file" accept="image/*" onChange={handleImageChange} disabled={uploading} />
            {uploading && <div className="admin-msub">Uploading…</div>}
          </div>
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">The three days</label>
        {days.map((d) => (
          <div className="admin-daybox" key={d.id}>
            <div className="admin-daybox-head">Day {d.day_number}</div>
            <div className="admin-fgrid">
              <div className="admin-field">
                <label className="admin-label">Title</label>
                <input
                  className="admin-input"
                  value={d.title}
                  onChange={(e) => updateDay(d.day_number, "title", e.target.value)}
                />
              </div>
              <div className="admin-field">
                <label className="admin-label">Passage reference</label>
                <input
                  className="admin-input"
                  value={d.passage_reference}
                  onChange={(e) => updateDay(d.day_number, "passage_reference", e.target.value)}
                />
              </div>
            </div>
            <div className="admin-field">
              <label className="admin-label">Passage text</label>
              <textarea
                className="admin-input"
                value={d.passage_text}
                onChange={(e) => updateDay(d.day_number, "passage_text", e.target.value)}
              />
            </div>
            <div className="admin-field">
              <label className="admin-label">The thought</label>
              <textarea
                className="admin-input"
                value={d.thought}
                onChange={(e) => updateDay(d.day_number, "thought", e.target.value)}
              />
            </div>
            <div className="admin-field" style={{ marginBottom: 0 }}>
              <label className="admin-label">Question</label>
              <input
                className="admin-input"
                value={d.question}
                onChange={(e) => updateDay(d.day_number, "question", e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Status</label>
          <div className="toggle" style={{ paddingTop: 4 }}>
            <span>{week.status === "live" ? "Published" : "Draft"}</span>
            <button
              className="sw"
              data-on={week.status === "live"}
              role="switch"
              aria-checked={week.status === "live"}
              aria-label="Draft or published"
              onClick={toggleStatus}
              type="button"
            />
          </div>
        </div>
        <div className="admin-field">
          <label className="admin-label">Scheduled publish</label>
          <input
            className="admin-input"
            type="datetime-local"
            value={week.scheduled_publish_at}
            onChange={(e) => updateWeek("scheduled_publish_at", e.target.value)}
          />
        </div>
      </div>

      <div className="admin-actions">
        <a className="btn ghost" href={`/admin/week/${week.id}/preview`} target="_blank" rel="noreferrer">
          Preview as student
        </a>
        <form action={duplicateLastWeek}>
          <button className="btn ghost" type="submit">
            Duplicate last week
          </button>
        </form>
        <a className="btn primary" href={`/admin/week/${week.id}/published`}>
          Publish &amp; send →
        </a>
      </div>
    </>
  );
}
