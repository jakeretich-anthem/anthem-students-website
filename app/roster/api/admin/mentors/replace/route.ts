import { NextResponse } from "next/server";
import { kvDelete, kvGetMap, kvPut } from "../../../../lib/kv";
import { requireAdmin } from "../../../../lib/auth";
import {
  MENTOR_SLOTS,
  logMentorActivity,
  mentorIdentity,
  normalizeMentor,
  sameMentor,
  type MentorSlot,
  type StudentMentors,
} from "../../../../lib/mentors";

// Hands every student one mentor has over to another (or to nobody, when a
// leader steps away). Admin-only: it rewrites many students in one go.
export async function POST(request: Request) {
  const perm = await requireAdmin();
  if (!perm.ok) return NextResponse.json({ error: perm.error }, { status: perm.status });

  const body = await request.json();
  const from = typeof body.from === "string" ? body.from.trim().toLowerCase() : "";
  if (!from) return NextResponse.json({ error: "from is required" }, { status: 400 });
  const to = normalizeMentor(body.to);
  if (to === undefined) return NextResponse.json({ error: "Invalid mentor" }, { status: 400 });
  if (to && mentorIdentity(to) === from) return NextResponse.json({ success: true, changed: 0 });
  const slots: MentorSlot[] = Array.isArray(body.slots)
    ? MENTOR_SLOTS.filter((s) => body.slots.includes(s))
    : MENTOR_SLOTS;
  if (!slots.length) return NextResponse.json({ error: "Pick at least one slot" }, { status: 400 });

  const now = new Date().toISOString();
  let changed = 0;
  let fromName = "";

  for (const sk of ["hs", "ms"]) {
    const map = await kvGetMap<StudentMentors>(`mentors:${sk}:`);
    for (const [id, cur] of Object.entries(map)) {
      if (!cur) continue;
      let { primary, secondary } = cur;
      let hit = false;
      if (slots.includes("primary") && mentorIdentity(primary) === from) {
        fromName ||= primary!.name;
        primary = to;
        hit = true;
      }
      if (slots.includes("secondary") && mentorIdentity(secondary) === from) {
        fromName ||= secondary!.name;
        secondary = to;
        hit = true;
      }
      if (!hit) continue;
      if (sameMentor(primary, secondary)) secondary = null;
      if (!primary && secondary) [primary, secondary] = [secondary, null];
      const key = `mentors:${sk}:${id}`;
      if (primary || secondary) {
        await kvPut(key, { primary, secondary, updatedAt: now, updatedBy: perm.user.email || perm.user.name });
      } else {
        await kvDelete(key);
      }
      changed++;
    }
  }

  if (changed) {
    await logMentorActivity(perm.user, {
      type: "mentor_bulk",
      summary: `Moved ${changed} student${changed === 1 ? "" : "s"} from ${fromName || from} to ${to ? to.name : "unassigned"}`,
    });
  }

  return NextResponse.json({ success: true, changed });
}
