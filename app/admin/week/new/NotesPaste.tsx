"use client";

import { useState } from "react";
import { createBlankWeek, createWeekFromDraft } from "../actions";
import type { NotesDraft } from "../../../lib/notesDraft";

const PLACEHOLDER = `# PRESSURE — Week 2

## Name It
Everybody's holding something. Nobody says it.

## Key Line
You were never the one holding it together.

## Teaching Points
— 1 Peter 5:6–7, humble yourselves
— "casting" is a violent word, a throw
— pride and anxiety are the same root

## Application
— name one thing you're carrying alone…`;

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

export default function NotesPaste() {
  const [notes, setNotes] = useState("");
  const [draft, setDraft] = useState<NotesDraft | null>(null);
  const [parsing, setParsing] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function parse() {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/parse-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      const data = (await res.json()) as { ok: boolean; draft?: NotesDraft; error?: string };
      if (!res.ok || !data.ok || !data.draft) {
        setDraft(null);
        setError(data.error ?? "That didn't work. Try again, or start blank.");
        return;
      }
      setDraft(data.draft);
    } catch {
      setDraft(null);
      setError("Couldn't reach the server. Try again, or start blank.");
    } finally {
      setParsing(false);
    }
  }

  async function accept() {
    if (!draft) return;
    setAccepting(true);
    setError(null);
    try {
      await createWeekFromDraft(draft);
    } catch (err) {
      // A redirect throws by design in Next — that's the success path, not a
      // failure, so let it through rather than reporting it as an error.
      if (err && typeof err === "object" && "digest" in err && String(err.digest).startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      setAccepting(false);
      setError("Couldn't save that draft. Try again.");
    }
  }

  const busy = parsing || accepting;

  return (
    <>
      <div className="admin-mhead">
        <div>
          <h1>Start from your lesson notes</h1>
          <div className="admin-msub">Paste · review · edit · publish</div>
        </div>
        {/* Skippable — a leader who'd rather type it fresh clicks past it. */}
        <form action={createBlankWeek}>
          <button className="btn ghost admin-skip" type="submit" disabled={busy}>
            Skip, start blank
          </button>
        </form>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-notes-grid">
        <div>
          <label className="admin-label" htmlFor="notes">
            Paste Wednesday&rsquo;s notes
          </label>
          <textarea
            id="notes"
            className="admin-paste"
            value={notes}
            placeholder={PLACEHOLDER}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
          <div className="admin-actions" style={{ marginTop: 11 }}>
            <button className="btn primary" onClick={parse} disabled={busy || !notes.trim()} type="button">
              {parsing ? "Reading your notes…" : draft ? "Read them again" : "Read my notes"}
            </button>
          </div>
        </div>

        <div className="admin-notes-arrow" aria-hidden="true">
          →
        </div>

        <div>
          <div className="admin-label">What we pulled out</div>

          {!draft ? (
            <div className="admin-notes-empty">
              {parsing
                ? "Working through them…"
                : "Paste your notes and the week comes back roughly filled in. Nothing gets saved or published until you say so."}
            </div>
          ) : (
            <>
              <div className="admin-outfield">
                <div className="ol">Week title</div>
                {draft.week_title}
              </div>
              <div className="admin-outfield">
                <div className="ol">Big idea</div>
                {draft.big_idea}
              </div>
              <div className="admin-outfield">
                <div className="ol">Verse</div>
                {draft.verse_ref}
              </div>
              <div className="admin-outfield">
                <div className="ol">Recap</div>
                {truncate(draft.recap, 120)}
              </div>
              <div className="admin-outfield">
                <div className="ol">Day prompts · {draft.days.length} drafted</div>
                {draft.days.map((d) => d.label).join(" / ")}
              </div>

              <div className="admin-actions" style={{ marginTop: 14 }}>
                <button className="btn primary" onClick={accept} disabled={busy} type="button">
                  {accepting ? "Opening the editor…" : "Use these & edit"}
                </button>
                <button className="btn ghost" onClick={parse} disabled={busy} type="button">
                  Try again
                </button>
              </div>
              <p className="admin-notes-promise">
                Nothing is live yet — this opens as a draft you edit and publish yourself.
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
