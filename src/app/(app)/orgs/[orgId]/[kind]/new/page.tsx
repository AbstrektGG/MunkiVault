import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/access";
import { ENTITIES, isKind } from "@/lib/entities";
import { listEntries } from "@/lib/store";
import { folderOptions, listFolders } from "@/lib/folders";
import { EntryForm } from "@/components/EntryForm";

export default async function NewEntry({ params, searchParams }: { params: Promise<{ orgId: string; kind: string }>; searchParams: Promise<{ asset?: string; folder?: string }> }) {
  const { orgId, kind } = await params;
  if (!isKind(kind)) notFound();
  await requireOrg(orgId, "editor");
  const assets = kind === "assets" ? [] : (await listEntries("assets", orgId)).map((a) => ({ id: a.id, name: a.name }));
  const { asset: preset, folder } = await searchParams;
  const allFolders = await listFolders(orgId);
  const folderId = allFolders.some((f) => f.id === folder) ? folder! : null;
  return (
    <div className="stack">
      <h2>New {ENTITIES[kind].singular.toLowerCase()}</h2>
      <EntryForm kind={kind} orgId={orgId} id={null} version={0} stored={[]} assets={assets}
        values={{ assetId: assets.some((a) => a.id === preset) ? preset! : null }}
        folders={folderOptions(allFolders)} folderId={folderId}
        cancelHref={folderId ? `/orgs/${orgId}/folders/${folderId}` : `/orgs/${orgId}`} />
    </div>
  );
}
