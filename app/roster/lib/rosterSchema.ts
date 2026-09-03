// ── Roster sheet contract ───────────────────────────────────────────
//
// Replaces the old sheetSchema.ts compat layer. That file existed because the
// Apps Script read each tab by fixed column position against one hard-coded
// field list, so most values arrived under the wrong name and the app had to
// un-scramble them. The script now maps by header name per tab and emits these
// field names directly, so nothing needs translating — this module only states
// the contract and checks that the script is honouring it.
//
// Sheet columns (both tabs, identical):
//   A Student · B Last connection date · C Connected This Quarter? ·
//   D Connection Status · E Grade · F School · G Birthday · H (spacer) ·
//   I Link to Photo · J NOTES · K ID
//
// Goals and primary goal are no longer in the sheet at all — they live in
// roster_kv under `goals:{sk}:{id}`. See api/student/goals/route.ts.

export type SheetKey = "hs" | "ms";

// The exact strings in column C. Writing anything else would fail the sheet's
// data validation, so these are the only two values the app ever sends.
export const CONNECTED_YES = "Family Connected With";
export const CONNECTED_NO = "Not Connected";

export type Status = "core" | "loose" | "fringe";

export const STATUSES: Status[] = ["core", "loose", "fringe"];

// Internal key -> the label in column D and in the UI. The script matches
// column D case-insensitively against these labels.
export const STATUS_LABELS: Record<Status, string> = {
  core: "Core",
  loose: "Loosely Connected",
  fringe: "Fringe",
};

export type Student = {
  id: string;
  rowIndex: number;
  name: string;
  lastConnected: string; // YYYY-MM-DD, or "" when never connected
  connected: boolean;
  status: Status;
  grade: string;
  school: string;
  birthday: string; // YYYY-MM-DD, or the raw cell text when unparseable
  photoUrl: string;
  notes: string;
};

export type RosterPayload = Record<SheetKey, { students: Student[] }>;

// IMP-05 asked for a shape assertion here so that a mapping regression in the
// Apps Script surfaces as a loud error rather than as wrong data on a student's
// card — which is exactly how the last one went unnoticed. Returns null when
// the payload is good, or the reason it isn't.
export function describePayloadProblem(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return "the response wasn't an object";

  const data = payload as Record<string, unknown>;

  for (const sk of ["hs", "ms"] as SheetKey[]) {
    const tab = data[sk] as { students?: unknown } | undefined;
    if (!tab || typeof tab !== "object") return `the "${sk}" tab is missing`;
    if (!Array.isArray(tab.students)) return `the "${sk}" tab has no students array`;
  }

  // A tab full of rows whose `status` isn't one of the three means the script
  // is still reading column D by the old position, or the sheet's validation
  // list was reworded. Either way the dropdowns would all read "Core".
  const rows = [
    ...((data.hs as { students: unknown[] }).students ?? []),
    ...((data.ms as { students: unknown[] }).students ?? []),
  ] as Record<string, unknown>[];

  if (rows.length && rows.every((r) => !STATUSES.includes(r.status as Status))) {
    return "no student came back with a recognisable Connection Status";
  }

  return null;
}
