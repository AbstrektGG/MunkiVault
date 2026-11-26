import type { ReactNode } from "react";
import { Building2, CalendarClock, KeyRound, LayoutDashboard, LogOut, ScrollText, Search, Settings, UserCog, Users } from "lucide-react";
import { logoutAction } from "@/app/actions";
import { requireUser } from "@/lib/auth";
import { Brand } from "@/components/Brand";
import { NavLink } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return (
    <div className="shell">
      <aside className="sidebar">
        <Brand />
        <nav className="nav" aria-label="Main">
          <NavLink href="/" exact><LayoutDashboard size={16} /><span>Dashboard</span></NavLink>
          <NavLink href="/orgs"><Building2 size={16} /><span>Organizations</span></NavLink>
          <NavLink href="/expirations"><CalendarClock size={16} /><span>Expirations</span></NavLink>
          <NavLink href="/generator"><KeyRound size={16} /><span>Password generator</span></NavLink>
        </nav>
        {user.role === "admin" ? (
          <nav className="nav" aria-label="Administration">
            <div className="nav-title">Administration</div>
            <NavLink href="/admin/users"><Users size={16} /><span>Users</span></NavLink>
            <NavLink href="/admin/audit"><ScrollText size={16} /><span>Audit log</span></NavLink>
            <NavLink href="/admin/settings"><Settings size={16} /><span>Settings</span></NavLink>
          </nav>
        ) : null}
        <div className="sidebar-foot">
          <div className="user-chip">
            <div style={{ fontWeight: 600 }}>{user.name}</div>
            <div className="muted small">{user.email}</div>
          </div>
          <nav className="nav">
            <NavLink href="/account"><UserCog size={16} /><span>Account</span></NavLink>
          </nav>
          <form action={logoutAction}>
            <button type="submit" className="btn btn-ghost btn-block" style={{ justifyContent: "flex-start" }}><LogOut size={16} />Sign out</button>
          </form>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <form action="/search" className="search" role="search">
            <Search size={15} />
            <input type="search" name="q" placeholder="Search systems, credentials, certificates, documents" aria-label="Search" />
          </form>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
