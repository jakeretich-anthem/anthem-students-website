import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "../../../../utils/supabase/server";
import { NOTES_DRAFT_SCHEMA, type NotesDraft } from "../../../lib/notesDraft";

// The Anthropic call lives here and only here. ANTHROPIC_API_KEY is read
// from the server environment, never sent to the browser, and never
// embedded in any response — the client posts raw notes and gets back
// parsed fields, nothing else.
export const runtime = "nodejs";

const MODEL = "claude-sonnet-5";
const MAX_NOTES_CHARS = 40_000;

const SYSTEM_PROMPT = `You turn a youth pastor's raw Wednesday-night lesson notes into a draft
three-day devotional week for high school students.

The notes are messy on purpose — bullet fragments, shorthand, half sentences,
markdown headings, scripture references scrawled mid-thought. Work with what is
there. Derive the week from the notes rather than inventing a lesson of your own:
if the notes name a passage, a key line, or an application, those belong in the
draft.

What you are writing:
- week_title: the title of the week. Short, concrete, in the voice of the notes.
- big_idea: one sentence a student could repeat back. The single thing the night
  was about.
- verse_ref: the memory verse reference alone, e.g. "1 Peter 5:7". Pick the verse
  the notes lean on hardest.
- verse_text: the full text of that verse, ESV translation, from your own
  knowledge of scripture. If the notes quote it directly, match their wording
  instead of the ESV. Leave this an empty string only if you aren't confident
  which passage the reference points to — never guess at wording.
- recap: two or three sentences telling a student what was talked about, written
  to be read days later by someone who was in the room.
- heads_up: one or two sentences flagging anything a parent should know going
  in — a heavy topic, a personal disclosure, something raised that a parent
  might want to follow up on at home. Empty string if nothing in the notes
  calls for it.
- starters: exactly three conversation-starter questions a parent could ask
  their student about this week, grounded in the notes' actual content — not
  generic "how was youth group" questions.
- days: exactly three. Each is one sitting of about four minutes.
  - label: the day's title, a few words.
  - passage_ref: reference only, e.g. "1 Peter 5:6-7".
  - passage_text: the full text of that passage, ESV translation, from your
    own knowledge of scripture. Same rule as verse_text: match the notes'
    wording if they quote it, leave empty only if you aren't confident which
    passage this is.
  - thought: one honest paragraph, 3-5 sentences, that says something true
    rather than something tidy. Write to a 15-year-old without writing down to
    one. No rhetorical questions here — the question field is the question.
  - question: one question a student answers privately in a journal. Answerable,
    specific, not a yes/no.

The three days should move — a progression across the week, not the same point
said three ways.

If the notes are too thin to support a field honestly, write the best short
draft you can from what is there rather than padding it out. A leader reviews
and edits every word of this before anything is published.`;

export async function POST(request: Request) {
  // /api/* sits outside the middleware's /admin guard, so this route does its
  // own check. Without it, an unauthenticated caller could spend the API key.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { ok: false, error: "ANTHROPIC_API_KEY isn't set on the server. Add it and restart, or start blank." },
      { status: 503 }
    );
  }

  let notes: string;
  try {
    const body = (await request.json()) as { notes?: unknown };
    notes = typeof body.notes === "string" ? body.notes.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, error: "Couldn't read the request." }, { status: 400 });
  }

  if (!notes) {
    return NextResponse.json({ ok: false, error: "Paste some notes first." }, { status: 400 });
  }
  if (notes.length > MAX_NOTES_CHARS) {
    return NextResponse.json(
      { ok: false, error: `Those notes are longer than ${MAX_NOTES_CHARS.toLocaleString()} characters — trim them and try again.` },
      { status: 400 }
    );
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      output_config: { format: { type: "json_schema", schema: NOTES_DRAFT_SCHEMA } },
      messages: [{ role: "user", content: `Here are Wednesday night's notes:\n\n${notes}` }],
    });

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { ok: false, error: "The model declined to draft from these notes. Edit them and try again, or start blank." },
        { status: 422 }
      );
    }

    const text = response.content.find((block) => block.type === "text")?.text;
    if (!text) {
      return NextResponse.json(
        { ok: false, error: "Came back empty. Try again, or start blank." },
        { status: 502 }
      );
    }

    // output_config.format constrains the response to the schema, so this
    // should always parse. It can still fail on a truncated response (a
    // notes dump that runs past max_tokens), and a half-parsed draft is
    // worse than no draft — so the failure is explicit and retryable
    // rather than silently producing a half-filled week.
    let draft: NotesDraft;
    try {
      draft = JSON.parse(text) as NotesDraft;
    } catch {
      console.error("[parse-notes] unparseable response, stop_reason:", response.stop_reason);
      return NextResponse.json(
        {
          ok: false,
          error:
            response.stop_reason === "max_tokens"
              ? "The draft got cut off partway through. Try again with shorter notes."
              : "That came back in a shape we couldn't read. Try again, or start blank.",
        },
        { status: 502 }
      );
    }

    if (!isWellFormed(draft)) {
      return NextResponse.json(
        { ok: false, error: "The draft came back incomplete. Try again, or start blank." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true, draft });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      console.error("[parse-notes] bad ANTHROPIC_API_KEY");
      return NextResponse.json(
        { ok: false, error: "The server's Anthropic key was rejected. Check it, or start blank." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { ok: false, error: "Rate limited by the API. Wait a moment and try again." },
        { status: 429 }
      );
    }
    // A 400 is a malformed request, not a hiccup — retrying sends the exact
    // same bad request. Log the API's own message so the cause is visible in
    // the server logs instead of hiding behind a generic "try again".
    if (err instanceof Anthropic.BadRequestError) {
      console.error("[parse-notes] rejected request:", err.message);
      return NextResponse.json(
        { ok: false, error: "The parser sent a request the API rejected. This one won't fix itself on a retry — start blank and tell Jake." },
        { status: 502 }
      );
    }
    if (err instanceof Anthropic.APIError) {
      console.error(`[parse-notes] API error ${err.status}:`, err.message);
      return NextResponse.json(
        { ok: false, error: "The API call failed. Try again, or start blank." },
        { status: 502 }
      );
    }
    console.error("[parse-notes] unexpected failure:", err);
    return NextResponse.json(
      { ok: false, error: "Something went wrong reading those notes. Try again, or start blank." },
      { status: 500 }
    );
  }
}

// Guards the shape the editor depends on — three days, every field a string —
// so a surprising response surfaces as "try again" instead of as a week
// editor full of `undefined`.
function isWellFormed(draft: NotesDraft): boolean {
  const str = (v: unknown) => typeof v === "string";
  return (
    !!draft &&
    str(draft.week_title) &&
    str(draft.big_idea) &&
    str(draft.verse_ref) &&
    str(draft.verse_text) &&
    str(draft.recap) &&
    str(draft.heads_up) &&
    Array.isArray(draft.starters) &&
    Array.isArray(draft.days) &&
    draft.days.length === 3 &&
    draft.days.every(
      (d) => d && str(d.label) && str(d.passage_ref) && str(d.passage_text) && str(d.thought) && str(d.question)
    )
  );
}
