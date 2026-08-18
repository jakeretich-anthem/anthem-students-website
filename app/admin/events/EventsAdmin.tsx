"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "../../../utils/supabase/client";
import { createEvent, deleteEvent, updateEvent } from "./actions";
import type { DbEvent } from "../../lib/data";

type Draft = {
  title: string;
  event_date: string;
  time_label: string;
  location: string;
  detail: string;
  signup_url: string;
  image_url: string;
};

const EMPTY: Draft = {
  title: "",
  event_date: "",
  time_label: "",
  location: "",
  detail: "",
  signup_url: "",
  image_url: "",
};

function toDraft(evt: DbEvent): Draft {
  return {
    title: evt.title,
    event_date: evt.event_date,
    time_label: evt.time_label ?? "",
    location: evt.location ?? "",
    detail: evt.detail ?? "",
    signup_url: evt.signup_url ?? "",
    image_url: evt.image_url ?? "",
  };
}

function toFormData(draft: Draft, id?: number): FormData {
  const form = new FormData();
  if (id !== undefined) form.set("id", String(id));
  for (const [key, value] of Object.entries(draft)) form.set(key, value);
  return form;
}

function EventForm({
  draft,
  setDraft,
  onSubmit,
  onCancel,
  submitLabel,
  busy,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  onSubmit: () => void;
  onCancel?: () => void;
  submitLabel: string;
  busy: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof Draft>(key: K, value: string) {
    setDraft({ ...draft, [key]: value });
  }

  async function handleImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    const supabase = createClient();
    // Timestamped path so re-uploading for the same event never collides
    // with the image students may already have cached.
    const path = `event-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("event-images").upload(path, file, { upsert: true });
    if (!error) {
      const { data } = supabase.storage.from("event-images").getPublicUrl(path);
      set("image_url", data.publicUrl);
    }
    setUploading(false);
  }

  return (
    <div className="admin-daybox">
      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Title</label>
          <input className="admin-input" value={draft.title} onChange={(e) => set("title", e.target.value)} />
        </div>
        <div className="admin-field">
          <label className="admin-label">Date</label>
          <input
            className="admin-input"
            type="date"
            value={draft.event_date}
            onChange={(e) => set("event_date", e.target.value)}
          />
        </div>
      </div>

      <div className="admin-fgrid">
        <div className="admin-field">
          <label className="admin-label">Time</label>
          <input
            className="admin-input"
            value={draft.time_label}
            onChange={(e) => set("time_label", e.target.value)}
            placeholder="6:30–9:00 PM"
          />
        </div>
        <div className="admin-field">
          <label className="admin-label">Location</label>
          <input
            className="admin-input"
            value={draft.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Student Center"
          />
        </div>
      </div>

      <div className="admin-field">
        <label className="admin-label">Detail — cost, deadline, what to bring</label>
        <textarea className="admin-input" value={draft.detail} onChange={(e) => set("detail", e.target.value)} />
      </div>

      <div className="admin-field">
        <label className="admin-label">Sign-up link (external registration)</label>
        <input
          className="admin-input"
          value={draft.signup_url}
          onChange={(e) => set("signup_url", e.target.value)}
          placeholder="https://"
        />
      </div>

      <div className="admin-field">
        <label className="admin-label">Event image</label>
        <div className="admin-imgpick">
          <div
            className="admin-imgpick-preview"
            style={draft.image_url ? { backgroundImage: `url(${draft.image_url})` } : undefined}
          />
          <div>
            <input type="file" accept="image/*" onChange={handleImage} disabled={uploading || busy} />
            {uploading && <div className="admin-msub">Uploading…</div>}
            {draft.image_url && !uploading && (
              <button className="admin-linkbtn" type="button" onClick={() => set("image_url", "")}>
                Remove image
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="admin-actions" style={{ marginTop: 4 }}>
        <button className="btn primary" type="button" onClick={onSubmit} disabled={busy || uploading}>
          {submitLabel}
        </button>
        {onCancel && (
          <button className="btn ghost" type="button" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default function EventsAdmin({ events }: { events: DbEvent[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [newDraft, setNewDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY);
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<{ ok: boolean; error?: string }>, onDone: () => void) {
    setBusy(true);
    setError(null);
    const result = await action();
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "That didn't save.");
      return;
    }
    onDone();
    router.refresh();
  }

  function startEdit(evt: DbEvent) {
    setEditingId(evt.id);
    setEditDraft(toDraft(evt));
    setConfirmingDelete(null);
    setError(null);
  }

  return (
    <>
      <div className="admin-mhead">
        <div>
          <h1>Events</h1>
          <div className="admin-msub">
            {events.length} {events.length === 1 ? "event" : "events"} · shown on /events
          </div>
        </div>
        {!adding && (
          <button
            className="btn primary admin-skip"
            type="button"
            onClick={() => {
              setAdding(true);
              setNewDraft(EMPTY);
              setEditingId(null);
              setError(null);
            }}
          >
            + New event
          </button>
        )}
      </div>

      {error && <div className="admin-error">{error}</div>}

      {adding && (
        <EventForm
          draft={newDraft}
          setDraft={setNewDraft}
          busy={busy}
          submitLabel={busy ? "Saving…" : "Add event"}
          onSubmit={() =>
            run(
              () => createEvent(toFormData(newDraft)),
              () => {
                setAdding(false);
                setNewDraft(EMPTY);
              }
            )
          }
          onCancel={() => {
            setAdding(false);
            setError(null);
          }}
        />
      )}

      {events.length === 0 && !adding ? (
        <div className="emptystate">
          <div className="kicker">Nothing on the calendar yet</div>
          <p>Add an event and it shows up on the students&rsquo; events screen right away.</p>
        </div>
      ) : (
        <div className="admin-weeks-list">
          {events.map((evt) =>
            editingId === evt.id ? (
              <EventForm
                key={evt.id}
                draft={editDraft}
                setDraft={setEditDraft}
                busy={busy}
                submitLabel={busy ? "Saving…" : "Save changes"}
                onSubmit={() =>
                  run(
                    () => updateEvent(toFormData(editDraft, evt.id)),
                    () => setEditingId(null)
                  )
                }
                onCancel={() => {
                  setEditingId(null);
                  setError(null);
                }}
              />
            ) : (
              <div key={evt.id} className="admin-weeks-row admin-event-row">
                <div
                  className="admin-event-thumb"
                  style={evt.image_url ? { backgroundImage: `url(${evt.image_url})` } : undefined}
                  aria-hidden="true"
                />
                <div className="admin-event-body">
                  <h5>{evt.title}</h5>
                  <p>
                    {new Date(`${evt.event_date}T00:00:00Z`).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      timeZone: "UTC",
                    })}
                    {[evt.time_label, evt.location].filter(Boolean).length > 0 &&
                      ` · ${[evt.time_label, evt.location].filter(Boolean).join(" · ")}`}
                  </p>
                </div>
                <div className="admin-event-tools">
                  {confirmingDelete === evt.id ? (
                    <>
                      <span className="admin-msub">Delete for good?</span>
                      <button
                        className="admin-linkbtn danger"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          run(
                            () => deleteEvent(evt.id),
                            () => setConfirmingDelete(null)
                          )
                        }
                      >
                        Yes, delete
                      </button>
                      <button className="admin-linkbtn" type="button" onClick={() => setConfirmingDelete(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="admin-linkbtn" type="button" onClick={() => startEdit(evt)}>
                        Edit
                      </button>
                      <button className="admin-linkbtn danger" type="button" onClick={() => setConfirmingDelete(evt.id)}>
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </>
  );
}
