-- SPEC.md's /parents route requires a "heads up" callout and three
-- conversation starters, but the weeks DDL never grew columns for them.
-- Add them so the parent guide can be real data instead of a gap.
alter table weeks add column heads_up text;
alter table weeks add column starters text[] not null default '{}';
