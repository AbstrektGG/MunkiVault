// navigator.clipboard only exists on https or localhost. Opening MunkiVault by IP over plain http
// (common on a LAN or WSL) needs the older execCommand fallback.
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* fall through */ }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try { ok = document.execCommand("copy"); } catch { ok = false; }
  el.remove();
  return ok;
}
