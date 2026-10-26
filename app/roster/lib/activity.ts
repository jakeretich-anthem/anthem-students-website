import { kvPut } from "./kv";
import type { RosterUser } from "./auth";

// One entry in the Activity feed (see api/activity/recent). Same 90-day expiry
// and key shape the hangout, note and connection routes write inline.
export async function logActivity(
  user: RosterUser,
  item: { type: string; summary?: string; studentName?: string; sk?: string; id?: string }
) {
  const actKey = `activity:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`;
  await kvPut(
    actKey,
    { ...item, studentName: item.studentName || "", leader: user.name, leaderEmail: user.email, createdAt: new Date().toISOString() },
    90 * 24 * 60 * 60
  );
}
