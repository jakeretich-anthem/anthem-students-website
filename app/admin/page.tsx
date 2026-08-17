import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";

// "This Week" — the admin landing page drops a signed-in leader straight
// into the most recently created week's editor, since that's what a
// leader signing in on a Thursday morning actually wants. With no weeks
// yet, there's nothing to edit, so send them to the list instead.
export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this — redirect here too so this page
  // never runs a query on behalf of a signed-out visitor.
  if (!user) {
    redirect("/admin/login");
  }

  const { data: week } = await supabase
    .from("weeks")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  redirect(week ? `/admin/week/${week.id}` : "/admin/weeks");
}
