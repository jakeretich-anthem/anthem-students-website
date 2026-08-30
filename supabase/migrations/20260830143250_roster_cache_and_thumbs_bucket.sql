-- Fast read-cache for the roster grid. The Google Sheet (via the Apps Script)
-- stays the source of truth; this table is a denormalized mirror kept in step
-- by app/roster/lib/rosterSync.ts (a periodic Vercel Cron job) and by a
-- best-effort write-through patch in app/roster/api/sheet/write/route.ts.
-- The client reads this first, for an instant paint, before the authoritative
-- (but much slower) sheet fetch resolves.
create table if not exists roster_cache (
    sk text not null check (sk in ('hs', 'ms')),
    id text not null,
    row_index int,
    name text not null default '',
    grade text,
    school text,
    birthday text,
    status text,
    connected boolean not null default false,
    last_connected text,
    photo_url text,
    thumb_url text,
    notes text,
    updated_at timestamptz not null default now(),
    primary key (sk, id)
);

alter table roster_cache enable row level security;
-- No policies: read/written only through the service-role client
-- (app/roster/lib/supabaseAdmin.ts), which bypasses RLS — same pattern as
-- roster_kv.

-- Low-res thumbnails (a small Drive-generated thumbnail re-hosted here), so
-- the first paint doesn't depend on Google Drive at all. Full-resolution
-- photos still come straight from Drive, loaded progressively after paint.
insert into storage.buckets (id, name, public)
values ('roster-thumbs', 'roster-thumbs', true)
on conflict (id) do nothing;

create policy "Public read roster thumbnails"
    on storage.objects for select
    to public
    using (bucket_id = 'roster-thumbs');
