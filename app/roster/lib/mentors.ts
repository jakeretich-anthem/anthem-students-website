import { logActivity } from "./activity";
import type { RosterUser } from "./auth";

// A student's primary (and optional secondary) mentor. Lives in roster_kv
// under `mentors:{sk}:{id}`, keyed by the stable sheet ID like goals are — the
// sheet has no column for it and doesn't need one.
//
// A mentor is either an app leader (email set — the client resolves name and
// photo from the leader directory, so a renamed leader updates everywhere) or
// a free-text name for a volunteer who has no account (email null).

export type Mentor = { email: string | null; name: string };
export type StudentMentors = {
  primary: Mentor | null;
  secondary: Mentor | null;
  updatedAt?: string;
  updatedBy?: string;
};
export type MentorSlot = "primary" | "secondary";

export const MENTOR_SLOTS: MentorSlot[] = ["primary", "secondary"];

export function mentorKvKey(sk: unknown, id: unknown): string | null {
  if ((sk !== "hs" && sk !== "ms") || typeof id !== "string" || !id) return null;
  return `mentors:${sk}:${id}`;
}

// Returns a cleaned mentor, null for "no mentor", or undefined when the input
// is malformed and the request should be rejected.
export function normalizeMentor(raw: unknown): Mentor | null | undefined {
  if (raw === null || raw === undefined || raw === "") return null;
  if (typeof raw !== "object") return undefined;
  const m = raw as Record<string, unknown>;
  const name = typeof m.name === "string" ? m.name.trim().slice(0, 60) : "";
  const email = typeof m.email === "string" && m.email.trim() ? m.email.trim().toLowerCase() : null;
  if (!name && !email) return null;
  return { email, name: name || email! };
}

// What "the same mentor" means for filtering, replacing and counting: the
// account when there is one, otherwise the name, case-insensitively.
export function mentorIdentity(m: Mentor | null | undefined): string {
  if (!m) return "";
  return m.email ? m.email.toLowerCase() : "name:" + m.name.trim().toLowerCase();
}

export function sameMentor(a: Mentor | null | undefined, b: Mentor | null | undefined): boolean {
  return !!a && !!b && mentorIdentity(a) === mentorIdentity(b);
}

export async function logMentorActivity(
  user: RosterUser,
  item: { type: "mentor_changed" | "mentor_bulk"; summary: string; studentName?: string; sk?: string; id?: string }
) {
  await logActivity(user, item);
}
