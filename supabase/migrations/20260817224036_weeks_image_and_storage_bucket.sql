alter table weeks add column image_url text;

insert into storage.buckets (id, name, public)
values ('week-images', 'week-images', true)
on conflict (id) do nothing;

create policy "Public read week images"
    on storage.objects for select
    to public
    using (bucket_id = 'week-images');

create policy "Authenticated can manage week images"
    on storage.objects for all
    to authenticated
    using (bucket_id = 'week-images')
    with check (bucket_id = 'week-images');
