-- Gate public visibility of "live" weeks on scheduled_publish_at, not just
-- status. This lets a leader mark a week live with a future scheduled
-- time and have it stay invisible to students until that time passes,
-- with no cron/automation required — the gate is just a read-time check.
drop policy if exists "Public can read live weeks" on weeks;
create policy "Public can read published weeks"
    on weeks for select
    to anon
    using (
        status = 'live'
        and (scheduled_publish_at is null or scheduled_publish_at <= now())
    );

drop policy if exists "Public can read days of live weeks" on days;
create policy "Public can read days of published weeks"
    on days for select
    to anon
    using (
        exists (
            select 1 from weeks
            where weeks.id = days.week_id
              and weeks.status = 'live'
              and (weeks.scheduled_publish_at is null or weeks.scheduled_publish_at <= now())
        )
    );
