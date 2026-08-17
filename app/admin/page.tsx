import { redirect } from "next/navigation";
import { createClient } from "../../utils/supabase/server";
import SignOutButton from "./SignOutButton";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already enforces this — redirect here too so the page never
  // renders leader-only content if it's ever reached another way.
  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="admin-shell">
      <div className="admin-bar">
        <div className="admin-title" style={{ fontSize: 16, marginBottom: 0 }}>
          Anthem Admin
        </div>
        <SignOutButton />
      </div>
      <div className="admin-center" style={{ minHeight: "60dvh" }}>
        <div className="admin-box" style={{ textAlign: "center" }}>
          <div className="admin-subtitle" style={{ marginBottom: 10 }}>
            Signed in as
          </div>
          <div className="admin-email">{user.email}</div>
        </div>
      </div>
    </div>
  );
}
