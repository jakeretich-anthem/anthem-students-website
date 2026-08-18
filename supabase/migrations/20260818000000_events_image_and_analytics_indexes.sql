-- Events grow an image so /admin/events can upload artwork and the
-- student /events screen can show it. Same pattern as week-images:
-- a public bucket, public read, leader-only write.
alter table events add column image_url text;

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "Public read event images"
    on storage.objects for select
    to public
    using (bucket_id = 'event-images');

create policy "Authenticated can manage event images"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'event-images')
    with check (bucket_id = 'event-images');

-- The publish screen's four numbers are all "distinct anon_id for this
-- week and event type" queries. Without this the counts table-scan the
-- whole log, which only grows.
create index analytics_events_week_type_idx
    on analytics_events (week_id, event_type, anon_id);
