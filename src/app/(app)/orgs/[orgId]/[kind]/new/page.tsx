import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/access";
import { ENTITIES, isKind, lowerLabel } from "@/lib/entities";
import { listEntries } from "@/lib/store";
import { folderOptions, listFolders } from "@/lib/folders";
import { EntryForm } from "@/components/EntryForm";

export default async function NewEntry({ params, searchParams }: { params: Promise<{ orgId: string; kind: string }>; searchParams: Promise<{ asset?: string; folder?: string; linkTo?: string; name?: string }> }) {
  const { orgId, kind } = await params;
  if (!isKind(kind)) notFound();
  await requireOrg(orgId, "editor");
  const { asset: preset, folder, linkTo, name } = await searchParams;
  const assetRows = await listEntries("assets", orgId);
  const assets = kind === "assets" ? [] : assetRows.map((a) => ({ id: a.id, name: a.name }));
  const linkDevice = kind === "credentials" ? assetRows.find((a) => a.id === linkTo) : undefined;
  const credentialOptions = kind === "assets" ? (await listEntries("credentials", orgId)).map((c) => ({ id: c.id, label: c.username ? `${c.name} (${c.username})` : c.name })) : [];
  const allFolders = await listFolders(orgId);
  const folderId = allFolders.some((f) => f.id === folder) ? folder! : null;
  return (
    <div className="stack">
      <h2>New {lowerLabel(ENTITIES[kind].singular)}</h2>
      {linkDevice ? <p className="muted">It will be linked to {linkDevice.name} when you save.</p> : null}
      <EntryForm kind={kind} orgId={orgId} id={null} version={0} stored={[]} assets={assets}
        values={{ assetId: assets.some((a) => a.id === preset) ? preset! : null, name: name ? String(name).slice(0, 200) : null }}
        folders={folderOptions(allFolders)} folderId={folderId ?? ((linkDevice?.folderId as string | null) ?? null)}
        credentialOptions={credentialOptions} linkTo={linkDevice?.id ?? null}
        cancelHref={folderId ? `/orgs/${orgId}/folders/${folderId}` : `/orgs/${orgId}`} />
    </div>
  );
}
