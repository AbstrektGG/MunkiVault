import { createCipheriv, createDecipheriv, randomBytes, scrypt, timingSafeEqual, createHash, createHmac } from "node:crypto";

// ---- Secret encryption (AES-256-GCM, key from MUNKIVAULT_MASTER_KEY) ----

function masterKey(): Buffer {
  const raw = process.env.MUNKIVAULT_MASTER_KEY;
  if (!raw) throw new Error("MUNKIVAULT_MASTER_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("MUNKIVAULT_MASTER_KEY must be 32 bytes, base64 encoded");
  return key;
}

export function masterKeyConfigured(): boolean {
  try { masterKey(); return true; } catch { return false; }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptSecret(payload: string): string {
  const [v, iv, tag, ct] = payload.split(":");
  if (v !== "v1" || !iv || !tag || ct === undefined) throw new Error("Unrecognised secret format");
  const decipher = createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64")), decipher.final()]).toString("utf8");
}

// ---- Password hashing (scrypt) ----

const SCRYPT = { N: 1 << 15, r: 8, p: 3 };

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize("NFKC"), salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  if (!stored) return false;
  const [scheme, N, r, p, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scryptAsync(password, Buffer.from(salt, "base64"), Number(N), Number(r), Number(p));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// ---- Tokens ----

export const randomToken = () => randomBytes(32).toString("base64url");
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

// ---- TOTP (RFC 6238, SHA-1, 6 digits, 30 second step) ----

export function base32Decode(input: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0, value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = alphabet.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(out);
}

export function base32Encode(buf: Buffer): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0, out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) { out += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 31];
  return out;
}

// ---- One-time passwords (TOTP, RFC 6238) ----

export const OTP_ALGORITHMS = ["SHA1", "SHA256", "SHA512"] as const;
export type OtpAlgorithm = (typeof OTP_ALGORITHMS)[number];
export type OtpSettings = { algorithm: OtpAlgorithm; digits: number; period: number };
export type OtpConfig = OtpSettings & { secret: string; issuer?: string; account?: string };
export const OTP_DEFAULTS: OtpSettings = { algorithm: "SHA1", digits: 6, period: 30 };

function checkSettings(s: OtpSettings) {
  if (!OTP_ALGORITHMS.includes(s.algorithm)) throw new Error("Unsupported OTP algorithm. Use SHA1, SHA256 or SHA512.");
  if (!Number.isInteger(s.digits) || s.digits < 6 || s.digits > 8) throw new Error("OTP codes must be 6 to 8 digits.");
  if (!Number.isInteger(s.period) || s.period < 10 || s.period > 300) throw new Error("The OTP period must be between 10 and 300 seconds.");
}

// Accepts a bare base32 key or an otpauth://totp/ link (as encoded in authenticator QR codes).
export function parseOtp(input: string): OtpConfig {
  const trimmed = input.trim();
  let secret = trimmed, settings = { ...OTP_DEFAULTS }, issuer: string | undefined, account: string | undefined;
  if (/^otpauth-migration:/i.test(trimmed)) throw new Error("Google Authenticator export codes are not supported. Scan the QR code from the service itself.");
  if (/^otpauth:/i.test(trimmed)) {
    const url = new URL(trimmed);
    if (url.host.toLowerCase() !== "totp") throw new Error("Only time-based codes (TOTP) are supported, not counter-based (HOTP).");
    const p = url.searchParams;
    secret = p.get("secret") ?? "";
    const label = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const [labelIssuer, labelAccount] = label.includes(":") ? [label.slice(0, label.indexOf(":")), label.slice(label.indexOf(":") + 1)] : [undefined, label];
    issuer = (p.get("issuer") ?? labelIssuer)?.trim() || undefined;
    account = labelAccount?.trim() || undefined;
    settings = {
      algorithm: (p.get("algorithm")?.toUpperCase().replace("-", "") ?? "SHA1") as OtpAlgorithm,
      digits: p.has("digits") ? Number(p.get("digits")) : 6,
      period: p.has("period") ? Number(p.get("period")) : 30,
    };
    checkSettings(settings);
  }
  const clean = secret.toUpperCase().replace(/[\s=-]/g, "");
  if (!/^[A-Z2-7]+$/.test(clean)) throw new Error("The OTP secret key must be base32 (letters A-Z and digits 2-7).");
  if (base32Decode(clean).length < 10) throw new Error("The OTP secret key is too short.");
  return { secret: clean, ...settings, issuer, account };
}

// What gets encrypted and stored: the bare key, or an otpauth link when the settings are not the defaults.
export function canonicalOtp(input: string): string {
  const c = parseOtp(input);
  if (c.algorithm === "SHA1" && c.digits === 6 && c.period === 30) return c.secret;
  return `otpauth://totp/MunkiVault?secret=${c.secret}&algorithm=${c.algorithm}&digits=${c.digits}&period=${c.period}`;
}

function hotp(key: Buffer, counter: number, algorithm: OtpAlgorithm, digits: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac(algorithm.toLowerCase(), key).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  return ((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).toString().padStart(digits, "0");
}

export type OtpCode = { code: string; next: string; remaining: number; period: number; digits: number };

// `stored` is what canonicalOtp produced; `overrides` (from an OTP entry's own settings) win over it.
export function otpCode(stored: string, now = Date.now(), overrides?: Partial<OtpSettings>): OtpCode {
  const cfg = { ...parseOtp(stored), ...Object.fromEntries(Object.entries(overrides ?? {}).filter(([, v]) => v !== null && v !== undefined)) } as OtpConfig;
  checkSettings(cfg);
  const key = base32Decode(cfg.secret);
  const seconds = Math.floor(now / 1000);
  const counter = Math.floor(seconds / cfg.period);
  return {
    code: hotp(key, counter, cfg.algorithm, cfg.digits),
    next: hotp(key, counter + 1, cfg.algorithm, cfg.digits),
    remaining: cfg.period - (seconds % cfg.period),
    period: cfg.period,
    digits: cfg.digits,
  };
}

export function totp(seed: string, now = Date.now()): { code: string; remaining: number } {
  const { code, remaining } = otpCode(seed, now);
  return { code, remaining };
}
