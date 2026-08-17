-- Anthem Students Hub — initial schema
-- Tables per SPEC.md: weeks, days, events, settings, analytics_events.
-- No student/account table exists — students never authenticate.

create type week_status as enum ('draft', 'live');

create table weeks (
    id                    bigserial primary key,
    series_name           text not null,
    series_week_number    smallint not null,
    series_week_total     smallint not null,
    title                 text not null,
    big_idea              text not null,
    verse_reference       text not null,
    verse_translation     text not null default 'WEB',
    verse_text            text not null,
    recap                 text not null,
    status                week_status not null default 'draft',
    scheduled_publish_at  timestamptz,
    published_at          timestamptz,
    created_at            timestamptz not null default now(),
    updated_at            timestamptz not null default now()
);

create table days (
    id                 bigserial primary key,
    week_id            bigint not null references weeks(id) on delete cascade,
    day_number         smallint not null check (day_number between 1 and 3),
    title              text not null,
    passage_reference  text not null,
    passage_text       text not null,
    thought            text not null,
    question           text not null,
    created_at         timestamptz not null default now(),
    updated_at         timestamptz not null default now(),
    unique (week_id, day_number)
);

create table events (
    id           bigserial primary key,
    title        text not null,
    event_date   date not null,
    time_label   text,
    location     text,
    detail       text,
    signup_url   text,
    created_at   timestamptz not null default now(),
    updated_at   timestamptz not null default now()
);

-- Singleton row: church/site-level configuration.
create table settings (
    id                    smallint primary key default 1 check (id = 1),
    church_name           text not null,
    site_domain           text not null,
    support_email         text not null,
    default_translation   text not null default 'WEB',
    updated_at            timestamptz not null default now()
);

create type analytics_event_type as enum (
    'week_view',
    'day_view',
    'day_complete',
    'verse_practice',
    'parent_guide_view',
    'events_view',
    'archive_view'
);

-- Anonymous analytics log. No student identity, name, email, or journal
-- content is ever written here. anon_id is a random client-generated
-- token (e.g. localStorage), never paired with any identifying data.
create table analytics_events (
    id           bigserial primary key,
    event_type   analytics_event_type not null,
    week_id      bigint references weeks(id) on delete set null,
    day_number   smallint check (day_number between 1 and 3),
    anon_id      text,
    occurred_at  timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────────────
-- Public (anon key): read-only, and only on published weeks/days and
-- events. Everything else — all writes, and reads of drafts, settings,
-- and analytics — requires the authenticated (leader) role.
--
-- analytics_events has no anon policy at all, by design: the app writes
-- analytics rows through a trusted server route using the service role
-- key (which bypasses RLS entirely), not directly from the browser with
-- the anon key. This keeps the log free of a public write endpoint.

alter table weeks enable row level security;
alter table days enable row level security;
alter table events enable row level security;
alter table settings enable row level security;
alter table analytics_events enable row level security;

create policy "Public can read live weeks"
    on weeks for select
    to anon
    using (status = 'live');

create policy "Authenticated can manage weeks"
    on weeks for all
    to authenticated
    using (true)
    with check (true);

create policy "Public can read days of live weeks"
    on days for select
    to anon
    using (
        exists (
            select 1 from weeks
            where weeks.id = days.week_id
              and weeks.status = 'live'
        )
    );

create policy "Authenticated can manage days"
    on days for all
    to authenticated
    using (true)
    with check (true);

create policy "Public can read events"
    on events for select
    to anon
    using (true);

create policy "Authenticated can manage events"
    on events for all
    to authenticated
    using (true)
    with check (true);

create policy "Authenticated can manage settings"
    on settings for all
    to authenticated
    using (true)
    with check (true);

create policy "Authenticated can manage analytics_events"
    on analytics_events for all
    to authenticated
    using (true)
    with check (true);
