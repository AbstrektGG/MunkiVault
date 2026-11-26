import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/access";
import { ENTITIES, isKind } from "@/lib/entities";
import { getEntry, listEntries } from "@/lib/store";
import { folderOptions, listFolders } from "@/lib/folders";
import { EntryForm } from "@/components/EntryForm";

export default async function EditEntry({ params }: { params: Promise<{ orgId: string; kind: string; id: string }> }) {
  const { orgId, kind, id } = await params;
  if (!isKind(kind)) notFound();
  await requireOrg(orgId, "editor");
  const entry = await getEntry(kind, orgId, id);
  if (!entry) notFound();
  const def = ENTITIES[kind];
  const assets = kind === "assets" ? [] : (await listEntries("assets", orgId)).map((a) => ({ id: a.id, name: a.name }));
  // Ciphertext stays on the server; the form only learns which secrets exist.
  const values: Record<string, string | number | null> = {};
  const stored: string[] = [];
  for (const f of def.fields) {
    if (f.kind === "secret") { if (entry[f.name]) stored.push(f.name); }
    else values[f.name] = (entry[f.name] as string | number | null) ?? null;
  }
  return (
    <div className="stack">
      <h2>Edit {entry.name}</h2>
      <EntryForm kind={kind} orgId={orgId} id={id} version={entry.version} values={values} stored={stored} assets={assets}
        folders={folderOptions(await listFolders(orgId))} folderId={(entry.folderId as string | null) ?? null} cancelHref={`/orgs/${orgId}/${kind}/${id}`} />
    </div>
  );
}
