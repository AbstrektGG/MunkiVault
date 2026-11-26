import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/access";
import { descendantIds, folderOptions, listFolders } from "@/lib/folders";
import { FolderForm } from "@/components/FolderForm";

export default async function EditFolder({ params }: { params: Promise<{ orgId: string; folderId: string }> }) {
  const { orgId, folderId } = await params;
  await requireOrg(orgId, "editor");
  const all = await listFolders(orgId);
  const folder = all.find((f) => f.id === folderId);
  if (!folder) notFound();
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h2>Edit folder</h2>
      <FolderForm orgId={orgId} folder={folder} parentId={folder.parentId}
        parents={folderOptions(all, descendantIds(all, folderId))} cancelHref={`/orgs/${orgId}/folders/${folderId}`} />
    </div>
  );
}
