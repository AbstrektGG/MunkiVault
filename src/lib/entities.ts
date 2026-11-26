// Field definitions for the four vault entry types. Shared by forms, detail views, history and the store.
// This file must stay free of server-only imports because client components read it.

export type Kind = "assets" | "credentials" | "certificates" | "documents" | "otp";

export type FieldKind = "text" | "textarea" | "markdown" | "select" | "secret" | "date" | "number" | "asset";

export type FieldDef = {
  name: string;
  label: string;
  kind: FieldKind;
  options?: readonly (readonly [string, string])[];
  required?: boolean;
  help?: string;
  mono?: boolean;
  wide?: boolean;
  placeholder?: string;
};

export type EntityDef = {
  kind: Kind;
  singular: string;
  plural: string;
  fields: FieldDef[];
  // Columns shown in list tables (besides the name).
  columns: string[];
};

export const ASSET_TYPES = [
  ["server", "Server"], ["workstation", "Workstation"], ["laptop", "Laptop"], ["vm", "Virtual machine"],
  ["firewall", "Firewall"], ["switch", "Switch"], ["router", "Router"], ["access_point", "Access point"],
  ["storage", "Storage / NAS"], ["printer", "Printer"], ["ups", "UPS"], ["cloud", "Cloud service"],
  ["application", "Application"], ["website", "Website"], ["other", "Other"],
] as const;

export const PROTOCOLS = [
  ["none", "None"], ["rdp", "RDP"], ["ssh", "SSH"], ["https", "HTTPS"], ["http", "HTTP"], ["vnc", "VNC"],
] as const;

export const CREDENTIAL_SOURCES = [
  ["none", "None"],
  ["linked", "Linked credentials"],
  ["user", "Each user's personal vault"],
] as const;

export const DEFAULT_PORTS: Record<string, number> = { rdp: 3389, ssh: 22, https: 443, http: 80, vnc: 5900 };

const name: FieldDef = { name: "name", label: "Name", kind: "text", required: true, wide: true };
const assetRef: FieldDef = { name: "assetId", label: "Linked system", kind: "asset", help: "Optional. Shows this entry on the system's page." };

export const OTP_ALGORITHM_OPTIONS = [["SHA1", "SHA-1 (most services)"], ["SHA256", "SHA-256"], ["SHA512", "SHA-512"]] as const;
export const OTP_DIGIT_OPTIONS = [["6", "6 digits"], ["7", "7 digits"], ["8", "8 digits"]] as const;
export const OTP_PERIOD_OPTIONS = [["30", "30 seconds"], ["60", "60 seconds"], ["15", "15 seconds"], ["90", "90 seconds"]] as const;

