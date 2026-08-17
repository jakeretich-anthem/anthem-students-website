-- Seed: one complete published week — Series "Pressure", Week 2 of 4.
-- Content matches mockups.html (Screens 01, 02, 09, 10, 11).

with new_week as (
    insert into weeks (
        series_name, series_week_number, series_week_total,
        title, big_idea,
        verse_reference, verse_translation, verse_text,
        recap, heads_up, starters, status, scheduled_publish_at, published_at
    ) values (
        'Pressure', 2, 4,
        'When You Can''t Hold It Together',
        'You were never the one holding it together.',
        '1 Peter 5:7', 'WEB',
        'Casting all your worries on him, because he cares for you.',
        'We looked at 1 Peter 5 and talked about the pressure to keep it together — at school, at home, online — and what it means to hand that weight to God instead of managing it alone.',
        'We named anxiety directly tonight. Some students may bring it up this week. If yours does, you don''t need a perfect answer — just don''t change the subject.',
        array[
            'What''s something everyone assumes you''re fine about?',
            'When you''re stressed, do you get loud or go quiet?',
            'What''s one thing I could take off your plate this week?'
        ],
        'live',
        '2026-08-14 07:00:00-07',
        '2026-08-14 07:00:00-07'
    )
    returning id
)
insert into days (week_id, day_number, title, passage_reference, passage_text, thought, question)
select id, 1, 'The Handoff', '1 Peter 5:6–7',
    'Humble yourselves therefore under the mighty hand of God, that he may exalt you in due time; casting all your worries on him, because he cares for you.',
    '"Casting" isn''t a gentle word — in the original language it pictures a violent throw, not a careful handoff. Peter pairs it with "humble yourselves," because pride and anxiety come from the same root: both convince you that you''re the one who has to hold everything up.',
    'Where do you carry it alone?'
from new_week
union all
select id, 2, 'Weak Is Not Broken', '2 Corinthians 12:9',
    'My grace is sufficient for you, for my power is made perfect in weakness.',
    'Paul asked God three times to take something hard away. God said no — and then told him why. The weak spot wasn''t the problem. It was the place where God showed up most obviously.',
    'Where are you pretending to be fine?'
from new_week
union all
select id, 3, 'The Trade', 'Matthew 11:28',
    'Come to me, all you who labor and are heavily burdened, and I will give you rest.',
    'Jesus doesn''t offer less weight overall — he offers a trade. Put down the thing you were never built to carry, and pick up what he actually asks of you instead, which he calls light by comparison.',
    'What would rest look like?'
from new_week;
