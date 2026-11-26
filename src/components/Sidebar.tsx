"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarClock, ChevronRight, KeyRound, LayoutDashboard, LogOut, PanelLeftClose, PanelLeftOpen, Plus, ScrollText,
  Settings, UserCog, Users, Vault,
} from "lucide-react";
import { loadTreeAction, logoutAction } from "@/app/actions";
import type { OrgTree } from "@/lib/folders";
import { EntryIcon, FolderIcon, OrgIcon } from "./icons";

type OrgItem = { id: string; name: string; kind: string };
type Props = { orgs: OrgItem[]; user: { name: string; email: string; isAdmin: boolean }; initialCollapsed: boolean };

const OPEN_KEY = "mv_tree_open";
const ROUTE = /^\/orgs\/([0-9a-f-]{36})(?:\/(folders|assets|credentials|certificates|documents)\/([0-9a-f-]{36}))?/;
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

function readOpen(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}

function NavItem({ href, icon, label, exact, collapsed }: { href: string; icon: ReactNode; label: string; exact?: boolean; collapsed: boolean }) {
  const path = usePathname();
  const active = exact ? path === href : path === href || path.startsWith(`${href}/`);
  return (
    <Link href={href} aria-current={active ? "page" : undefined} title={collapsed ? label : undefined}>
      {icon}<span className="nav-label">{label}</span>
    </Link>
  );
}

