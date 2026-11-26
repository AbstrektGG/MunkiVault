import Link from "next/link";
import type { Folder } from "@/lib/folders";

// "Organization root / Site / Folder" trail, each part a link.
export function FolderCrumbs({ orgId, path, tail }: { orgId: string; path: Folder[]; tail?: { label: string; href: string } }) {
  return (
    <div className="crumbs">
      <Link href={`/orgs/${orgId}`}>Top level</Link>
      {path.map((f) => <span key={f.id}> / <Link href={`/orgs/${orgId}/folders/${f.id}`}>{f.name}</Link></span>)}
      {tail ? <span> / <Link href={tail.href}>{tail.label}</Link></span> : null}
    </div>
  );
}
