import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import { can, requireOrg } from "@/lib/access";
import { ENTITIES, isKind, optionLabel, lowerLabel } from "@/lib/entities";
import { listEntries } from "@/lib/store";
import { listFolders, pathTo } from "@/lib/folders";
import { Empty, ExpiryBadge, fmtDate } from "@/components/server";

const EXPIRY_FIELDS = ["notAfter", "expiresAt", "warrantyExpires"];

export default async function EntryList({ params }: { params: Promise<{ orgId: string; kind: string }> }) {
  const { orgId, kind } = await params;
  if (!isKind(kind)) notFound();
  const { level } = await requireOrg(orgId);
  const def = ENTITIES[kind];
  const [rows, folders] = await Promise.all([listEntries(kind, orgId), listFolders(orgId)]);
  const folderLabel = (id: unknown) => pathTo(folders, (id as string | null) ?? null).map((f) => f.name).join(" / ");
  const cols = def.columns.map((name) => def.fields.find((f) => f.name === name)!);
  return (
    <section className="card">
      <div className="card-head">
        <h2>{def.plural}</h2>
        {can(level, "editor") ? <Link href={`/orgs/${orgId}/${kind}/new`} className="btn btn-primary btn-sm"><Plus size={14} />New {lowerLabel(def.singular)}</Link> : null}
      </div>
      {rows.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>{def.fields[0].label}</th><th>Folder</th>{cols.map((c) => <th key={c.name}>{c.label}</th>)}<th>Updated</th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="primary"><Link href={`/orgs/${orgId}/${kind}/${row.id}`}>{row.name}</Link></td>
                <td className="muted">{row.folderId ? <Link href={`/orgs/${orgId}/folders/${row.folderId}`} className="muted">{folderLabel(row.folderId)}</Link> : "Top level"}</td>
                {cols.map((c) => {
                  const v = row[c.name] as string | null;
                  return (
                    <td key={c.name} className={c.mono ? "mono" : undefined}>
                      {!v ? "" : EXPIRY_FIELDS.includes(c.name) ? <span className="row nowrap">{fmtDate(v)} <ExpiryBadge date={v} /></span>
                        : c.kind === "select" ? optionLabel(c, v) : v}
                    </td>
                  );
                })}
                <td className="muted small nowrap">{fmtDate(row.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : (
        <Empty title={`No ${def.plural.toLowerCase()} yet`}>
          {can(level, "editor") ? <Link href={`/orgs/${orgId}/${kind}/new`}>Add the first one</Link> : null}
        </Empty>
      )}
    </section>
  );
}
