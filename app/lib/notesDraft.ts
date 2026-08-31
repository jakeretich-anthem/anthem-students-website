// The contract between the notes parser and the week editor. Field names are
// the parser's own (week_title, verse_ref, label, passage_ref) — they get
// mapped onto the weeks/days columns when a leader accepts the draft, in
// app/admin/week/actions.ts.

export type NotesDraftDay = {
  label: string;
  passage_ref: string;
  passage_text: string;
  thought: string;
  question: string;
};

export type NotesDraft = {
  week_title: string;
  big_idea: string;
  verse_ref: string;
  verse_text: string;
  recap: string;
  heads_up: string;
  starters: string[];
  days: NotesDraftDay[];
};

// Passed to output_config.format, which constrains the model's response to
// exactly this shape. additionalProperties:false and a full required list are
// what make that constraint strict rather than advisory.
//
// The three-days rule is NOT expressed here: structured outputs rejects
// minItems/maxItems above 1 with a 400, which surfaced as a blanket "The API
// call failed" on every parse. The count is carried by the system prompt
// ("days: exactly three") and enforced by isWellFormed() in the route.
export const NOTES_DRAFT_SCHEMA = {
  type: "object",
  properties: {
    week_title: { type: "string", description: "Short, concrete title for the week." },
    big_idea: { type: "string", description: "One sentence a student could repeat back." },
    verse_ref: { type: "string", description: "Memory verse reference only, e.g. '1 Peter 5:7'." },
    verse_text: {
      type: "string",
      description: "Full text of the memory verse, ESV translation, from memory. Empty string if unsure.",
    },
    recap: { type: "string", description: "Two or three sentences on what was talked about." },
    heads_up: {
      type: "string",
      description: "Short parent-facing heads-up about anything sensitive in the week. Empty string if nothing applies.",
    },
    starters: {
      type: "array",
      items: { type: "string" },
      description: "Exactly 3 conversation-starter questions for parents, grounded in the week's content.",
    },
    days: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "The day's title, a few words." },
          passage_ref: { type: "string", description: "Passage reference only, e.g. '1 Peter 5:6-7'." },
          passage_text: {
            type: "string",
            description: "Full text of the day's passage, ESV translation, from memory. Empty string if unsure.",
          },
          thought: { type: "string", description: "One honest paragraph, 3-5 sentences." },
          question: { type: "string", description: "One journal question, not yes/no." },
        },
        required: ["label", "passage_ref", "passage_text", "thought", "question"],
        additionalProperties: false,
      },
    },
  },
  required: ["week_title", "big_idea", "verse_ref", "verse_text", "recap", "heads_up", "starters", "days"],
  additionalProperties: false,
} as const;
