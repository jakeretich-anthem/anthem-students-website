# Anthem Students Hub — SPEC

Source: `mockups.html` (jakeretich-anthem/anthem-students-website), "Screen designs · v1 scope · for review," Aug 2026.

## 1. What the product is

Anthem Students Hub is a lightweight, account-free web product that gives a church student ministry's teenagers a structured three-day devotional path between Wednesday-night gatherings, delivered through a single link sent every Thursday rather than an app to install. It also produces a matching parent guide — what was covered, a heads-up on any sensitive topics, and conversation starters — plus a leader-facing admin tool built around the constraint that publishing a week must fit in a coffee break (~15 minutes). No student ever creates an account, journal responses stay on the student's own device, and no personal data about minors is collected anywhere in the system.

## 2. Route list

### Student routes (no login · anthemstudents.com)

| Route | What it does |
|---|---|
| `/` | Home ("This Week") — big idea, memory verse card, 3-day path with completion dots, collapsed recap, quiet link to the parent guide. |
| `/day/1`, `/day/2`, `/day/3` | Daily screen — one passage, one honest reflection paragraph, one question, on-device journal entry, "I'm done" to mark complete. |
| `/verse` | Verse Trainer — memory verse with progressive fill-in-the-blank levels and a day streak. |
| `/events` | Events — upcoming dates with time/location/cost/deadline detail; sign-ups link out to external registration. |
| `/archive` | Past Weeks — every previously published week, grouped by series, browsable forever. |
| *(menu overlay)* | Not a distinct route — a full-screen overlay reachable from every screen, listing This Week / Memory Verse / Events / Past Weeks / For Parents, plus a "reduce screen effects" toggle. |

### Parent route (separate link, separate send)

| Route | What it does |
|---|---|
| `/parents` | Parent Guide — what was covered this week, a "heads up" callout on hard topics named that night, three car-ride conversation starters, and the student's memory verse. Warm-gold skin, no retro treatment. |

### Admin routes (password-protected · 1–3 leaders)

| Route | What it does |
|---|---|
| `/admin` | Leader Login — email/password, Editor or Publisher role. |
| `/admin/week/:id` | Week Editor — every field for one week (title, big idea, verse, recap, 3 days), autosaving, draft/live state, scheduled publish, "duplicate last week," "preview as student." |
| `/admin/week/new` | Start From Notes — paste raw Wednesday-night lesson notes, get an ~80%-filled draft week back to review and edit; never auto-publishes. |
| `/admin/week/:id/published` | Publish & Send — copyable group-chat message, copyable parent link, downloadable QR code, and four headline numbers (this week's opens, last week's opens, parent guide opens, reached day 3). |
| `/admin/weeks` | All Weeks — present in the admin sidebar nav on every admin screen; no dedicated mockup screen was designed for it. |
| `/admin/events` | Events — present in the admin sidebar nav; manages the events shown on `/events`; no dedicated mockup screen was designed for it. |
| `/admin/settings` | Settings — present in the admin sidebar nav; site/church-level configuration; no dedicated mockup screen was designed for it. |

## 3. Database schema

PostgreSQL DDL. No table for students or student accounts exists — none is needed, since students never authenticate.

