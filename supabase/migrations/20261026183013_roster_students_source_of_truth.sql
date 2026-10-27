-- The roster's source of truth, replacing the Google Sheet. Populated once
-- from the sheet (same ids, same row order, same values) and written to
-- directly by app/roster/api/students/write/route.ts from then on. The sheet
-- is kept as a frozen backup; nothing reads from or writes to it any more.
--
-- roster_cache (the old read-mirror) is left in place until the new code is
-- deployed, so the currently-deployed site keeps working through cutover. A
-- follow-up migration drops it.
create table if not exists roster_students (
    sk text not null check (sk in ('hs', 'ms')),
    -- Same 8-char shape the Apps Script minted, so goals/notes/mentors/etc.
    -- in roster_kv (keyed `{kind}:{sk}:{id}`) keep pointing at the right kid.
    id text not null default substr(replace(gen_random_uuid()::text, '-', ''), 1, 8),
    row_index int not null,
    name text not null check (length(name) between 1 and 200),
    grade text not null default '',
    school text not null default '',
    birthday text not null default '',
    status text not null default 'core' check (status in ('core', 'loose', 'fringe')),
    connected boolean not null default false,
    last_connected text not null default '',
    photo_url text not null default '',
    thumb_url text,
    notes text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (sk, id)
);

create index if not exists roster_students_sk_row_index_idx on roster_students (sk, row_index);

alter table roster_students enable row level security;
-- No policies: read/written only through the service-role client
-- (app/roster/lib/supabaseAdmin.ts), which bypasses RLS — same as roster_kv.

-- Public buckets serve /object/public/ URLs without any policy. These two
-- SELECT policies only added the ability for anyone holding the anon key to
-- *list* every file in the bucket — i.e. enumerate every student photo.
-- Nothing in the app lists these buckets, so drop them.
drop policy if exists "Public read roster photos" on storage.objects;
drop policy if exists "Public read roster thumbnails" on storage.objects;
