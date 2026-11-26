"use client";

import { Fragment, startTransition, useActionState, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, Download, KeyRound, Wand2, X } from "lucide-react";
import { fetchCertAction, saveEntryAction } from "@/app/actions";
import { CREDENTIAL_SOURCES, ENTITIES, type FieldDef, type Kind } from "@/lib/entities";
import { MarkdownEditor } from "./MarkdownEditor";
import { PasswordGenerator } from "./PasswordGenerator";
import { Message } from "./ui";

type Props = {
  kind: Kind; orgId: string; id: string | null; version: number;
  // Current values. Secrets are never included; `stored` lists the secret fields that have a value.
  values: Record<string, string | number | null>;
  stored: string[];
  assets: { id: string; name: string }[];
  folders: { id: string; label: string }[];
  folderId: string | null;
  cancelHref: string;
  // Devices only: credentials in this vault that can be linked, and the ones linked now (default first).
  credentialOptions?: { id: string; label: string }[];
  linkedIds?: string[];
  // Credentials only: a device to link the new credential to once it is created.
  linkTo?: string | null;
};

function CredentialSource({ initialSource, vaultKey, options, initialLinked }: {
  initialSource: string; vaultKey: string; options: { id: string; label: string }[]; initialLinked: string[];
}) {
  const [source, setSource] = useState(initialSource || "none");
  const [linked, setLinked] = useState(initialLinked.filter((id) => options.some((o) => o.id === id)));
  const label = (id: string) => options.find((o) => o.id === id)?.label ?? "Unknown";
  const move = (i: number) => setLinked((l) => { const n = [...l]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; });
  return (
    <fieldset className="cred-source" id="credentials">
      <legend>Credentials</legend>
      <div className="radio-row">
        {CREDENTIAL_SOURCES.map(([v, l]) => (
          <label key={v} className="check"><input type="radio" name="credentialSource" value={v} checked={source === v} onChange={() => setSource(v)} />{l}</label>
        ))}
      </div>
      {source === "linked" ? (
        <div className="stack" style={{ gap: 8, marginTop: 10 }}>
          {linked.length ? (
            <ul className="link-list">
              {linked.map((id, i) => (
                <li key={id}>
                  <input type="hidden" name="credentialIds" value={id} />
                  <KeyRound size={14} className="ico ico-key" aria-hidden />
                  <span className="grow">{label(id)}</span>
                  {i === 0 ? <span className="badge badge-accent">Default</span>
                    : <button type="button" className="btn btn-ghost btn-sm" onClick={() => move(i)} title="Move up"><ArrowUp size={13} />Make earlier</button>}
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLinked(linked.filter((x) => x !== id))} aria-label={`Unlink ${label(id)}`}><X size={13} />Unlink</button>
                </li>
              ))}
            </ul>
          ) : <p className="help">No credentials linked yet.</p>}
          <select aria-label="Link a credential" value="" onChange={(e) => { if (e.target.value) setLinked([...linked, e.target.value]); }}>
            <option value="">{options.length ? "Link a credential from this vault..." : "This vault has no credentials yet"}</option>
            {options.filter((o) => !linked.includes(o.id)).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
          <p className="help">The first credential is used for Connect and the copy actions. The same credential can be linked to any number of devices.</p>
        </div>
      ) : null}
      {source === "user" ? (
        <div style={{ marginTop: 10 }}>
          <label htmlFor="userVaultKey">Credential name in each user&apos;s personal vault *</label>
          <input id="userVaultKey" name="userVaultKey" type="text" defaultValue={vaultKey} required placeholder="Contoso domain" />
          <p className="help">Each person uses the credential with this exact name from their own vault, so every use is logged under their name.</p>
        </div>
      ) : null}
    </fieldset>
  );
}

