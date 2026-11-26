"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  Building2, CalendarClock, KeyRound, LayoutDashboard, LockKeyhole, LogOut, PanelLeftClose, PanelLeftOpen, ScrollText,
  Settings, Timer, UserCog, Users, Vault,
} from "lucide-react";
import { logoutAction } from "@/app/actions";

function Item({ href, icon, label, exact, collapsed }: { href: string; icon: ReactNode; label: string; exact?: boolean; collapsed: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
      {icon}<span className="nav-label">{label}</span>
    </Link>
  );
}

// The application menu. Separate from the vault tree, and collapsible to an icon rail.
export function AppNav({ user, vaultId, initialCollapsed }: { user: { name: string; email: string; isAdmin: boolean }; vaultId: string; initialCollapsed: boolean }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    setCollapsed(!collapsed);
    document.cookie = `mv_sidebar=${!collapsed ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };
  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`} aria-label="Application menu">
      <div className="sidebar-top">
        <Link href="/" className="brand" title="MunkiVault"><span className="brand-mark"><Vault size={16} /></span><span className="nav-label">MunkiVault</span></Link>
        <button type="button" className="btn btn-ghost btn-icon collapse-btn" onClick={toggle}
          aria-label={collapsed ? "Expand menu" : "Collapse menu"} title={collapsed ? "Expand menu" : "Collapse menu"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>
      <nav className="nav" aria-label="Main">
        <Item href="/" exact icon={<LayoutDashboard size={16} />} label="Dashboard" collapsed={collapsed} />
        <Item href={`/orgs/${vaultId}`} icon={<LockKeyhole size={16} />} label="My vault" collapsed={collapsed} />
        <Item href="/orgs" exact icon={<Building2 size={16} />} label="Organizations" collapsed={collapsed} />
        <Item href="/authenticator" icon={<Timer size={16} />} label="Authenticator" collapsed={collapsed} />
        <Item href="/expirations" icon={<CalendarClock size={16} />} label="Expirations" collapsed={collapsed} />
        <Item href="/generator" icon={<KeyRound size={16} />} label="Password generator" collapsed={collapsed} />
      </nav>
      {user.isAdmin ? (
        <nav className="nav" aria-label="Administration">
          <div className="nav-title nav-label">Administration</div>
          <Item href="/admin/users" icon={<Users size={16} />} label="Users" collapsed={collapsed} />
          <Item href="/admin/audit" icon={<ScrollText size={16} />} label="Audit log" collapsed={collapsed} />
          <Item href="/admin/settings" icon={<Settings size={16} />} label="Settings" collapsed={collapsed} />
        </nav>
      ) : null}
      <div className="user-menu">
        <button type="button" className="user-chip" aria-haspopup="menu" title={collapsed ? `${user.name} (${user.email})` : undefined}>
          <span className="avatar" aria-hidden>{user.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</span>
          <span className="user-text nav-label"><span className="user-name">{user.name}</span><span className="muted small">{user.email}</span></span>
        </button>
        <div className="user-menu-panel" role="menu">
          <Link href="/account" role="menuitem"><UserCog size={15} />Account</Link>
          <form action={logoutAction}><button type="submit" role="menuitem"><LogOut size={15} />Sign out</button></form>
        </div>
      </div>
    </aside>
  );
}
