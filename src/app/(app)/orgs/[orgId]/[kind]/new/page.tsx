import { notFound } from "next/navigation";
import { requireOrg } from "@/lib/access";
import { ENTITIES, isKind } from "@/lib/entities";
import { listEntries } from "@/lib/store";
import { EntryForm } from "@/components/EntryForm";

export default async function NewEntry({ params, searchParams }: { params: Promise<{ orgId: string; kind: string }>; searchParams: Promise<{ asset?: string }> }) {
  const { orgId, kind } = await params;
  if (!isKind(kind)) notFound();
  await requireOrg(orgId, "editor");
  const assets = kind === "assets" ? [] : (await listEntries("assets", orgId)).map((a) => ({ id: a.id, name: a.name }));
  const preset = (await searchParams).asset;
  return (
    <div className="stack">
      <h2>New {ENTITIES[kind].singular.toLowerCase()}</h2>
      <EntryForm kind={kind} orgId={orgId} id={null} version={0} stored={[]} assets={assets}
        values={{ assetId: assets.some((a) => a.id === preset) ? preset! : null }} cancelHref={`/orgs/${orgId}/${kind}`} />
    </div>
  );
}
