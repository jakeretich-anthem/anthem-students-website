import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for the hub's own tables. Bypasses RLS — server-only,
// never imported into client code.
//
// analytics_events has no anon RLS policy at all (see the initial migration):
// students' browsers can't write to it directly, so every analytics row goes
// through this client from a trusted route. That's what keeps the log free of
// a public write endpoint.
//
// Deliberately separate from app/roster/lib/supabaseAdmin.ts — /roster runs
// its own auth and is excluded from this app's middleware; the two don't
// import across that boundary.
let client: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    }
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
