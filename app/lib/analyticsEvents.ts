// Shared by the client tracker and the server route, so neither has to
// import the other's Supabase client to know the event vocabulary.
// Mirrors the analytics_event_type enum in the initial migration.
export const ANALYTICS_EVENT_TYPES = [
  "week_view",
  "day_view",
  "day_complete",
  "verse_practice",
  "parent_guide_view",
  "events_view",
  "archive_view",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];
