"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown, ChevronRight, ChevronsDownUp, Copy, Eye, ExternalLink, FolderPlus, Globe, KeyRound, MonitorUp, Pencil,
  Plus, RefreshCw, Search, Timer, User,
} from "lucide-react";
import { entryInfoAction, loadTreeAction, type EntryInfo } from "@/app/actions";
import type { OrgTree } from "@/lib/folders";
import { ENTITIES, KINDS, lowerLabel } from "@/lib/entities";
import { copyPlain, copySecret, viewSecret, type Target } from "./commands";
import { EntryIcon, FolderIcon, OrgIcon } from "./icons";

type Vault = { id: string; name: string; kind: string; level: "viewer" | "editor" | "manager" };
type TreeNode =
  | { type: "root" }
  | { type: "folder"; id: string; name: string }
  | { type: "entry"; kind: string; id: string; name: string };
type Menu = { x: number; y: number; node: TreeNode; info?: EntryInfo | { error: string } | "loading" };

const OPEN_KEY = "mv_tree_open";
const ORG_KEY = "mv_tree_org";
const WIDTH_KEY = "mv_tree_width";
const ROUTE = /^\/orgs\/([0-9a-f-]{36})(?:\/(folders|assets|credentials|certificates|documents|otp)\/([0-9a-f-]{36}))?/;
const byName = <T extends { name: string }>(a: T, b: T) => a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true });

