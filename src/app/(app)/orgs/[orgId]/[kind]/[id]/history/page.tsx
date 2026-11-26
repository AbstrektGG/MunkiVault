import Link from "next/link";
import { notFound } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { restoreAction } from "@/app/actions";
import { can, requireOrg } from "@/lib/access";
import { diffLines, type DiffLine } from "@/lib/diff";
import { ENTITIES, isKind, optionLabel, type FieldDef } from "@/lib/entities";
import { fmtDateTime } from "@/lib/format";
import { getEntry, listEntries, listRevisions } from "@/lib/store";
import { ConfirmButton } from "@/components/ui";

type Snapshot = Record<string, unknown>;

// Keeps two lines of context around each change and folds the rest.
function fold(lines: DiffLine[]): (DiffLine | { op: "gap"; text: string })[] {
  const keep = lines.map((l, i) => l.op !== "same" || lines.slice(Math.max(0, i - 2), i + 3).some((n) => n.op !== "same"));
  const out: (DiffLine | { op: "gap"; text: string })[] = [];
  let skipped = 0;
  lines.forEach((l, i) => {
    if (keep[i]) { if (skipped) out.push({ op: "gap", text: `${skipped} unchanged line${skipped === 1 ? "" : "s"}` }); skipped = 0; out.push(l); }
    else skipped++;
  });
  if (skipped) out.push({ op: "gap", text: `${skipped} unchanged line${skipped === 1 ? "" : "s"}` });
  return out;
}

export default async function HistoryPage({ params }: { params: Promise<{ orgId: string; kind: string; id: string }> }) {
  const { orgId, kind, id } = await params;
  if (!isKind(kind)) notFound();
  const { level } = await requireOrg(orgId);
  const entry = await getEntry(kind, orgId, id);
  if (!entry) notFound();
  const def = ENTITIES[kind];
  const revs = await listRevisions(kind, orgId, id);
  const assetNames = new Map(kind === "assets" ? [] : (await listEntries("assets", orgId)).map((a) => [a.id, a.name]));

  const show = (f: FieldDef, v: unknown) => {
    if (v === null || v === undefined || v === "") return "empty";
    if (f.kind === "select") return optionLabel(f, v);
    if (f.kind === "asset") return assetNames.get(String(v)) ?? "a deleted system";
    return String(v);
  };

  function changes(after: Snapshot, before: Snapshot | undefined) {
    return def.fields.filter((f) => (after[f.name] ?? null) !== (before?.[f.name] ?? null)).map((f) => {
      const a = after[f.name] ?? null, b = before?.[f.name] ?? null;
      if (f.kind === "secret") {
        return <div className="change" key={f.name}><span className="name">{f.label}</span>: {a === null ? "removed" : b === null ? "set" : "changed"}</div>;
      }
      if (f.kind === "markdown" || f.kind === "textarea") {
        return (
          <div className="change" key={f.name}>
            <span className="name">{f.label}</span>
            <div className="diff">
              {fold(diffLines(String(b ?? ""), String(a ?? ""))).map((l, i) => (
                <div key={i} className={l.op}>{l.op === "add" ? "+ " : l.op === "del" ? "- " : l.op === "gap" ? "" : "  "}{l.text}</div>
              ))}
            </div>
          </div>
        );
      }
      return (
        <div className="change" key={f.name}>
          <span className="name">{f.label}</span>: {before ? <><del>{show(f, b)}</del> to </> : null}<ins>{show(f, a)}</ins>
        </div>
      );
    });
  }

  return (
    <div className="stack">
      <div>
        <div className="crumbs"><Link href={`/orgs/${orgId}/${kind}`}>{def.plural}</Link> / <Link href={`/orgs/${orgId}/${kind}/${id}`}>{entry.name}</Link></div>
        <h2 style={{ fontSize: 19 }}>Version history</h2>
      </div>
      <section className="card">
        {revs.map((rev, i) => {
          const list = changes(rev.snapshot, revs[i + 1]?.snapshot);
          return (
            <div className="rev" key={rev.id}>
              <div className="rev-head">
                <div className="row">
                  <strong>Version {rev.version}</strong>
                  <span className="badge">{rev.action === "create" ? "Created" : rev.action === "restore" ? "Restored" : "Edited"}</span>
                  {rev.version === entry.version ? <span className="badge badge-accent">Current</span> : null}
                  <span className="muted small">{fmtDateTime(rev.createdAt)} by {rev.userName ?? "a removed user"}</span>
                </div>
                {rev.version !== entry.version && can(level, "editor") ? (
                  <ConfirmButton className="btn btn-sm" action={restoreAction.bind(null, kind, orgId, id, rev.version)}
                    question={`Restore version ${rev.version}? The current values are kept in history.`}>
                    <RotateCcw size={13} />Restore this version
                  </ConfirmButton>
                ) : null}
              </div>
              {list.length ? list : <div className="change muted">No field changes.</div>}
            </div>
          );
        })}
      </section>
    </div>
  );
}