export const ENTITIES: Record<Kind, EntityDef> = {
  assets: {
    kind: "assets", singular: "System", plural: "Systems",
    columns: ["type", "hostname", "ipAddress", "os", "status"],
    fields: [
      name,
      { name: "type", label: "Type", kind: "select", options: ASSET_TYPES, required: true },
      { name: "status", label: "Status", kind: "select", required: true, options: [["active", "Active"], ["spare", "Spare"], ["retired", "Retired"]] },
      { name: "hostname", label: "Hostname / FQDN", kind: "text", mono: true },
      { name: "ipAddress", label: "IP address", kind: "text", mono: true },
      { name: "os", label: "Operating system / firmware", kind: "text" },
      { name: "location", label: "Location", kind: "text" },
      { name: "manufacturer", label: "Manufacturer", kind: "text" },
      { name: "model", label: "Model", kind: "text" },
      { name: "serialNumber", label: "Serial number", kind: "text", mono: true },
      { name: "warrantyExpires", label: "Warranty expires", kind: "date" },
      { name: "protocol", label: "Remote connection", kind: "select", options: PROTOCOLS, required: true },
      { name: "port", label: "Port", kind: "number", help: "Leave empty for the protocol default." },
      { name: "credentialSource", label: "Credentials", kind: "select", options: CREDENTIAL_SOURCES, required: true, wide: true },
      { name: "userVaultKey", label: "Credential name in each user's personal vault", kind: "text" },
      { name: "notes", label: "Notes", kind: "markdown", wide: true },
    ],
  },
  credentials: {
    kind: "credentials", singular: "Credential", plural: "Credentials",
    columns: ["username", "url", "expiresAt"],
    fields: [
      name,
      { name: "username", label: "Username", kind: "text", mono: true },
      { name: "password", label: "Password", kind: "secret" },
      { name: "url", label: "URL", kind: "text", mono: true, placeholder: "https://" },
      { name: "totp", label: "One-time code (TOTP)", kind: "secret", help: "Base32 seed or otpauth:// URI. MunkiVault generates the 6 digit codes." },
      { name: "expiresAt", label: "Password expires", kind: "date" },
      { name: "notes", label: "Notes", kind: "markdown", wide: true },
    ],
  },
  certificates: {
    kind: "certificates", singular: "Certificate", plural: "Certificates",
    columns: ["host", "issuer", "notAfter"],
    fields: [
      name,
      assetRef,
      { name: "host", label: "Host", kind: "text", mono: true, help: "Used to fetch the live certificate." },
      { name: "port", label: "Port", kind: "number", placeholder: "443" },
      { name: "subject", label: "Subject", kind: "text", mono: true },
      { name: "issuer", label: "Issuer", kind: "text" },
      { name: "notBefore", label: "Valid from", kind: "date" },
      { name: "notAfter", label: "Expires", kind: "date", required: true },
      { name: "serialNumber", label: "Serial number", kind: "text", mono: true },
      { name: "fingerprint", label: "SHA-256 fingerprint", kind: "text", mono: true },
      { name: "sans", label: "Subject alternative names", kind: "textarea", mono: true, wide: true },
      { name: "notes", label: "Notes", kind: "markdown", wide: true },
    ],
  },
  otp: {
    kind: "otp", singular: "OTP", plural: "OTPs",
    columns: ["issuer", "account"],
    fields: [
      name,
      { name: "issuer", label: "Issuer / service", kind: "text", placeholder: "Microsoft" },
      { name: "account", label: "Account", kind: "text", mono: true, placeholder: "admin@contoso.onmicrosoft.com" },
      { name: "totp", label: "Setup key", kind: "secret", required: true, help: "The secret key shown under \"Can't scan the QR code?\", or an otpauth:// link. Spaces and lower case are fine." },
      { name: "algorithm", label: "Algorithm", kind: "select", options: OTP_ALGORITHM_OPTIONS, required: true },
      { name: "digits", label: "Code length", kind: "select", options: OTP_DIGIT_OPTIONS, required: true },
      { name: "period", label: "New code every", kind: "select", options: OTP_PERIOD_OPTIONS, required: true },
      { name: "url", label: "Sign-in URL", kind: "text", mono: true, placeholder: "https://" },
      { name: "notes", label: "Notes", kind: "markdown", wide: true },
    ],
  },
  documents: {
    kind: "documents", singular: "Document", plural: "Documents",
    columns: [],
    fields: [
      { ...name, label: "Title" },
      { name: "content", label: "Content", kind: "markdown", wide: true },
    ],
  },
};

export const KINDS = Object.keys(ENTITIES) as Kind[];
export const isKind = (value: string): value is Kind => (KINDS as string[]).includes(value);

export function optionLabel(field: FieldDef, value: unknown): string {
  return field.options?.find(([v]) => v === String(value))?.[1] ?? String(value ?? "");
}

export const LEVELS = ["viewer", "editor", "manager"] as const;
export type Level = (typeof LEVELS)[number];
export const LEVEL_HELP: Record<Level, string> = {
  viewer: "Read systems, certificates and documents. Cannot reveal secrets.",
  editor: "Reveal secrets, create and edit entries, restore versions.",
  manager: "Everything an editor can do, plus delete entries and manage access.",
};

// Folder icons, in the order offered when creating a folder.
export const FOLDER_ICONS = [
  ["folder", "Folder"], ["site", "Site / location"], ["servers", "Servers"], ["virtual", "Virtual hosts / VMs"],
  ["network", "Network"], ["firewall", "Routers / firewalls"], ["switches", "Switches"], ["wireless", "Wireless"],
  ["storage", "Storage / NAS"], ["workstations", "Workstations"], ["printers", "Printers"], ["ups", "UPS / power"],
  ["vpn", "VPN"], ["cloud", "Cloud"], ["passwords", "Passwords and logins"], ["documents", "Documents"],
] as const;
export type FolderIcon = (typeof FOLDER_ICONS)[number][0];

// "System" -> "system" in running text, but acronyms such as "OTP" stay as they are.
export const lowerLabel = (label: string) => (label === label.toUpperCase() ? label : label.toLowerCase());