function store<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v === null ? fallback : (JSON.parse(v) as T); } catch { return fallback; }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export function TreePanel({ vaults, personalId }: { vaults: Vault[]; personalId: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const match = pathname.match(ROUTE);
  const routeOrg = match && vaults.some((v) => v.id === match[1]) ? match[1] : null;

  const [chosen, setChosen] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [tree, setTree] = useState<{ orgId: string; data: OrgTree } | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [width, setWidth] = useState(300);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(new Set(store<string[]>(OPEN_KEY, [])));
    setChosen(store<string | null>(ORG_KEY, null));
    setWidth(store(WIDTH_KEY, 300));
  }, []);

  // The tree shows one vault: the one in the address bar, else the last one picked, else your personal vault.
  const orgId = routeOrg ?? (chosen && vaults.some((v) => v.id === chosen) ? chosen : personalId);
  const vault = vaults.find((v) => v.id === orgId)!;
  const canEdit = vault.level !== "viewer";

  useEffect(() => { if (routeOrg) { setChosen(routeOrg); save(ORG_KEY, routeOrg); } }, [routeOrg]);

  const load = useCallback(async (id: string) => {
    const data = await loadTreeAction(id);
    if (data) { setTree({ orgId: id, data }); setFailed(false); } else setFailed(true);
  }, []);
  // Reload on every navigation so new, renamed and moved items show up.
  useEffect(() => { void load(orgId); }, [orgId, pathname, load]);

  const persistOpen = (next: Set<string>) => { setOpen(next); save(OPEN_KEY, [...next]); };
  const toggle = (id: string, force?: boolean) => {
    const next = new Set(open);
    if (force ?? !next.has(id)) next.add(id); else next.delete(id);
    persistOpen(next);
  };

  const data = tree?.orgId === orgId ? tree.data : null;
  const index = useMemo(() => {
    const folders = new Map<string | null, OrgTree["folders"]>();
    const entries = new Map<string | null, OrgTree["entries"]>();
    const parentOf = new Map<string, string | null>();
    if (!data) return { folders, entries, parentOf };
    const known = new Set(data.folders.map((f) => f.id));
    for (const f of data.folders) {
      const parent = f.parentId && known.has(f.parentId) ? f.parentId : null;
      parentOf.set(f.id, parent);
      folders.set(parent, [...(folders.get(parent) ?? []), f]);
    }
    for (const e of data.entries) {
      const parent = e.folderId && known.has(e.folderId) ? e.folderId : null;
      entries.set(parent, [...(entries.get(parent) ?? []), e]);
    }
    return { folders, entries, parentOf };
  }, [data]);

  // Open the folders leading to the page being viewed.
  useEffect(() => {
    if (!data || !match?.[3] || routeOrg !== orgId) return;
    const start = match[2] === "folders" ? match[3] : data.entries.find((e) => e.id === match[3])?.folderId ?? null;
    const ids: string[] = [];
    for (let cur = start; cur && !ids.includes(cur); cur = index.parentOf.get(cur) ?? null) ids.push(cur);
    const current = new Set(store<string[]>(OPEN_KEY, []));
    if (ids.some((id) => !current.has(id))) persistOpen(new Set([...current, ...ids]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, match?.[2], match?.[3]]);

  // While filtering, show matching items plus the folders that contain them, all expanded.
  const q = filter.trim().toLowerCase();
  const visible = useMemo(() => {
    if (!q || !data) return null;
    const keep = new Set<string>();
    const up = (folderId: string | null) => { for (let cur = folderId; cur && !keep.has(cur); cur = index.parentOf.get(cur) ?? null) keep.add(cur); };
    for (const e of data.entries) if (e.name.toLowerCase().includes(q)) { keep.add(e.id); up(e.folderId); }
    for (const f of data.folders) if (f.name.toLowerCase().includes(q)) { keep.add(f.id); up(index.parentOf.get(f.id) ?? null); }
    return keep;
  }, [q, data, index]);

  // ----- Context menu -----
  const openMenu = async (x: number, y: number, node: TreeNode) => {
    const needsInfo = node.type === "entry" && (node.kind === "assets" || node.kind === "credentials" || node.kind === "otp");
    setMenu({ x, y, node, info: needsInfo ? "loading" : undefined });
    if (needsInfo) {
      const info = await entryInfoAction(orgId, node.kind, node.id);
      setMenu((m) => (m && m.node === node ? { ...m, info } : m));
    }
  };
  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => { if (!(e.target instanceof Node && menuRef.current?.contains(e.target))) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const closeNow = () => setMenu(null);
    document.addEventListener("mousedown", close, true);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", closeNow);
    window.addEventListener("blur", closeNow);
    return () => {
      document.removeEventListener("mousedown", close, true);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", closeNow);
      window.removeEventListener("blur", closeNow);
    };
  }, [menu]);
  useEffect(() => { setMenu(null); }, [pathname]);
  // Keep the menu inside the window.
  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || !menu) return;
    const r = el.getBoundingClientRect();
    const x = Math.min(menu.x, window.innerWidth - r.width - 8);
    const y = Math.min(menu.y, window.innerHeight - r.height - 8);
    el.style.left = `${Math.max(8, x)}px`;
    el.style.top = `${Math.max(8, y)}px`;
  });
  useEffect(() => { if (menu) menuRef.current?.querySelector<HTMLElement>("[role=menuitem]:not([disabled])")?.focus(); }, [menu?.node]); // eslint-disable-line react-hooks/exhaustive-deps

  const onMenuKey = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([disabled])") ?? [])];
    const i = items.indexOf(document.activeElement as HTMLElement);
    items[(i + (e.key === "ArrowDown" ? 1 : items.length - 1)) % items.length]?.focus();
  };

  function MenuItem({ icon, label, onClick, href, disabled, title }: { icon: ReactNode; label: string; onClick?: () => void; href?: string; disabled?: boolean; title?: string }) {
    const run = () => { setMenu(null); if (href) router.push(href); else onClick?.(); };
    return <button type="button" role="menuitem" disabled={disabled} title={title} onClick={run}>{icon}<span>{label}</span></button>;
  }

  function menuContent(m: Menu): ReactNode {
    const base = `/orgs/${orgId}`;
    const newItems = (folderId: string | null) => (
      <>
        <MenuItem icon={<FolderPlus size={15} />} label="New folder" disabled={!canEdit} href={`${base}/folders/new${folderId ? `?parent=${folderId}` : ""}`} />
        {KINDS.map((k) => (
          <MenuItem key={k} icon={<EntryIcon icon={k === "assets" ? "server" : k === "credentials" ? "credential" : k === "certificates" ? "certificate" : k === "otp" ? "otp" : "document"} size={15} />}
            label={`New ${lowerLabel(ENTITIES[k].singular)}`} disabled={!canEdit} href={`${base}/${k}/new${folderId ? `?folder=${folderId}` : ""}`} />
        ))}
      </>
    );
    if (m.node.type === "root") return <>{newItems(null)}<hr /><MenuItem icon={<ExternalLink size={15} />} label="Open overview" href={base} /></>;
    if (m.node.type === "folder") {
      return (
        <>
          <MenuItem icon={<ExternalLink size={15} />} label="Open" href={`${base}/folders/${m.node.id}`} />
          <hr />{newItems(m.node.id)}<hr />
          <MenuItem icon={<Pencil size={15} />} label="Edit properties" disabled={!canEdit} href={`${base}/folders/${m.node.id}/edit`} />
        </>
      );
    }
    const n = m.node;
    const href = `${base}/${n.kind}/${n.id}`;
    const target: Target = { orgId, kind: n.kind, id: n.id, name: n.name };
    const info = m.info && m.info !== "loading" && !("error" in m.info) ? m.info : null;
    const pending = m.info === "loading";
    const secretOff = !info?.canReveal ? "Editor access is required to reveal secrets" : undefined;
    const hasCreds = n.kind === "assets" || n.kind === "credentials";
    const isOtp = n.kind === "otp";
    return (
      <>
        <MenuItem icon={<ExternalLink size={15} />} label="Open" href={href} />
        {info?.connect ? (
          <MenuItem icon={<MonitorUp size={15} />} label={`Connect (${info.connect.protocol.toUpperCase()})`}
            onClick={() => { if (info.connect!.protocol === "rdp") window.location.href = info.connect!.href; else window.open(info.connect!.href, "_blank", "noopener"); }} />
        ) : null}
        {hasCreds ? (
          <>
            <hr />
            {pending ? <div className="menu-note">Loading credential...</div>
              : info && !info.credentialName && info.source !== "direct" ? <div className="menu-note">{info.problem}</div>
              : info && info.source !== "direct" ? <div className="menu-note">Using {info.credentialName}{info.source === "user" ? " (personal vault)" : ""}</div> : null}
            <MenuItem icon={<User size={15} />} label="Copy username" disabled={!info?.username} onClick={() => copyPlain(info!.username!, "Username")} />
            <MenuItem icon={<Copy size={15} />} label="Copy password" disabled={!info?.hasPassword || !info.canReveal} title={secretOff} onClick={() => copySecret(target, "password")} />
            <MenuItem icon={<KeyRound size={15} />} label="Copy OTP" disabled={!info?.hasTotp || !info.canReveal} title={secretOff} onClick={() => copySecret(target, "totp")} />
            <MenuItem icon={<Eye size={15} />} label="View password" disabled={!info?.hasPassword || !info.canReveal} title={secretOff} onClick={() => viewSecret(target, "password")} />
            <MenuItem icon={<Timer size={15} />} label="View OTP" disabled={!info?.hasTotp || !info.canReveal} title={secretOff} onClick={() => viewSecret(target, "totp")} />
          </>
        ) : null}
        {isOtp ? (
          <>
            <hr />
            <MenuItem icon={<KeyRound size={15} />} label="Copy OTP" disabled={!info?.hasTotp || !info.canReveal} title={secretOff} onClick={() => copySecret(target, "totp")} />
            <MenuItem icon={<Timer size={15} />} label="View OTP" disabled={!info?.hasTotp || !info.canReveal} title={secretOff} onClick={() => viewSecret(target, "totp")} />
            <MenuItem icon={<User size={15} />} label="Copy account" disabled={!info?.username} onClick={() => copyPlain(info!.username!, "Account")} />
          </>
        ) : null}
        {info?.hostname ? <MenuItem icon={<Globe size={15} />} label="Copy host" onClick={() => copyPlain(info.hostname!, "Host")} /> : null}
        <hr />
        <MenuItem icon={<Pencil size={15} />} label="Edit properties" disabled={!canEdit} href={`${href}/edit`} />
      </>
    );
  }

  // ----- Rendering -----
  const isActive = (href: string, deep = false) => pathname === href || (deep && pathname.startsWith(`${href}/`));

  function Row({ depth, id, href, label, icon, expandable, active, node }: {
    depth: number; id?: string; href: string; label: string; icon: ReactNode; expandable: boolean; active: boolean; node: TreeNode;
  }) {
    const isOpen = Boolean(visible) || (id ? open.has(id) : false);
    const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
      if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
        e.preventDefault();
        const r = e.currentTarget.getBoundingClientRect();
        void openMenu(r.left + 24, r.bottom, node);
      }
    };
    return (
      <div className={`tree-row${active ? " active" : ""}${menu?.node === node ? " menu-open" : ""}`} style={{ paddingLeft: 4 + depth * 16 }}
        onContextMenu={(e) => { e.preventDefault(); void openMenu(e.clientX, e.clientY, node); }}>
        {expandable && id ? (
          <button type="button" className={`tree-toggle${isOpen ? " open" : ""}`} aria-expanded={isOpen} tabIndex={-1}
            aria-label={`${isOpen ? "Collapse" : "Expand"} ${label}`} onClick={() => toggle(id)}>
            <ChevronRight size={14} />
          </button>
        ) : <span className="tree-toggle" aria-hidden />}
        <Link href={href} className="tree-link" title={label} aria-current={active ? "page" : undefined} onKeyDown={onKey}
          onClick={() => { if (id && expandable) toggle(id, true); }}>
          {icon}<span>{label}</span>
        </Link>
      </div>
    );
  }

  const base = `/orgs/${orgId}`;
  const level = (parent: string | null, depth: number): ReactNode => {
    const subs = [...(index.folders.get(parent) ?? [])].filter((f) => !visible || visible.has(f.id)).sort(byName);
    const items = [...(index.entries.get(parent) ?? [])].filter((e) => !visible || visible.has(e.id)).sort(byName);
    if (!subs.length && !items.length) return null;
    return (
      <ul className="tree" role="group">
        {subs.map((f) => {
          const href = `${base}/folders/${f.id}`;
          const hasKids = (index.folders.get(f.id)?.length ?? 0) + (index.entries.get(f.id)?.length ?? 0) > 0;
          const node: TreeNode = { type: "folder", id: f.id, name: f.name };
          const shown = visible ? true : open.has(f.id);
          return (
            <li key={f.id} role="treeitem" aria-expanded={hasKids ? shown : undefined}>
              <Row depth={depth} id={f.id} href={href} label={f.name} icon={<FolderIcon icon={f.icon} />} expandable={hasKids} node={node}
                active={isActive(href) || isActive(`${href}/edit`)} />
              {hasKids && shown ? level(f.id, depth + 1) : null}
            </li>
          );
        })}
        {items.map((e) => {
          const href = `${base}/${e.kind}/${e.id}`;
          return (
            <li key={`${e.kind}-${e.id}`} role="treeitem">
              <Row depth={depth} href={href} label={e.name} icon={<EntryIcon icon={e.icon} />} expandable={false} active={isActive(href, true)}
                node={{ type: "entry", kind: e.kind, id: e.id, name: e.name }} />
            </li>
          );
        })}
      </ul>
    );
  };

  const groups: [string, Vault[]][] = [
    ["Internal", vaults.filter((v) => v.kind === "internal").sort(byName)],
    ["Customers", vaults.filter((v) => v.kind === "customer").sort(byName)],
  ];
  const routeFolder = match?.[2] === "folders" && routeOrg === orgId ? match[3] : null;

  // Drag the right edge to resize.
  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    const startX = e.clientX, startW = width;
    const move = (ev: PointerEvent) => setWidth(Math.min(560, Math.max(220, startW + ev.clientX - startX)));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up);
      save(WIDTH_KEY, Math.min(560, Math.max(220, startW + ev.clientX - startX)));
    };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up);
  };

  return (
    <aside className="tree-pane" style={{ width }} aria-label="Vault tree">
      <div className="tree-pane-head">
        <label htmlFor="vault-picker" className="sr-only">Vault</label>
        <div className="vault-picker">
          <OrgIcon kind={vault.kind} />
          <select id="vault-picker" value={orgId} onChange={(e) => { setChosen(e.target.value); save(ORG_KEY, e.target.value); setFilter(""); router.push(`/orgs/${e.target.value}`); }}>
            <option value={personalId}>My vault (private)</option>
            {groups.map(([label, list]) => list.length ? (
              <optgroup key={label} label={label}>{list.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}</optgroup>
            ) : null)}
          </select>
          <ChevronDown size={14} className="vault-picker-caret" aria-hidden />
        </div>
        <div className="tree-toolbar">
          <div className="tree-search">
            <Search size={14} aria-hidden />
            <input type="search" placeholder="Filter" aria-label="Filter this vault" value={filter} onChange={(e) => setFilter(e.target.value)} />
          </div>
          {canEdit ? (
            <button type="button" className="btn btn-ghost btn-icon" title="New" aria-label="New"
              onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); void openMenu(r.left, r.bottom + 4, routeFolder ? { type: "folder", id: routeFolder, name: "" } : { type: "root" }); }}>
              <Plus size={16} />
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost btn-icon" title="Collapse all" aria-label="Collapse all" onClick={() => persistOpen(new Set())}><ChevronsDownUp size={15} /></button>
          <button type="button" className="btn btn-ghost btn-icon" title="Refresh" aria-label="Refresh" onClick={() => load(orgId)}><RefreshCw size={14} /></button>
        </div>
      </div>
      <div className="tree-scroll" role="tree" aria-label={vault.name}
        onContextMenu={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); void openMenu(e.clientX, e.clientY, { type: "root" }); } }}>
        <Row depth={0} href={base} label={vault.kind === "personal" ? "My vault" : vault.name} icon={<OrgIcon kind={vault.kind} />} expandable={false}
          active={isActive(base)} node={{ type: "root" }} />
        {data ? (level(null, 1) ?? <div className="tree-empty" style={{ paddingLeft: 40 }}>{q ? "No matches" : "Empty. Right-click to add a folder or item."}</div>)
          : <div className="tree-empty" style={{ paddingLeft: 40 }}>{failed ? "Could not load" : "Loading..."}</div>}
      </div>
      <div className="tree-resize" onPointerDown={startResize} aria-hidden />
      {menu ? (
        <div ref={menuRef} className="context-menu" role="menu" style={{ left: menu.x, top: menu.y }} onKeyDown={onMenuKey}
          onContextMenu={(e) => e.preventDefault()}>
          {menuContent(menu)}
        </div>
      ) : null}
    </aside>
  );
}
