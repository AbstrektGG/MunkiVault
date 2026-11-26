import Link from "next/link";
import { ChevronDown, FolderPlus, Plus } from "lucide-react";
import { ENTITIES, KINDS, type Kind } from "@/lib/entities";
import { childFolders, entriesIn } from "@/lib/folders";
import { fmtDate } from "@/lib/format";
import { EntryIcon, FolderIcon, entryIconKey } from "./icons";
import { Empty, ExpiryBadge } from "./server";

// The "New" menu for a folder or the organization root. A <details> element, so it works without JavaScript.
export function NewMenu({ orgId, folderId }: { orgId: string; folderId: string | null }) {
  const q = folderId ? `?folder=${folderId}` : "";
  return (
    <details className="menu">
      <summary className="btn btn-primary btn-sm"><Plus size={14} />New<ChevronDown size={13} /></summary>
      <div className="menu-panel">
        <Link href={`/orgs/${orgId}/folders/new${folderId ? `?parent=${folderId}` : ""}`}><FolderPlus size={15} />Folder</Link>
        {KINDS.map((k) => (
          <Link key={k} href={`/orgs/${orgId}/${k}/new${q}`}>
            <EntryIcon icon={entryIconKey(k, { type: "server" })} size={15} />{ENTITIES[k].singular}
          </Link>
        ))}
      </div>
    </details>
  );
}

function detail(kind: Kind, row: Record<string, unknown>) {
  if (kind === "assets") return <span className="mono">{String(row.hostname || row.ipAddress || "")}</span>;
  if (kind === "credentials") return <span className="mono">{String(row.username ?? "")}</span>;
  if (kind === "certificates") return <span className="mono">{String(row.host ?? "")}</span>;
  return null;
}

function expiry(kind: Kind, row: Record<string, unknown>) {
  const date = (kind === "certificates" ? row.notAfter : kind === "credentials" ? row.expiresAt : kind === "assets" ? row.warrantyExpires : null) as string | null;
  return date ? <span className="row nowrap">{fmtDate(date)} <ExpiryBadge date={date} /></span> : null;
}

export async function FolderContents({ orgId, folderId, canEdit }: { orgId: string; folderId: string | null; canEdit: boolean }) {
  const [subfolders, entries] = await Promise.all([childFolders(orgId, folderId), entriesIn(orgId, folderId)]);
  const rows = KINDS.flatMap((k) => entries[k].map((row) => ({ kind: k, row: row as unknown as Record<string, unknown> & { id: string; name: string; updatedAt: Date } })))
    .sort((a, b) => a.row.name.localeCompare(b.row.name, undefined, { sensitivity: "base" }));
  return (
    <section className="card">
      <div className="card-head">
        <h2>{folderId ? "Contents" : "Folders and entries"}</h2>
        {canEdit ? <NewMenu orgId={orgId} folderId={folderId} /> : null}
      </div>
      {subfolders.length || rows.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Type</th><th>Detail</th><th>Expires</th><th>Updated</th></tr></thead>
          <tbody>
            {subfolders.map((f) => (
              <tr key={f.id}>
                <td className="primary"><Link href={`/orgs/${orgId}/folders/${f.id}`} className="with-icon"><FolderIcon icon={f.icon} />{f.name}</Link></td>
                <td className="muted">Folder</td><td /><td /><td className="muted small nowrap">{fmtDate(f.updatedAt)}</td>
              </tr>
            ))}
            {rows.map(({ kind, row }) => (
              <tr key={`${kind}-${row.id}`}>
                <td className="primary"><Link href={`/orgs/${orgId}/${kind}/${row.id}`} className="with-icon"><EntryIcon icon={entryIconKey(kind, row)} />{row.name}</Link></td>
                <td className="muted">{ENTITIES[kind].singular}</td>
                <td>{detail(kind, row)}</td>
                <td>{expiry(kind, row)}</td>
                <td className="muted small nowrap">{fmtDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <Empty title={folderId ? "This folder is empty" : "Nothing here yet"}>
          {canEdit ? <p>Use New to add a folder, system, credential, certificate or document.</p> : null}
        </Empty>
      )}
    </section>
  );
}
