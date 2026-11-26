import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ensurePersonalVault } from "@/lib/vault";

export default async function MyVault() {
  const vault = await ensurePersonalVault(await requireUser());
  redirect(`/orgs/${vault.id}`);
}
