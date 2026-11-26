import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink, History, Link2, Pencil, Plus, Trash2 } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { deleteEntryAction, entryInfoAction } from "@/app/actions";
import { can, requireOrg } from "@/lib/access";
import { ENTITIES, isKind, optionLabel, type FieldDef } from "@/lib/entities";
import { fmtDateTime } from "@/lib/format";
import { getEntry, linkedEntries } from "@/lib/store";
import { devicesUsing, linkedCredentials } from "@/lib/credentials";
import { EntryActions } from "@/components/EntryActions";
import { Markdown } from "@/components/Markdown";
import { SecretReveal } from "@/components/SecretReveal";
import { RecheckCert } from "@/components/RecheckCert";
import { ConfirmButton, CopyButton } from "@/components/ui";
import { FolderCrumbs } from "@/components/FolderCrumbs";
import { EntryIcon, entryIconKey } from "@/components/icons";
import { listFolders, pathTo } from "@/lib/folders";
import { ExpiryBadge, fmtDate } from "@/components/server";

const EXPIRY_FIELDS = ["notAfter", "expiresAt", "warrantyExpires"];
const isHttpUrl = (v: string) => /^https?:\/\/\S+$/i.test(v);

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
  const folderPath = pathTo(await listFolders(orgId), (entry.folderId as string | null) ?? null);
  const linkedAsset = entry.assetId ? await getEntry("assets", orgId, String(entry.assetId)) : null;
  const [creds, certs] = kind === "assets"
    ? await Promise.all([linkedCredentials(id), linkedEntries("certificates", orgId, id)])
    : [[], []];
  const usedBy = kind === "credentials" ? await devicesUsing(id) : [];
  const info = kind === "assets" || kind === "credentials" ? await entryInfoAction(orgId, kind, id) : null;
  const source = String(entry.credentialSource ?? "none");

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

  const body = def.fields.slice(1).filter((f) => !(kind === "documents" && f.name === "content") && f.name !== "credentialSource" && f.name !== "userVaultKey")
    .map((f) => ({ f, node: value(f) })).filter((x) => x.node !== null);

  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <FolderCrumbs orgId={orgId} path={folderPath} />
          <h2 style={{ fontSize: 19 }} className="with-icon"><EntryIcon icon={entryIconKey(kind, entry)} size={19} />{entry.name}</h2>
        </div>
        <div className="actions">
          {canEdit ? <Link href={`${base}/edit`} className="btn"><Pencil size={14} />Edit</Link> : null}
          <Link href={`${base}/history`} className="btn"><History size={14} />History</Link>
          {can(level, "manager") ? (
            <ConfirmButton action={deleteEntryAction.bind(null, kind, orgId, id)} question={`Delete "${entry.name}"? This cannot be undone from the app.`}>
              <Trash2 size={14} />Delete
            </ConfirmButton>
          ) : null}
        </div>
      </div>

      {info && !("error" in info) ? <EntryActions target={{ orgId, kind, id, name: entry.name }} info={info} /> : null}

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

      {kind === "assets" ? (
        <section className="card">
          <div className="card-head">
            <h2>Credentials</h2>
            {canEdit ? (
              <div className="row">
                <Link className="btn btn-sm" href={`${base}/edit#credentials`}><Link2 size={14} />Link or change</Link>
                {source !== "user" ? <Link className="btn btn-sm" href={`/orgs/${orgId}/credentials/new?linkTo=${id}`}><Plus size={14} />New credential</Link> : null}
              </div>
            ) : null}
          </div>
          {source === "user" ? (
            <div className="card-body">
              <p>Each person uses their own credential named <strong>{String(entry.userVaultKey)}</strong> from their personal vault. Every use is logged under their name.</p>
              <p className="muted small" style={{ marginTop: 6 }}>
                {info && !("error" in info) && info.credentialName ? "You have a matching credential in your vault." : <>You do not have one yet. <Link href={`/vault/new-credential?name=${encodeURIComponent(String(entry.userVaultKey))}`}>Add it to your vault</Link>.</>}
              </p>
            </div>
          ) : source === "linked" && creds.length ? (
            <table><tbody>
              {creds.map((c, i) => (
                <tr key={c.id}>
                  <td className="primary"><Link href={`/orgs/${orgId}/credentials/${c.id}`} className="with-icon"><EntryIcon icon="credential" />{c.name}</Link></td>
                  <td>{i === 0 ? <span className="badge badge-accent">Default</span> : null}</td>
                  <td className="mono">{c.username ?? ""}</td>
                  <td>{c.password ? <SecretReveal orgId={orgId} id={c.id} field="password" canReveal={canEdit} /> : null}</td>
                </tr>
              ))}
            </tbody></table>
          ) : <div className="card-body muted">No credential is set for this device.{canEdit ? " Use Link or change to pick one." : ""}</div>}
        </section>
      ) : null}

      {kind === "assets" ? (
        <section className="card">
          <div className="card-head">
            <h2>Certificates</h2>
            {canEdit ? <Link className="btn btn-sm" href={`/orgs/${orgId}/certificates/new?asset=${id}${entry.folderId ? `&folder=${entry.folderId}` : ""}`}><Plus size={14} />Add</Link> : null}
          </div>
          {certs.length ? (
            <table><tbody>
              {certs.map((r) => (
                <tr key={r.id}>
                  <td className="primary"><Link href={`/orgs/${orgId}/certificates/${r.id}`}>{r.name}</Link></td>
                  <td className="mono">{String(r.host ?? "")}</td>
                  <td><ExpiryBadge date={r.notAfter as string | null} /></td>
                </tr>
              ))}
            </tbody></table>
          ) : <div className="card-body muted">No certificates linked to this system.</div>}
        </section>
      ) : null}

      {kind === "credentials" ? (
        <section className="card">
          <div className="card-head"><h2>Used by</h2><span className="muted small">Link credentials from a device&apos;s properties</span></div>
          {usedBy.length ? (
            <table><tbody>
              {usedBy.map((d) => (
                <tr key={d.id}>
                  <td className="primary"><Link href={`/orgs/${orgId}/assets/${d.id}`} className="with-icon"><EntryIcon icon={d.type} />{d.name}</Link></td>
                  <td className="mono">{d.hostname ?? ""}</td>
                </tr>
              ))}
            </tbody></table>
          ) : <div className="card-body muted">No devices use this credential.</div>}
        </section>
      ) : null}

      <p className="muted small">Version {entry.version}. Last updated {fmtDateTime(entry.updatedAt)}{editor ? ` by ${editor.name}` : ""}.</p>
    </div>
  );
}
