import { kvDelete, kvGet, kvPut } from "./kv";
import { supabaseAdmin } from "./supabaseAdmin";
import type { RosterUser } from "./auth";

// A leader's email is their account key (`user:{email}`) and is also copied
// into everything that points back at them — live sessions, mentor
// assignments, and the authorship on notes, hangouts, connections and
// activity (which decides who may edit or delete a note). Changing it means
// moving the account and rewriting every one of those, or the leader would
// be signed out and lose the ability to edit their own notes.
const REFERENCING_PREFIXES = [
  "session:",
  "mentors:",
  "notes:",
  "interactions:",
  "connections:",
  "activity:",
  "signupAction:",
  "pwdreset:",
  "onboard:",
  "invite:",
];
const EMAIL_FIELDS = new Set(["email", "leaderEmail", "updatedBy", "createdBy"]);

function rewrite(value: unknown, from: string, to: string): { value: unknown; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((item) => {
      const r = rewrite(item, from, to);
      changed ||= r.changed;
      return r.value;
    });
    return { value: out, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (EMAIL_FIELDS.has(k) && typeof v === "string" && v.toLowerCase() === from) {
        out[k] = to;
        changed = true;
      } else {
        const r = rewrite(v, from, to);
        changed ||= r.changed;
        out[k] = r.value;
      }
    }
    return { value: out, changed };
  }
  return { value, changed: false };
}

export async function renameUserEmail(
  fromEmail: string,
  toEmail: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const from = fromEmail.trim().toLowerCase();
  const to = toEmail.trim().toLowerCase();

  const user = await kvGet<RosterUser>(`user:${from}`);
  if (!user) return { ok: false, status: 404, error: "User not found" };
  if (await kvGet(`user:${to}`)) {
    return { ok: false, status: 409, error: "Another account already uses that email." };
  }

  // New record first, old one last — a failure partway leaves the account
  // reachable under the new address rather than gone.
  await kvPut(`user:${to}`, { ...user, email: to });

  const db = supabaseAdmin();
  for (const prefix of REFERENCING_PREFIXES) {
    const { data, error } = await db
      .from("roster_kv")
      .select("key, value, expires_at")
      .like("key", `${prefix}%`);
    if (error) throw new Error(error.message);
    const updates = (data || [])
      .map((row) => ({ row, r: rewrite(row.value, from, to) }))
      .filter(({ r }) => r.changed)
      .map(({ row, r }) => ({
        key: row.key,
        value: r.value,
        expires_at: row.expires_at,
        updated_at: new Date().toISOString(),
      }));
    if (updates.length) {
      const { error: upsertError } = await db.from("roster_kv").upsert(updates);
      if (upsertError) throw new Error(upsertError.message);
    }
  }

  await kvDelete(`user:${from}`);
  return { ok: true };
}
