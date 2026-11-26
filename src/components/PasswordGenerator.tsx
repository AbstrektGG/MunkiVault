"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { DEFAULT_OPTIONS, charsets, entropyBits, generatePassword, strengthLabel, type GeneratorOptions } from "@/lib/password";
import { CopyButton } from "./ui";

const TOGGLES: [keyof GeneratorOptions, string][] = [
  ["lower", "Lowercase (a-z)"], ["upper", "Uppercase (A-Z)"], ["digits", "Digits (0-9)"], ["symbols", "Symbols (!@#...)"],
  ["avoidAmbiguous", "Avoid look-alikes (l, 1, O, 0)"],
];

export function PasswordGenerator({ onUse }: { onUse?: (password: string) => void }) {
  const [options, setOptions] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
  const [password, setPassword] = useState("");
  const regenerate = useCallback(() => setPassword(generatePassword(options)), [options]);
  useEffect(regenerate, [regenerate]);

  const bits = entropyBits(options);
  const none = charsets(options).length === 0;

  return (
    <div className="stack" style={{ gap: 12 }}>
      <div className="gen-output" aria-live="polite">{none ? <span className="muted">Select at least one character set.</span> : password}</div>
      <div>
        <div className="meter"><div style={{ width: `${Math.min(100, (bits / 140) * 100)}%` }} /></div>
        <div className="help">{strengthLabel(bits)}, about {bits} bits of entropy</div>
      </div>
      <div>
        <label htmlFor="gen-length">Length: {options.length}</label>
        <input id="gen-length" type="range" min={8} max={64} value={options.length} style={{ width: "100%" }}
          onChange={(e) => setOptions({ ...options, length: Number(e.target.value) })} />
      </div>
      <div className="gen-options">
        {TOGGLES.map(([key, label]) => (
          <label key={key} className="check">
            <input type="checkbox" checked={options[key] as boolean} onChange={(e) => setOptions({ ...options, [key]: e.target.checked })} />
            {label}
          </label>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={regenerate} disabled={none}><RefreshCw size={14} />Regenerate</button>
        {onUse
          ? <button type="button" className="btn btn-primary" disabled={none} onClick={() => onUse(password)}>Use this password</button>
          : <CopyButton value={password} label="Copy password" />}
      </div>
    </div>
  );
}
