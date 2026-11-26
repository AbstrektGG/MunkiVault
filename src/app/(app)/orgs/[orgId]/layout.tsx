import type { ReactNode } from "react";
import { can, requireOrg } from "@/lib/access";
import { countEntries } from "@/lib/store";
import { ENTITIES, KINDS } from "@/lib/entities";
import { NavLink } from "@/components/ui";
import { PageHead } from "@/components/server";

export default async function OrgLayout({ children, params }: { children: ReactNode; params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const { org, level } = await requireOrg(orgId);
  const counts = await countEntries(orgId);
  const base = `/orgs/${orgId}`;
  return (
    <>
      <PageHead
        crumbs={org.ownerId ? [] : [["Organizations", "/orgs"]]}
        title={org.ownerId
          ? <>My vault <span className="badge badge-accent" style={{ verticalAlign: "middle" }}>Private</span></>
          : <>{org.name} <span className={`badge ${org.kind === "internal" ? "badge-accent" : ""}`} style={{ verticalAlign: "middle" }}>{org.kind === "internal" ? "Internal" : "Customer"}</span></>}
      />
      <nav className="tabs" aria-label="Organization">
        <NavLink href={base} exact>Overview</NavLink>
        {KINDS.map((k) => <NavLink key={k} href={`${base}/${k}`}>{ENTITIES[k].plural}<span className="count">{counts[k]}</span></NavLink>)}
        <NavLink href={`${base}/activity`}>Activity</NavLink>
        {can(level, "manager") && !org.ownerId ? <><NavLink href={`${base}/access`}>Access</NavLink><NavLink href={`${base}/settings`}>Settings</NavLink></> : null}
      </nav>
      {children}
    </>
  );
}
