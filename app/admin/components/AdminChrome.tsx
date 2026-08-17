import Link from "next/link";
import SignOutButton from "../SignOutButton";

export default function AdminChrome({
  active,
  children,
}: {
  active: "this-week" | "all-weeks" | null;
  children: React.ReactNode;
}) {
  return (
    <div className="admin-shell">
      <div className="admin-dash">
        <div className="admin-side">
          <div className="admin-side-brand">Anthem Admin</div>
          <Link href="/admin" className={`admin-nav-item${active === "this-week" ? " on" : ""}`}>
            This Week
          </Link>
          <Link href="/admin/weeks" className={`admin-nav-item${active === "all-weeks" ? " on" : ""}`}>
            All Weeks
          </Link>
          <div className="admin-side-foot">
            <SignOutButton />
          </div>
        </div>
        <div className="admin-main">{children}</div>
      </div>
    </div>
  );
}
