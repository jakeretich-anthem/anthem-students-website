// ── Roster student contract ─────────────────────────────────────────
//
// Students live in the roster_students table (one row per student, keyed by
// tab + id). The client speaks camelCase; the table is snake_case. Goals,
// notes, mentors, connection logs and photo crops are not columns here — they
// live in roster_kv under `{kind}:{sk}:{id}`, which is why ids never change.

export type SheetKey = "hs" | "ms";

export const SHEET_KEYS: SheetKey[] = ["hs", "ms"];

export type Status = "core" | "loose" | "fringe";

export const STATUSES: Status[] = ["core", "loose", "fringe"];

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
  birthday: string; // YYYY-MM-DD, or free text carried over from the sheet
  photoUrl: string;
  thumbUrl: string | null;
  notes: string;
};

export type StudentRow = {
  sk: SheetKey;
  id: string;
  row_index: number;
  name: string;
  grade: string;
  school: string;
  birthday: string;
  status: Status;
  connected: boolean;
  last_connected: string;
  photo_url: string;
  thumb_url: string | null;
  notes: string;
};

export const STUDENT_COLUMNS =
  "sk, id, row_index, name, grade, school, birthday, status, connected, last_connected, photo_url, thumb_url, notes";

export function rowToStudent(row: StudentRow): Student {
  return {
    id: row.id,
    rowIndex: row.row_index,
    name: row.name,
    grade: row.grade,
    school: row.school,
    birthday: row.birthday,
    status: row.status,
    connected: row.connected,
    lastConnected: row.last_connected,
    photoUrl: row.photo_url,
    thumbUrl: row.thumb_url,
    notes: row.notes,
  };
}
