"use client";

import Link from "next/link";
import { saveFolderAction } from "@/app/actions";
import { FOLDER_ICONS } from "@/lib/entities";
import { ActionForm, Submit } from "./ui";

type Props = {
  orgId: string;
  folder?: { id: string; name: string; icon: string; parentId: string | null };
  parentId: string | null;
  parents: { id: string; label: string }[];
  cancelHref: string;
};

export function FolderForm({ orgId, folder, parentId, parents, cancelHref }: Props) {
  return (
    <ActionForm action={saveFolderAction.bind(null, orgId, folder?.id ?? null)} className="card card-body">
      <div className="form-grid">
        <div className="wide"><label htmlFor="name">Name *</label><input id="name" name="name" type="text" required maxLength={120} defaultValue={folder?.name} autoFocus /></div>
        <div>
          <label htmlFor="icon">Icon</label>
          <select id="icon" name="icon" defaultValue={folder?.icon ?? "folder"}>
            {FOLDER_ICONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="parentId">Inside</label>
          <select id="parentId" name="parentId" defaultValue={parentId ?? ""}>
            <option value="">Top level of the organization</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </div>
      </div>
      <div className="form-foot"><Submit>{folder ? "Save folder" : "Create folder"}</Submit><Link href={cancelHref} className="btn btn-ghost">Cancel</Link></div>
    </ActionForm>
  );
}
