import { supabaseAdmin } from "./supabaseAdmin";

// Mirrors Cloudflare KV's get/put/delete/list(prefix) semantics on top of
// the roster_kv Postgres table, so the app's original key-value access
// patterns (user:, session:, settings:org, interactions:, activity:,
// invite:, onboard:, pwdreset:, audit:, metric:) port over unchanged.
// Expiry is lazy (checked on read) rather than a background sweep — an
// expired row just reads back as absent.

export async function kvGet<T = unknown>(key: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin()
    .from("roster_kv")
    .select("value, expires_at")
    .eq("key", key)
    .maybeSingle();
  if (error || !data) return null;
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    await kvDelete(key);
    return null;
  }
  return data.value as T;
}

export async function kvPut(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const expires_at = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000).toISOString() : null;
  const { error } = await supabaseAdmin()
    .from("roster_kv")
    .upsert({ key, value, expires_at, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function kvDelete(key: string): Promise<void> {
  await supabaseAdmin().from("roster_kv").delete().eq("key", key);
}

export async function kvList(prefix: string): Promise<{ keys: { name: string }[] }> {
  const { data, error } = await supabaseAdmin()
    .from("roster_kv")
    .select("key, expires_at")
    .like("key", `${prefix}%`)
    .order("key", { ascending: true });
  if (error || !data) return { keys: [] };
  const now = Date.now();
  const keys = data
    .filter((row) => !row.expires_at || new Date(row.expires_at).getTime() >= now)
    .map((row) => ({ name: row.key as string }));
  return { keys };
}

// Every "give me every student's X for this tab" endpoint (goals,
// interactions, notes, connections, photo crops) does this same
// list-then-fetch-each dance. Shared here so the bootstrap route can call it
// directly instead of five separate HTTP round trips back into itself.
export async function kvGetMap<T = unknown>(prefix: string): Promise<Record<string, T | null>> {
  const { keys } = await kvList(prefix);
  const entries = await Promise.all(
    keys.map(async ({ name }) => [name.slice(prefix.length), await kvGet<T>(name)] as const)
  );
  return Object.fromEntries(entries);
}

export async function trackMetric(type: string): Promise<void> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = `metric:${type}:${today}`;
    const val = (await kvGet<{ count: number }>(key)) || { count: 0 };
    val.count++;
    await kvPut(key, val, 90 * 24 * 60 * 60);
  } catch {
    // best-effort metric, matches original's silent catch
  }
}
