import { requireAdmin } from "@/lib/auth";
import { OrgForm } from "@/components/OrgForm";
import { PageHead } from "@/components/server";

export const metadata = { title: "New organization" };

export default async function NewOrgPage() {
  await requireAdmin();
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <PageHead title="New organization" crumbs={[["Organizations", "/orgs"]]} />
      <OrgForm cancelHref="/orgs" />
    </div>
  );
}
