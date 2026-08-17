import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Service-role client for the roster app's own tables (roster_kv, the
// roster-photos bucket). Bypasses RLS — server-only, never imported into
// client code. Session tokens and password hashes live behind this.
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
