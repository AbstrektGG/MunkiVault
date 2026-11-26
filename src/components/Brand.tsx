import Link from "next/link";
import { Vault } from "lucide-react";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand">
      <span className="brand-mark"><Vault size={16} /></span>
      MunkiVault
    </Link>
  );
}
