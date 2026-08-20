// ── Google Sheet compatibility layer ────────────────────────────────
//
// The Apps Script behind GOOGLE_SCRIPT_URL reads each sheet by fixed column
// POSITION and labels the values with one hard-coded field list. The two
// sheets don't share a column order, so most values come back under the wrong
// name — verified against the live sheet (114 rows):
//
//   HS   col -> arrives as   actually holds
//        3      date          the connection status ("Family Connected With")
//        5      grade         interest / sport   (Soccer, Basketball, Guitar)
//        6      school        grade              (9, 10, 11, 12, 13)
//        7      birthday      school             (Grace, Newbury high school)
//        8      interest      birthday           (ISO date strings)
//
//   MS   col -> arrives as   actually holds
//        1      photoUrl      interest / sport   (Baseball, ballet, dancer)
//        3      date          grade              (6, 7, 8, 9)
//        4      notes         school             (Colina, Homeschool, Redwood)
//        5      grade         birthday           (ISO date strings)
//        7      birthday      photo URL          (Google Drive links)
//
// The same script also returns every row in `core` and passes the sheet's
// "CORE 👇" / "LOOSELY CONNECTED 👇" / "FRINGE 👇" divider rows through as if
// they were students, which is why two of the three roster sections are
// always empty.
//
// The real fix belongs in the Apps Script: map columns by reading the header
// row per sheet, split on the divider rows, and stop emitting them. Until
// that happens this module translates in both directions so the app shows the
// right values.
//
// IMPORTANT: the read and write mappings are exact inverses of each other. A
// value read out of a column and written back unchanged lands in the column it
// came from, so this layer cannot scramble the sheet even if a mapping below
// is mislabelled — the worst case is a value displayed under the wrong label,
// which is where we already were.
//
// When the Apps Script is fixed, delete this file and the two call sites in
// api/sheet/read and api/sheet/write. `looksLikeLegacyLayout()` logs a warning
// when the incoming data stops matching the shape documented above, which is
// the signal that the compat layer has outlived its usefulness.

export type SheetKey = "hs" | "ms";

export const CONNECTED_YES = "Family Connected With";
export const CONNECTED_NO = "Needs Connection";

// Keys the Apps Script emits, mapped to the field they actually carry.
// Anything not listed passes through under its own name.
const LEGACY_READ_MAP: Record<SheetKey, Record<string, string>> = {
  hs: {
    grade: "interest",
    school: "grade",
    birthday: "school",
    interest: "birthday",
  },
  ms: {
    photoUrl: "interest",
    date: "grade",
    notes: "school",
    grade: "birthday",
    birthday: "photoUrl",
  },
};

// Fields the app knows about that have no column on a given sheet. Writing
// them would land in a neighbouring column and overwrite real data, so they
// are dropped instead. (Before this layer existed, saving Notes on a middle
// schooler overwrote their School.)
const UNWRITABLE: Record<SheetKey, string[]> = {
  hs: [],
  ms: ["notes", "connected", "primaryGoal"],
};

function invert(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [scriptKey, appField] of Object.entries(map)) out[appField] = scriptKey;
  return out;
}

const LEGACY_WRITE_MAP: Record<SheetKey, Record<string, string>> = {
  hs: invert(LEGACY_READ_MAP.hs),
  ms: invert(LEGACY_READ_MAP.ms),
};

export type SheetRow = Record<string, unknown>;

