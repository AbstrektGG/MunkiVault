"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { recheckCertAction } from "@/app/actions";
import { Message } from "./ui";

export function RecheckCert({ orgId, id }: { orgId: string; id: string }) {
  const [state, action, pending] = useActionState(recheckCertAction.bind(null, orgId, id), null);
  return (
    <form action={action} className="row">
      <button type="submit" className="btn" disabled={pending}><RefreshCw size={14} />{pending ? "Checking..." : "Check host now"}</button>
      <Message state={state} />
    </form>
  );
}
