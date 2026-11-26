"use client";

import { Copy, Eye, KeyRound, MonitorUp, Timer, User } from "lucide-react";
import type { EntryInfo } from "@/app/actions";
import { copyPlain, copySecret, viewSecret, type Target } from "./commands";

// Quick actions in an item's header; the same commands as the tree's right-click menu.
export function EntryActions({ target, info }: { target: Target; info: EntryInfo }) {
  const noReveal = info.canReveal ? undefined : "Editor access is required to reveal secrets";
  return (
    <div className="quick-actions">
      {info.connect ? (
        <a className="btn btn-primary btn-sm" href={info.connect.href} {...(info.connect.protocol === "rdp" ? {} : { target: "_blank", rel: "noreferrer noopener" })}>
          <MonitorUp size={14} />Connect ({info.connect.protocol.toUpperCase()})
        </a>
      ) : null}
      {info.credentialName || info.source === "direct" ? (
        <>
          <button type="button" className="btn btn-sm" disabled={!info.username} onClick={() => copyPlain(info.username!, "Username")}><User size={14} />Copy username</button>
          <button type="button" className="btn btn-sm" disabled={!info.hasPassword || !info.canReveal} title={noReveal} onClick={() => copySecret(target, "password")}><Copy size={14} />Copy password</button>
          <button type="button" className="btn btn-sm" disabled={!info.hasPassword || !info.canReveal} title={noReveal} onClick={() => viewSecret(target, "password")}><Eye size={14} />View password</button>
          {info.hasTotp ? (
            <>
              <button type="button" className="btn btn-sm" disabled={!info.canReveal} title={noReveal} onClick={() => copySecret(target, "totp")}><KeyRound size={14} />Copy OTP</button>
              <button type="button" className="btn btn-sm" disabled={!info.canReveal} title={noReveal} onClick={() => viewSecret(target, "totp")}><Timer size={14} />View OTP</button>
            </>
          ) : null}
        </>
      ) : null}
      {info.source !== "direct" && info.source !== "none" ? (
        <span className="muted small">
          {info.credentialName ? <>Credential: <strong>{info.credentialName}</strong>{info.source === "user" ? " (your personal vault)" : ""}</> : info.problem}
        </span>
      ) : null}
    </div>
  );
}
