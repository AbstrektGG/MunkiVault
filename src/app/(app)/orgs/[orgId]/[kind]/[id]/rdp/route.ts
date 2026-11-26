import { NextResponse } from "next/server";
import { audit, requireOrg } from "@/lib/access";
import { getEntry } from "@/lib/store";

// Builds a .rdp file for the system so the local Remote Desktop client opens it directly.
export async function GET(_req: Request, { params }: { params: Promise<{ orgId: string; kind: string; id: string }> }) {
  const { orgId, kind, id } = await params;
  if (kind !== "assets") return new NextResponse("Not found", { status: 404 });
  const { user } = await requireOrg(orgId);
  const asset = await getEntry("assets", orgId, id);
  const host = String(asset?.hostname || asset?.ipAddress || "");
  if (!asset || asset.protocol !== "rdp" || !host) return new NextResponse("Not found", { status: 404 });
  const clean = (v: string) => v.replace(/[\r\n]/g, "");
  const body = [
    `full address:s:${clean(host)}:${Number(asset.port) || 3389}`,
    "prompt for credentials:i:1",
    "authentication level:i:2",
    "redirectclipboard:i:1",
    "",
  ].join("\r\n");
  await audit(user, "assets.rdp_downloaded", { orgId, entityType: "assets", entityId: id, detail: asset.name });
  const filename = asset.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 60) || "connection";
  return new NextResponse(body, {
    headers: { "Content-Type": "application/x-rdp", "Content-Disposition": `attachment; filename="${filename}.rdp"` },
  });
}