// `<input type="date">` only accepts YYYY-MM-DD. The sheet hands back full ISO
// timestamps ("2011-03-07T08:00:00.000Z") and the occasional JS Date string
// ("Wed Jun 01 2011 …"), both of which the input silently rejects, leaving the
// birthday field blank in the edit modal. Both forms represent local midnight
// pushed into UTC, so the UTC calendar date is the one that was typed in.
export function normalizeDate(value: unknown): unknown {
  if (typeof value !== "string" || !value.trim()) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function isDividerRow(row: SheetRow): boolean {
  return /👇/.test(String(row.name ?? ""));
}

function sectionForDivider(row: SheetRow): "core" | "loose" | "fringe" {
  const label = String(row.name ?? "").toUpperCase();
  if (label.includes("LOOSE")) return "loose";
  if (label.includes("FRINGE")) return "fringe";
  return "core";
}

// True when the payload still has the column scramble documented above. Used
// only to warn — the mapping itself is deliberately static so that read and
// write can never disagree about which layout is in play.
export function looksLikeLegacyLayout(sk: SheetKey, rows: SheetRow[]): boolean {
  const students = rows.filter((r) => !isDividerRow(r) && String(r.name ?? "").trim());
  if (students.length === 0) return true; // nothing to judge; leave the mapping on

  const hits = students.filter((r) =>
    sk === "hs"
      ? typeof r.school === "number" || /^\d+$/.test(String(r.school ?? ""))
      : typeof r.date === "number" || /^\d+$/.test(String(r.date ?? ""))
  ).length;

  return hits > students.length / 2;
}

// Applies a rename map without letting an unmapped key clobber a renamed one.
// The maps are permutations — on HS, `school` both supplies `grade` and is
// supplied by `birthday` — so a naive single pass would overwrite a translated
// value with whatever happened to share its name later in the object.
function applyRenames(source: SheetRow, map: Record<string, string>, drop: string[] = []): SheetRow {
  const consumed = new Set(Object.keys(map));
  const produced = new Set(Object.values(map));
  const out: SheetRow = {};

  // Keys that neither feed a rename nor collide with one pass straight through.
  for (const [key, value] of Object.entries(source)) {
    if (consumed.has(key) || produced.has(key) || drop.includes(key)) continue;
    out[key] = value;
  }

  // Then the renames themselves, which always win.
  for (const [from, to] of Object.entries(map)) {
    if (drop.includes(from)) continue;
    out[to] = from in source ? source[from] : "";
  }

  return out;
}

function translateRow(sk: SheetKey, row: SheetRow): SheetRow {
  const out = applyRenames(row, LEGACY_READ_MAP[sk]);

  if (sk === "hs") {
    // The HS connection status lives in the column that arrives as `date`,
    // which nothing in the UI reads. Turn it into the boolean the cards,
    // stats, and the connected filter all expect.
    out.connected = String(row.date ?? "").trim().toLowerCase() === CONNECTED_YES.toLowerCase();
    delete out.date;
  } else {
    out.connected = false;
  }

  out.birthday = normalizeDate(out.birthday);
  return out;
}

// Turns one sheet's flat row list into the { core, loose, fringe } shape the
// client renders, splitting on the divider rows and dropping them.
export function normalizeSheet(sk: SheetKey, raw: unknown): {
  core: SheetRow[];
  loose: SheetRow[];
  fringe: SheetRow[];
} {
  const buckets = { core: [] as SheetRow[], loose: [] as SheetRow[], fringe: [] as SheetRow[] };
  const source = (raw ?? {}) as Record<string, SheetRow[]>;

  // The script puts everything in `core`, but read all three so this keeps
  // working if it ever starts splitting them itself.
  const rows = [...(source.core ?? []), ...(source.loose ?? []), ...(source.fringe ?? [])];

  if (!looksLikeLegacyLayout(sk, rows)) {
    console.warn(
      `[roster/sheet] ${sk}: column layout no longer matches the documented legacy shape. ` +
        `If the Apps Script was fixed, delete app/roster/lib/sheetSchema.ts and its two call sites.`
    );
  }

  let current: "core" | "loose" | "fringe" = "core";
  for (const row of rows) {
    if (isDividerRow(row)) {
      current = sectionForDivider(row);
      continue;
    }
    if (!String(row.name ?? "").trim()) continue; // blank spacer rows
    buckets[current].push(translateRow(sk, row));
  }

  return buckets;
}

export function normalizeRosterPayload(payload: unknown): {
  hs: ReturnType<typeof normalizeSheet>;
  ms: ReturnType<typeof normalizeSheet>;
} {
  const data = (payload ?? {}) as Record<string, unknown>;
  return { hs: normalizeSheet("hs", data.hs), ms: normalizeSheet("ms", data.ms) };
}

// The inverse of translateRow, for anything the client sends back to the sheet.
export function denormalizeFields(sk: SheetKey, fields: SheetRow): SheetRow {
  // Only rename what the caller actually sent — a partial update (the photo-only
  // write on the student detail screen, say) must not blank the other columns.
  const map = LEGACY_WRITE_MAP[sk];
  const present: Record<string, string> = {};
  for (const [field, key] of Object.entries(map)) {
    if (field in fields) present[field] = key;
  }

  const out = applyRenames(fields, present, [...UNWRITABLE[sk], "connected"]);

  if (sk === "hs" && "connected" in fields) {
    out.date = fields.connected ? CONNECTED_YES : CONNECTED_NO;
  }

  return out;
}
