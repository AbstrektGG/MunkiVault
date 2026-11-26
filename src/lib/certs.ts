import "server-only";
import tls from "node:tls";

export type FetchedCert = {
  subject: string; issuer: string; sans: string; serialNumber: string; fingerprint: string;
  notBefore: string; notAfter: string;
};

const HOST = /^[a-zA-Z0-9]([a-zA-Z0-9.-]{0,251}[a-zA-Z0-9])?$/;
const day = (value: string) => new Date(value).toISOString().slice(0, 10);
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// Opens a TLS connection and reads the leaf certificate. Validation is deliberately off: the point
// is to document whatever the host presents, including expired or self-signed certificates.
export function fetchCertificate(host: string, port = 443, timeoutMs = 8000): Promise<FetchedCert> {
  return new Promise((resolve, reject) => {
    if (!HOST.test(host)) return reject(new Error("Enter a hostname or IP address without a scheme or path."));
    if (!Number.isInteger(port) || port < 1 || port > 65535) return reject(new Error("Port is out of range."));
    const socket = tls.connect({ host, port, servername: /^[\d.]+$/.test(host) ? undefined : host, rejectUnauthorized: false });
    const fail = (message: string) => { socket.destroy(); reject(new Error(message)); };
    socket.setTimeout(timeoutMs, () => fail(`Timed out connecting to ${host}:${port}.`));
    socket.once("error", (err) => fail(`Could not connect to ${host}:${port} (${err.message}).`));
    socket.once("secureConnect", () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.valid_to) return reject(new Error("The host did not present a certificate."));
      resolve({
        subject: first(cert.subject?.CN) || first(cert.subject?.O),
        issuer: [first(cert.issuer?.CN), first(cert.issuer?.O)].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(", "),
        sans: (cert.subjectaltname ?? "").split(", ").map((s) => s.replace(/^(DNS|IP Address):/, "")).filter(Boolean).join("\n"),
        serialNumber: cert.serialNumber ?? "",
        fingerprint: cert.fingerprint256 ?? "",
        notBefore: day(cert.valid_from),
        notAfter: day(cert.valid_to),
      });
    });
  });
}