export function EntryForm({ kind, orgId, id, version, values, stored, assets, folders, folderId, cancelHref, credentialOptions = [], linkedIds = [], linkTo }: Props) {
  const def = ENTITIES[kind];
  const [state, action, pending] = useActionState(saveEntryAction.bind(null, kind, orgId, id), null);
  const formRef = useRef<HTMLFormElement>(null);
  const [generatorFor, setGeneratorFor] = useState<string | null>(null);
  const [fetching, setFetching] = useState<string | null>(null);

  const input = (name: string) => formRef.current?.elements.namedItem(name) as HTMLInputElement | null;

  async function fetchCert() {
    const host = input("host")?.value.trim();
    if (!host) { setFetching("Enter a host first."); return; }
    setFetching("Connecting...");
    const result = await fetchCertAction(orgId, host, Number(input("port")?.value) || 443);
    if (!result.cert) { setFetching(result.error ?? "Could not fetch the certificate."); return; }
    for (const [key, value] of Object.entries(result.cert)) {
      const el = input(key);
      if (el) el.value = value;
    }
    const nameEl = input("name");
    if (nameEl && !nameEl.value) nameEl.value = result.cert.subject || host;
    setFetching(`Filled in from ${host}. Review and save.`);
  }

  function control(f: FieldDef) {
    const value = values[f.name] ?? "";
    const common = { id: f.name, name: f.name, required: f.required && f.kind !== "secret", className: f.mono ? "mono" : undefined, placeholder: f.placeholder };
    switch (f.kind) {
      case "markdown":
        return <MarkdownEditor name={f.name} defaultValue={String(value)} rows={kind === "documents" ? 22 : 8} />;
      case "textarea":
        return <textarea {...common} rows={4} defaultValue={String(value)} />;
      case "select":
        return <select {...common} defaultValue={String(value || f.options?.[0]?.[0])}>{f.options?.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>;
      case "asset":
        return (
          <select {...common} defaultValue={String(value)}>
            <option value="">None</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        );
      case "date":
        return <input {...common} type="date" defaultValue={String(value)} />;
      case "number":
        return <input {...common} type="number" min={0} max={65535} defaultValue={String(value)} />;
      case "secret": {
        const has = stored.includes(f.name);
        return (
          <>
            <div className="input-row">
              <input {...common} type="text" className="mono" autoComplete="off" spellCheck={false} data-1p-ignore
                placeholder={has ? "Stored. Leave empty to keep the current value." : ""} />
              {f.name === "password" ? (
                <button type="button" className="btn" onClick={() => setGeneratorFor(generatorFor === f.name ? null : f.name)}>
                  <Wand2 size={14} />Generate
                </button>
              ) : null}
            </div>
            {has ? <label className="check" style={{ marginTop: 6 }}><input type="checkbox" name={`clear_${f.name}`} />Remove the stored value</label> : null}
            {generatorFor === f.name ? (
              <div className="popover">
                <PasswordGenerator onUse={(pw) => { const el = input(f.name); if (el) el.value = pw; setGeneratorFor(null); }} />
              </div>
            ) : null}
          </>
        );
      }
      default:
        return f.name === "host" && kind === "certificates" ? (
          <div className="input-row">
            <input {...common} type="text" defaultValue={String(value)} />
            <button type="button" className="btn" onClick={fetchCert}><Download size={14} />Fetch certificate</button>
          </div>
        ) : <input {...common} type="text" defaultValue={String(value)} autoComplete="off" />;
    }
  }

  return (
    // Submitted by hand so that React does not reset the fields when the server reports an error.
    <form ref={formRef} className="card card-body" onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      startTransition(() => action(data));
    }}>
      <input type="hidden" name="version" value={version} />
      {linkTo ? <input type="hidden" name="linkTo" value={linkTo} /> : null}
      <div className="form-grid">
        {def.fields.map((f, i) => f.name === "userVaultKey" ? null : f.name === "credentialSource" ? (
          <div key={f.name} className="wide">
            <CredentialSource initialSource={String(values.credentialSource ?? "none")} vaultKey={String(values.userVaultKey ?? "")}
              options={credentialOptions} initialLinked={linkedIds} />
          </div>
        ) : (
          <Fragment key={f.name}>
            <div className={f.wide ? "wide" : undefined}>
              <label htmlFor={f.name}>{f.label}{f.required ? " *" : ""}</label>
              {control(f)}
              {f.name === "host" && fetching ? <div className="help" role="status">{fetching}</div> : f.help ? <div className="help">{f.help}</div> : null}
            </div>
            {i === 0 ? (
              <div>
                <label htmlFor="folderId">Folder</label>
                <select id="folderId" name="folderId" defaultValue={folderId ?? ""}>
                  <option value="">Top level of the organization</option>
                  {folders.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            ) : null}
          </Fragment>
        ))}
      </div>
      {state ? <div style={{ marginTop: 16 }}><Message state={state} /></div> : null}
      <div className="form-foot">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving..." : id ? "Save changes" : `Create ${def.singular.toLowerCase()}`}
        </button>
        <Link href={cancelHref} className="btn btn-ghost">Cancel</Link>
      </div>
    </form>
  );
}
