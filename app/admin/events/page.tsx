import AdminChrome from "../components/AdminChrome";
import EventsAdmin from "./EventsAdmin";
import { createClient } from "../../../utils/supabase/server";
import type { DbEvent } from "../../lib/data";

export default async function AdminEventsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("event_date", { ascending: true });

  return (
    <AdminChrome active="events">
      <EventsAdmin events={(data ?? []) as DbEvent[]} />
    </AdminChrome>
  );
}
