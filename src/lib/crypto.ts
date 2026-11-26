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

// Accepts a bare base32 seed or an otpauth:// URI.
export function parseTotpSeed(input: string): string {
  const trimmed = input.trim();
  const seed = trimmed.startsWith("otpauth://") ? new URL(trimmed).searchParams.get("secret") ?? "" : trimmed;
  const clean = seed.toUpperCase().replace(/[\s=-]/g, "");
  if (clean.length < 16 || base32Decode(clean).length < 10) throw new Error("TOTP seed is too short or not base32");
  return clean;
}

export function totp(seed: string, now = Date.now()): { code: string; remaining: number } {
  const step = 30;
  const counter = Math.floor(now / 1000 / step);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", base32Decode(seed)).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const code = ((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, "0");
  return { code, remaining: step - (Math.floor(now / 1000) % step) };
}