```sql
CREATE TYPE week_status AS ENUM ('draft', 'live');

CREATE TABLE weeks (
    id                    BIGSERIAL PRIMARY KEY,
    series_name           TEXT NOT NULL,
    series_week_number    SMALLINT NOT NULL,
    series_week_total     SMALLINT NOT NULL,
    title                 TEXT NOT NULL,
    big_idea              TEXT NOT NULL,
    verse_reference       TEXT NOT NULL,
    verse_translation     TEXT NOT NULL DEFAULT 'WEB',
    verse_text            TEXT NOT NULL,
    recap                 TEXT NOT NULL,
    status                week_status NOT NULL DEFAULT 'draft',
    scheduled_publish_at  TIMESTAMPTZ,
    published_at          TIMESTAMPTZ,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE days (
    id                 BIGSERIAL PRIMARY KEY,
    week_id            BIGINT NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    day_number         SMALLINT NOT NULL CHECK (day_number BETWEEN 1 AND 3),
    title              TEXT NOT NULL,
    passage_reference  TEXT NOT NULL,
    passage_text       TEXT NOT NULL,
    thought            TEXT NOT NULL,
    question           TEXT NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (week_id, day_number)
);

CREATE TABLE events (
    id           BIGSERIAL PRIMARY KEY,
    title        TEXT NOT NULL,
    event_date   DATE NOT NULL,
    time_label   TEXT,
    location     TEXT,
    detail       TEXT,
    signup_url   TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Singleton row: site/church-level configuration.
CREATE TABLE settings (
    id                    SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    church_name           TEXT NOT NULL,
    site_domain           TEXT NOT NULL,
    support_email         TEXT NOT NULL,
    default_translation   TEXT NOT NULL DEFAULT 'WEB',
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE analytics_event_type AS ENUM (
    'week_view',
    'day_view',
    'day_complete',
    'verse_practice',
    'parent_guide_view',
    'events_view',
    'archive_view'
);

-- Anonymous analytics log. No student identity, name, email, or journal
-- content is ever written here — see Hard Constraints below.
CREATE TABLE analytics_events (
    id           BIGSERIAL PRIMARY KEY,
    event_type   analytics_event_type NOT NULL,
    week_id      BIGINT REFERENCES weeks(id) ON DELETE SET NULL,
    day_number   SMALLINT CHECK (day_number BETWEEN 1 AND 3),
    anon_id      TEXT,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`anon_id` is a random, client-generated token (e.g. stored in `localStorage`), used only to dedupe same-session counts like "reached day 3" — it is never paired with a name, IP address, or any other identifier, and cannot be traced back to a person.

## 4. Design rules

- **The chrome is retro, the content is clean.** Headers, buttons, labels, and navigation carry the VHS treatment — scanlines, chromatic-split glow, skewed display type. Scripture and journal text sit on flat, high-contrast cards layered above the scanlines, so the actual reading/writing surface stays legible on a cracked phone screen. Content never inherits the retro filter; chrome never loses it.
- **Minimum body text size: 14px.** Anything the student reads or writes to think — passage text, the reflection thought, the journal textarea, parent conversation starters and callouts — is never set smaller than 14px. Only decorative chrome labels (mono uppercase tags, timestamps, kickers) drop below that, down to ~9.5px.
- **Scanline opacity ceiling: 5.5%.** The scanline layer (`repeating-linear-gradient`, `mix-blend-mode: overlay`) is capped at `rgba(255,255,255,.055)`. The journal/daily screen dials it down further still, since the mockup explicitly avoids asking a student to type something vulnerable through a heavy CRT filter.
- **The parent page drops the retro treatment entirely.** No neon pink/ice, no VHS scanline chrome, no skewed display type — warm gold (`#c9a961`) on a calmer, flatter layout instead. The rationale in the mockup: a parent needs to trust the page in about four seconds, and a retro filter reads as unserious to that audience.

## 5. Hard constraints

- **No student accounts, ever.** No sign-in, sign-up, or profile of any kind exists on the student or parent side. This is treated as a deliberate reduction in build cost, privacy risk, and ongoing support burden — not a deferred feature.
- **Journal entries are `localStorage`-only and never leave the device.** Nothing typed into a daily journal entry is uploaded, synced, or made readable by leaders or parents. This is stated on-screen to the student as a promise, and it is the reason answers are expected to be honest.
- **No personal data of minors is collected anywhere in the system.** No names, emails, journal content, or other student-identifying data are ever stored server-side. The only server-side record of student activity is the fully anonymous `analytics_events` log.

## 6. Out of scope for v1

- **Native or downloadable app.** Web only, no app-store presence — the product is explicitly "a page to open," not an app to install.
- **Student accounts, login, or profiles** of any kind (see Hard Constraints).
- **Payment processing or event registration.** The Events screen links out to whatever external registrar the ministry already uses; it never takes payment itself.
- **Leader or parent visibility into student journal entries.** Since journal data never reaches the server, there is nothing to expose, review, or moderate.
- **A general-purpose analytics dashboard.** Publish & Send surfaces four fixed numbers (this week's opens, last week's opens, parent guide opens, reached day 3) — no drill-down reporting, cohorts, or exports.
- **Automatic publishing.** The "Start From Notes" parser only ever produces a draft; a human always makes the deliberate decision to publish.
- **A path longer than 3 days.** The weekly structure is a fixed 3-day cycle by design ("three days, not five" is stated as a guardrail against drop-off), not a configurable or longer curriculum.
