import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { deleteFolderAction } from "@/app/actions";
import { can, requireOrg } from "@/lib/access";
import { listFolders, pathTo } from "@/lib/folders";
import { FolderContents } from "@/components/FolderContents";
import { FolderCrumbs } from "@/components/FolderCrumbs";
import { FolderIcon } from "@/components/icons";
import { ConfirmButton } from "@/components/ui";

export default async function FolderPage({ params }: { params: Promise<{ orgId: string; folderId: string }> }) {
  const { orgId, folderId } = await params;
  const { level } = await requireOrg(orgId);
  const all = await listFolders(orgId);
  const folder = all.find((f) => f.id === folderId);
  if (!folder) notFound();
  const path = pathTo(all, folder.id);
  return (
    <div className="stack">
      <div className="page-head" style={{ marginBottom: 0 }}>
        <div>
          <FolderCrumbs orgId={orgId} path={path.slice(0, -1)} />
          <h2 style={{ fontSize: 19 }} className="with-icon"><FolderIcon icon={folder.icon} size={19} />{folder.name}</h2>
        </div>
        <div className="actions">
          {can(level, "editor") ? <Link href={`/orgs/${orgId}/folders/${folderId}/edit`} className="btn"><Pencil size={14} />Edit folder</Link> : null}
          {can(level, "manager") ? (
            <ConfirmButton action={deleteFolderAction.bind(null, orgId, folderId)}
              question={`Delete the folder "${folder.name}"? Anything inside it moves up one level; nothing else is deleted.`}>
              <Trash2 size={14} />Delete folder
            </ConfirmButton>
          ) : null}
        </div>
      </div>
      <FolderContents orgId={orgId} folderId={folderId} canEdit={can(level, "editor")} />
    </div>
  );
}
