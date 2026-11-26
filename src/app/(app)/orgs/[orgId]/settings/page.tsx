import { deleteOrgAction } from "@/app/actions";
import { requireOrg } from "@/lib/access";
import { OrgForm } from "@/components/OrgForm";
import { ActionForm, Submit } from "@/components/ui";

export default async function OrgSettings({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org, user } = await requireOrg(orgId, "manager");
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <OrgForm org={org} cancelHref={`/orgs/${orgId}`} />
      {user.role === "admin" ? (
        <section className="card card-body">
          <h2>Delete organization</h2>
          <p className="muted" style={{ margin: "6px 0 12px" }}>Permanently removes every system, credential, certificate, document and version in {org.name}.</p>
          <ActionForm action={deleteOrgAction.bind(null, orgId)}>
            <label htmlFor="confirm">Type the organization name to confirm</label>
            <div className="input-row"><input id="confirm" name="confirm" type="text" autoComplete="off" /><Submit className="btn btn-danger">Delete</Submit></div>
          </ActionForm>
        </section>
      ) : null}
    </div>
  );
}
