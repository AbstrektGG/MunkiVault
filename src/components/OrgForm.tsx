"use client";

import Link from "next/link";
import { saveOrgAction } from "@/app/actions";
import { ActionForm, Submit } from "./ui";

export function OrgForm({ org, cancelHref }: { org?: { id: string; name: string; kind: string; description: string | null }; cancelHref: string }) {
  return (
    <ActionForm action={saveOrgAction.bind(null, org?.id ?? null)} className="card card-body">
      <div className="form-grid">
        <div><label htmlFor="name">Name *</label><input id="name" name="name" type="text" required maxLength={200} defaultValue={org?.name} /></div>
        <div>
          <label htmlFor="kind">Type</label>
          <select id="kind" name="kind" defaultValue={org?.kind ?? "customer"}>
            <option value="customer">Customer</option>
            <option value="internal">Internal infrastructure</option>
          </select>
        </div>
        <div className="wide"><label htmlFor="description">Description</label><input id="description" name="description" type="text" maxLength={300} defaultValue={org?.description ?? ""} /></div>
      </div>
      <div className="form-foot"><Submit>{org ? "Save changes" : "Create organization"}</Submit><Link href={cancelHref} className="btn btn-ghost">Cancel</Link></div>
    </ActionForm>
  );
}
