import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink, History, MonitorUp, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteEntryAction } from "@/app/actions";
import { can, requireOrg } from "@/lib/access";
import { DEFAULT_PORTS, ENTITIES, isKind, optionLabel, type FieldDef } from "@/lib/entities";
import { fmtDateTime } from "@/lib/format";
import { getEntry, linkedEntries, type Entry } from "@/lib/store";
import { Markdown } from "@/components/Markdown";
import { SecretReveal } from "@/components/SecretReveal";
import { RecheckCert } from "@/components/RecheckCert";
import { ConfirmButton, CopyButton } from "@/components/ui";
import { ExpiryBadge, fmtDate } from "@/components/server";

const EXPIRY_FIELDS = ["notAfter", "expiresAt", "warrantyExpires"];
const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

function connectLink(orgId: string, entry: Entry) {
  const protocol = String(entry.protocol ?? "none");
  const host = String(entry.hostname || entry.ipAddress || "");
  if (protocol === "none" || !host) return null;
  const port = Number(entry.port) || DEFAULT_PORTS[protocol];
  const label = `Connect (${protocol.toUpperCase()})`;
  if (protocol === "rdp") return <a className="btn btn-primary" href={`/orgs/${orgId}/assets/${entry.id}/rdp`}><MonitorUp size={14} />{label}</a>;
  const target = `${protocol}://${host}${port === DEFAULT_PORTS[protocol] ? "" : `:${port}`}`;
  return <a className="btn btn-primary" href={target} target="_blank" rel="noreferrer noopener"><MonitorUp size={14} />{label}</a>;
}

export default async function EntryDetail({ params }: { params: Promise<{ orgId: string; kind: string; id: string }> }) {
  const { orgId, kind, id } = await params;
  if (!isKind(kind)) notFound();
  const { level } = await requireOrg(orgId);
  const entry = await getEntry(kind, orgId, id);
  if (!entry) notFound();
  const def = ENTITIES[kind];
  const base = `/orgs/${orgId}/${kind}/${id}`;
  const canEdit = can(level, "editor");

  const [editor] = entry.updatedBy ? await db.select({ name: users.name }).from(users).where(eq(users.id, entry.updatedBy)).limit(1) : [];
  const linkedAsset = entry.assetId ? await getEntry("assets", orgId, String(entry.assetId)) : null;
  const [creds, certs] = kind === "assets"
    ? await Promise.all([linkedEntries("credentials", orgId, id), linkedEntries("certificates", orgId, id)])
    : [[], []];

  function value(f: FieldDef) {
    const v = entry![f.name] as string | number | null;
    if (f.kind === "secret") return v ? <SecretReveal orgId={orgId} id={id} field={f.name as "password" | "totp"} canReveal={canEdit} /> : null;
    if (v === null || v === "") return null;
    if (f.kind === "markdown") return <Markdown source={String(v)} />;
    if (f.kind === "asset") return linkedAsset ? <Link href={`/orgs/${orgId}/assets/${linkedAsset.id}`}>{linkedAsset.name}</Link> : null;
    if (f.kind === "select") return optionLabel(f, v);
    if (f.kind === "date") return <span className="row">{fmtDate(String(v))}{EXPIRY_FIELDS.includes(f.name) ? <ExpiryBadge date={String(v)} /> : null}</span>;
    if (f.name === "url" && isHttpUrl(String(v))) return <a href={String(v)} target="_blank" rel="noreferrer noopener" className="mono">{String(v)} <ExternalLink size={12} /></a>;
    if (f.name === "username") return <span className="row"><span className="mono">{v}</span><CopyButton value={String(v)} /></span>;
    return <span className={f.mono ? "mono" : undefined}>{v}</span>;
  }

  const body = def.fields.slice(1).filter((f) => !(kind === "documents" && f.name === "content"))
    .map((f) => ({ f, node: value(f) })).filter((x) => x.node !== null);

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <div className="crumbs"><Link href={`/orgs/${orgId}/${kind}`}>{def.plural}</Link></div>
          <h2 style={{ fontSize: 19 }}>{entry.name}</h2>
        </div>
        <div className="actions">
          {kind === "assets" ? connectLink(orgId, entry) : null}
          {canEdit ? <Link href={`${base}/edit`} className="btn"><Pencil size={14} />Edit</Link> : null}
          <Link href={`${base}/history`} className="btn"><History size={14} />History</Link>
          {can(level, "manager") ? (
            <ConfirmButton action={deleteEntryAction.bind(null, kind, orgId, id)} question={`Delete "${entry.name}"? This cannot be undone from the app.`}>
              <Trash2 size={14} />Delete
            </ConfirmButton>
          ) : null}
        </div>
      </div>

      {kind === "certificates" && canEdit && entry.host ? <RecheckCert orgId={orgId} id={id} /> : null}

      {body.length ? (
        <section className="card card-body">
          <dl className="fields">
            {body.map(({ f, node }) => (
              <div key={f.name} className={f.wide ? "wide" : undefined}><dt>{f.label}</dt><dd>{node}</dd></div>
            ))}
          </dl>
        </section>
      ) : null}

      {kind === "documents" ? (
        <section className="card card-body">
          {entry.content ? <Markdown source={String(entry.content)} /> : <p className="muted">This document is empty.</p>}
        </section>
      ) : null}

      {kind === "assets" ? (["credentials", "certificates"] as const).map((k) => {
        const rows = k === "credentials" ? creds : certs;
        return (
          <section className="card" key={k}>
            <div className="card-head">
              <h2>{ENTITIES[k].plural}</h2>
              {canEdit ? <Link className="btn btn-sm" href={`/orgs/${orgId}/${k}/new?asset=${id}`}><Plus size={14} />Add</Link> : null}
            </div>
            {rows.length ? (
              <table><tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="primary"><Link href={`/orgs/${orgId}/${k}/${r.id}`}>{r.name}</Link></td>
                    <td className="mono">{String((k === "credentials" ? r.username : r.host) ?? "")}</td>
                    <td>{k === "credentials"
                      ? (r.password ? <SecretReveal orgId={orgId} id={r.id} field="password" canReveal={canEdit} /> : null)
                      : <ExpiryBadge date={r.notAfter as string | null} />}</td>
                  </tr>
                ))}
              </tbody></table>
            ) : <div className="card-body muted">No {ENTITIES[k].plural.toLowerCase()} linked to this system.</div>}
          </section>
        );
      }) : null}

      <p className="muted small">Version {entry.version}. Last updated {fmtDateTime(entry.updatedAt)}{editor ? ` by ${editor.name}` : ""}.</p>
    </div>
  );
}
