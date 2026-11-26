import {
  type AnyPgColumn, pgTable, uuid, text, timestamp, integer, boolean, jsonb, date, primaryKey, index, uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  ssoSubject: text("sso_subject").unique(),
  role: text("role").notNull().default("member"), // admin | member
  disabled: boolean("disabled").notNull().default(false),
  createdAt: ts("created_at").notNull().defaultNow(),
  lastLoginAt: ts("last_login_at"),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // sha256 of the cookie token
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind").notNull().default("customer"), // customer | internal
  description: text("description"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const orgAccess = pgTable("org_access", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  level: text("level").notNull(), // viewer | editor | manager
}, (t) => [primaryKey({ columns: [t.userId, t.orgId] })]);

// Folders nest inside an organization; entries of any type can live in a folder or at the root.
export const folders = pgTable("folders", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  parentId: uuid("parent_id").references((): AnyPgColumn => folders.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("folder"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
}, (t) => [index("folders_org_idx").on(t.orgId), index("folders_parent_idx").on(t.parentId)]);

// Columns shared by every vault entry type.
const entry = () => ({
  id: id(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  folderId: uuid("folder_id").references(() => folders.id, { onDelete: "set null" }),
  version: integer("version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
});

export const assets = pgTable("assets", {
  ...entry(),
  type: text("type").notNull().default("server"),
  status: text("status").notNull().default("active"),
  hostname: text("hostname"),
  ipAddress: text("ip_address"),
  os: text("os"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  serialNumber: text("serial_number"),
  location: text("location"),
  protocol: text("protocol").notNull().default("none"),
  port: integer("port"),
  warrantyExpires: date("warranty_expires"),
  notes: text("notes"),
}, (t) => [index("assets_org_idx").on(t.orgId)]);

export const credentials = pgTable("credentials", {
  ...entry(),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  username: text("username"),
  password: text("password"), // AES-256-GCM ciphertext
  url: text("url"),
  totp: text("totp"), // AES-256-GCM ciphertext of the base32 seed
  expiresAt: date("expires_at"),
  notes: text("notes"),
}, (t) => [index("credentials_org_idx").on(t.orgId)]);

export const certificates = pgTable("certificates", {
  ...entry(),
  assetId: uuid("asset_id").references(() => assets.id, { onDelete: "set null" }),
  host: text("host"),
  port: integer("port"),
  subject: text("subject"),
  issuer: text("issuer"),
  sans: text("sans"),
  serialNumber: text("serial_number"),
  fingerprint: text("fingerprint"),
  notBefore: date("not_before"),
  notAfter: date("not_after"),
  notes: text("notes"),
}, (t) => [index("certificates_org_idx").on(t.orgId)]);

export const documents = pgTable("documents", {
  ...entry(),
  content: text("content"),
}, (t) => [index("documents_org_idx").on(t.orgId)]);

export const revisions = pgTable("revisions", {
  id: id(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id").notNull(),
  version: integer("version").notNull(),
  action: text("action").notNull(), // create | update | restore | delete
  snapshot: jsonb("snapshot").notNull().$type<Record<string, unknown>>(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [uniqueIndex("revisions_entity_idx").on(t.entityType, t.entityId, t.version)]);

export const auditLog = pgTable("audit_log", {
  id: id(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  actor: text("actor"), // email at the time of the event, kept if the user is removed
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entityType: text("entity_type"),
  entityId: uuid("entity_id"),
  detail: text("detail"),
  ip: text("ip"),
  createdAt: ts("created_at").notNull().defaultNow(),
}, (t) => [index("audit_created_idx").on(t.createdAt), index("audit_org_idx").on(t.orgId)]);
