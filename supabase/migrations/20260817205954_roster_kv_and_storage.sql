-- Backfills the migration history for roster_kv and the roster-photos bucket,
-- which were applied directly to the project (this exact version is already
-- recorded in supabase_migrations.schema_migrations) but never had a local
-- file in this repo. Reconstructed from the live schema so the repo becomes
-- reproducible; not re-applied since the version is already marked as run.
create table if not exists roster_kv (
    key text primary key,
    value jsonb not null,
    expires_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table roster_kv enable row level security;
-- No policies: this table is only ever touched through the service-role
-- client in app/roster/lib/supabaseAdmin.ts, which bypasses RLS.

insert into storage.buckets (id, name, public)
values ('roster-photos', 'roster-photos', true)
on conflict (id) do nothing;

create policy "Public read roster photos"
    on storage.objects for select
    to public
    using (bucket_id = 'roster-photos');
