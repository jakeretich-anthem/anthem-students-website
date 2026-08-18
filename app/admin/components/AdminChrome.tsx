import Link from "next/link";
import SignOutButton from "../SignOutButton";

export default function AdminChrome({
  active,
  children,
}: {
  active: "this-week" | "all-weeks" | "events" | null;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <div className="admin-dash">
        <div className="admin-side">
          <div className="admin-side-brand">Anthem Admin</div>
          {/* Wrapped so the phone layout can scroll the nav sideways on its
              own without carrying the sign-out button off-screen with it. */}
          <nav className="admin-nav">
            <Link href="/admin" className={`admin-nav-item${active === "this-week" ? " on" : ""}`}>
              This Week
            </Link>
            <Link href="/admin/weeks" className={`admin-nav-item${active === "all-weeks" ? " on" : ""}`}>
              All Weeks
            </Link>
            <Link href="/admin/events" className={`admin-nav-item${active === "events" ? " on" : ""}`}>
              Events
            </Link>
          </nav>
          <div className="admin-side-foot">
            <SignOutButton />
          </div>
        </div>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