export function Sidebar({ orgs, user, initialCollapsed }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [trees, setTrees] = useState<Record<string, OrgTree | "loading" | "error">>({});
  const [filter, setFilter] = useState("");

  useEffect(() => { setOpen(readOpen()); }, []);

  const persist = (next: Set<string>) => {
    setOpen(next);
    try { localStorage.setItem(OPEN_KEY, JSON.stringify([...next])); } catch { /* storage unavailable */ }
  };
  const toggle = (id: string, force?: boolean) => {
    const next = new Set(open);
    if (force ?? !next.has(id)) next.add(id); else next.delete(id);
    persist(next);
  };

  const load = useCallback(async (orgId: string) => {
    setTrees((t) => (t[orgId] && t[orgId] !== "error" ? t : { ...t, [orgId]: "loading" }));
    const tree = await loadTreeAction(orgId);
    setTrees((t) => ({ ...t, [orgId]: tree ?? "error" }));
  }, []);

  // Organizations left open from a previous visit load once.
  useEffect(() => {
    for (const org of orgs) if (open.has(org.id) && !trees[org.id]) void load(org.id);
  }, [open, orgs, trees, load]);

  // Navigating inside an organization reloads its tree (so new and renamed items appear) and opens
  // the folders leading to the current page.
  const match = pathname.match(ROUTE);
  const routeOrg = match?.[1];
  useEffect(() => {
    if (routeOrg && orgs.some((o) => o.id === routeOrg)) void load(routeOrg);
  }, [pathname, routeOrg, orgs, load]);

  useEffect(() => {
    if (!routeOrg) return;
    const tree = trees[routeOrg];
    const ids = [routeOrg];
    if (tree && typeof tree === "object" && match?.[3]) {
      const parentOf = new Map(tree.folders.map((f) => [f.id, f.parentId]));
      let cur: string | null | undefined = match[2] === "folders" ? match[3] : tree.entries.find((e) => e.id === match[3])?.folderId;
      while (cur && !ids.includes(cur)) { ids.push(cur); cur = parentOf.get(cur); }
    }
    const current = readOpen();
    if (ids.some((id) => !current.has(id))) persist(new Set([...current, ...ids]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeOrg, match?.[2], match?.[3], trees]);

  function setCollapsedPersist(value: boolean) {
    setCollapsed(value);
    document.cookie = `mv_sidebar=${value ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return orgs.filter((o) => !q || o.name.toLowerCase().includes(q));
  }, [orgs, filter]);

  const isActive = (href: string, deep = false) => pathname === href || (deep && pathname.startsWith(`${href}/`));

  function Row({ depth, id, href, label, icon, expandable, active }: {
    depth: number; id?: string; href: string; label: string; icon: ReactNode; expandable: boolean; active: boolean;
  }) {
    const isOpen = id ? open.has(id) : false;
    return (
      <div className={`tree-row${active ? " active" : ""}`} style={{ paddingLeft: 4 + depth * 14 }}>
        {expandable && id ? (
          <button type="button" className={`tree-toggle${isOpen ? " open" : ""}`} aria-expanded={isOpen}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`} onClick={() => toggle(id)}>
            <ChevronRight size={14} />
          </button>
        ) : <span className="tree-toggle" aria-hidden />}
        <Link href={href} className="tree-link" title={label} aria-current={active ? "page" : undefined}
          onClick={() => { if (id && expandable) toggle(id, true); }}>
          {icon}<span>{label}</span>
        </Link>
      </div>
    );
  }

  function OrgChildren({ org, tree }: { org: OrgItem; tree: OrgTree }) {
    const folders = new Map<string | null, OrgTree["folders"]>();
    for (const f of tree.folders) folders.set(f.parentId, [...(folders.get(f.parentId) ?? []), f]);
    const entries = new Map<string | null, OrgTree["entries"]>();
    for (const e of tree.entries) entries.set(e.folderId, [...(entries.get(e.folderId) ?? []), e]);
    // A folder whose parent no longer exists is shown at the top level rather than lost.
    const known = new Set(tree.folders.map((f) => f.id));
    const roots = tree.folders.filter((f) => !f.parentId || !known.has(f.parentId));

    const level = (parent: string | null, depth: number, list?: OrgTree["folders"]): ReactNode => {
      const subs = [...(list ?? folders.get(parent) ?? [])].sort(byName);
      const items = [...(entries.get(parent) ?? [])].sort(byName);
      return (
        <ul className="tree">
          {subs.map((f) => {
            const href = `/orgs/${org.id}/folders/${f.id}`;
            const hasKids = (folders.get(f.id)?.length ?? 0) + (entries.get(f.id)?.length ?? 0) > 0;
            return (
              <li key={f.id}>
                <Row depth={depth} id={f.id} href={href} label={f.name} icon={<FolderIcon icon={f.icon} />} expandable={hasKids} active={isActive(href) || isActive(`${href}/edit`)} />
                {hasKids && open.has(f.id) ? level(f.id, depth + 1) : null}
              </li>
            );
          })}
          {items.map((e) => {
            const href = `/orgs/${org.id}/${e.kind}/${e.id}`;
            return <li key={`${e.kind}-${e.id}`}><Row depth={depth} href={href} label={e.name} icon={<EntryIcon icon={e.icon} />} expandable={false} active={isActive(href, true)} /></li>;
          })}
          {depth === 1 && !subs.length && !items.length ? <li className="tree-empty" style={{ paddingLeft: 4 + depth * 14 + 20 }}>Empty</li> : null}
        </ul>
      );
    };
    return <>{level(null, 1, roots)}</>;
  }

  const groups = [["internal", "Internal"], ["customer", "Customers"]] as const;

  return (
    <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
      <div className="sidebar-top">
        <Link href="/" className="brand" title="MunkiVault"><span className="brand-mark"><Vault size={16} /></span><span className="nav-label">MunkiVault</span></Link>
        <button type="button" className="btn btn-ghost btn-icon collapse-btn" onClick={() => setCollapsedPersist(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <nav className="nav" aria-label="Main">
        <NavItem href="/" exact icon={<LayoutDashboard size={16} />} label="Dashboard" collapsed={collapsed} />
        <NavItem href="/expirations" icon={<CalendarClock size={16} />} label="Expirations" collapsed={collapsed} />
        <NavItem href="/generator" icon={<KeyRound size={16} />} label="Password generator" collapsed={collapsed} />
        {user.isAdmin ? (
          <>
            <NavItem href="/admin/users" icon={<Users size={16} />} label="Users" collapsed={collapsed} />
            <NavItem href="/admin/audit" icon={<ScrollText size={16} />} label="Audit log" collapsed={collapsed} />
            <NavItem href="/admin/settings" icon={<Settings size={16} />} label="Settings" collapsed={collapsed} />
          </>
        ) : null}
      </nav>

      {!collapsed ? (
        <div className="tree-panel">
          <div className="tree-head">
            <Link href="/orgs" className="nav-title">Organizations</Link>
            {user.isAdmin ? <Link href="/orgs/new" className="btn btn-ghost btn-icon" title="New organization" aria-label="New organization"><Plus size={15} /></Link> : null}
          </div>
          {orgs.length > 6 ? (
            <input type="search" className="tree-filter" placeholder="Filter organizations" aria-label="Filter organizations"
              value={filter} onChange={(e) => setFilter(e.target.value)} />
          ) : null}
          <div className="tree-scroll" role="tree" aria-label="Organizations">
            {groups.map(([kind, title]) => {
              const list = visible.filter((o) => o.kind === kind).sort(byName);
              if (!list.length) return null;
              return (
                <div key={kind} className="tree-group">
                  <div className="tree-group-title">{title}</div>
                  <ul className="tree">
                    {list.map((org) => {
                      const tree = trees[org.id];
                      return (
                        <li key={org.id}>
                          <Row depth={0} id={org.id} href={`/orgs/${org.id}`} label={org.name} icon={<OrgIcon kind={org.kind} />} expandable active={isActive(`/orgs/${org.id}`)} />
                          {open.has(org.id) ? (
                            tree && typeof tree === "object" ? <OrgChildren org={org} tree={tree} />
                              : <div className="tree-empty" style={{ paddingLeft: 38 }}>{tree === "error" ? "Could not load" : "Loading..."}</div>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
            {!visible.length ? <div className="tree-empty" style={{ padding: "4px 8px" }}>{orgs.length ? "No matches" : "No organizations yet"}</div> : null}
          </div>
        </div>
      ) : <div className="tree-panel" />}

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
