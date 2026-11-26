import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ensurePersonalVault } from "@/lib/vault";

// Starts a new credential in the signed-in user's own vault, optionally with its name filled in.
export default async function NewVaultCredential({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const vault = await ensurePersonalVault(await requireUser());
  const name = String((await searchParams).name ?? "").slice(0, 200);
  redirect(`/orgs/${vault.id}/credentials/new${name ? `?name=${encodeURIComponent(name)}` : ""}`);
}
