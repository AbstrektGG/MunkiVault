// Password generator. Runs in the browser; uses the Web Crypto API with rejection sampling so every
// character is drawn uniformly.

export type GeneratorOptions = {
  length: number; lower: boolean; upper: boolean; digits: boolean; symbols: boolean; avoidAmbiguous: boolean;
};

export const DEFAULT_OPTIONS: GeneratorOptions = { length: 24, lower: true, upper: true, digits: true, symbols: true, avoidAmbiguous: true };

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{};:,.?/",
};
const AMBIGUOUS = /[Il1O0o|]/g;

export function charsets(o: GeneratorOptions): string[] {
  return (["lower", "upper", "digits", "symbols"] as const)
    .filter((k) => o[k])
    .map((k) => (o.avoidAmbiguous ? SETS[k].replace(AMBIGUOUS, "") : SETS[k]));
}

function randomIndex(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

export function generatePassword(o: GeneratorOptions): string {
  const sets = charsets(o);
  if (!sets.length) return "";
  const all = sets.join("");
  const length = Math.max(sets.length, Math.min(128, Math.floor(o.length)));
  // Redraw until every selected set is represented; this keeps the distribution uniform over the
  // passwords that satisfy the rule.
  for (;;) {
    let out = "";
    for (let i = 0; i < length; i++) out += all[randomIndex(all.length)];
    if (sets.every((set) => [...out].some((ch) => set.includes(ch)))) return out;
  }
}

export function entropyBits(o: GeneratorOptions): number {
  const size = charsets(o).join("").length;
  return size ? Math.round(o.length * Math.log2(size)) : 0;
}

export function strengthLabel(bits: number): "Weak" | "Fair" | "Strong" | "Very strong" {
  if (bits < 60) return "Weak";
  if (bits < 80) return "Fair";
  if (bits < 120) return "Strong";
  return "Very strong";
}
