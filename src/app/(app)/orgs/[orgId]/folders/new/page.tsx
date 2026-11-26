import { requireOrg } from "@/lib/access";
import { folderOptions, listFolders } from "@/lib/folders";
import { FolderForm } from "@/components/FolderForm";

export default async function NewFolder({ params, searchParams }: { params: Promise<{ orgId: string }>; searchParams: Promise<{ parent?: string }> }) {
  const { orgId } = await params;
  await requireOrg(orgId, "editor");
  const all = await listFolders(orgId);
  const parent = (await searchParams).parent;
  const parentId = all.some((f) => f.id === parent) ? parent! : null;
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h2>New folder</h2>
      <FolderForm orgId={orgId} parentId={parentId} parents={folderOptions(all)}
        cancelHref={parentId ? `/orgs/${orgId}/folders/${parentId}` : `/orgs/${orgId}`} />
    </div>
  );
}
