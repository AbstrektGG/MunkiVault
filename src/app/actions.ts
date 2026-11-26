"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { folders, orgAccess, organizations, users } from "@/db/schema";
import {
  clearLoginFailures, clientIp, createSession, destroySession, destroyUserSessions, hasAnyUser, loginBlocked,
  passwordProblem, recordLoginFailure, requireAdmin, requireUser,
} from "@/lib/auth";
import { audit, isUuid, requireOrg } from "@/lib/access";
import { decryptSecret, hashPassword, totp, verifyPassword } from "@/lib/crypto";
import { ENTITIES, LEVELS, isKind, type Kind, type Level } from "@/lib/entities";
import { createEntry, deleteEntry, getEntry, parseForm, restoreRevision, updateEntry } from "@/lib/store";
import { fetchCertificate, type FetchedCert } from "@/lib/certs";
import { deleteFolder, descendantIds, getFolder, listFolders, loadTree, moveEntry, resolveFolder, type OrgTree } from "@/lib/folders";
import { FOLDER_ICONS, DEFAULT_PORTS } from "@/lib/entities";
import { appendLink, resolveCredential, setLinkedCredentials } from "@/lib/credentials";
import { snapshotOf } from "@/lib/store";

export type FormState = { error?: string; ok?: string } | null;

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
const message = (err: unknown) => (err instanceof Error ? err.message : "Something went wrong.");
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function kindOrThrow(kind: string): Kind {
  if (!isKind(kind)) throw new Error("Unknown entry type.");
  return kind;
}

// ---------- Authentication ----------

export async function setupAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (await hasAnyUser()) redirect("/login");
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const password = String(form.get("password") ?? "");
  if (!name || !EMAIL.test(email)) return { error: "Enter your name and a valid email address." };
  const problem = passwordProblem(password);
  if (problem) return { error: problem };
  const passwordHash = await hashPassword(password);
  // The guard is repeated inside the insert so two concurrent setups cannot both create an admin.
  const created = await db.execute<{ id: string }>(sql`
    insert into users (email, name, password_hash, role)
    select ${email}, ${name}, ${passwordHash}, 'admin' where not exists (select 1 from users)
    returning id`);
  const id = created[0]?.id;
  if (!id) redirect("/login");
  await audit({ id, email }, "user.setup");
  await createSession(id);
  redirect("/");
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = str(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const key = `${email}|${(await clientIp()) ?? ""}`;
  if (loginBlocked(key)) return { error: "Too many failed attempts. Try again in 15 minutes." };
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  // Always run a hash comparison so response time does not reveal whether the account exists.
  const ok = await verifyPassword(password, user?.passwordHash ?? "scrypt$32768$8$3$AAAAAAAAAAAAAAAAAAAAAA==$AA==");
  if (!user || !ok || user.disabled) {
    recordLoginFailure(key);
    await audit(user ?? null, "login.failed", { actor: email });
    return { error: "Incorrect email or password." };
  }
  clearLoginFailures(key);
  await createSession(user.id);
  await audit(user, "login");
  redirect("/");
}

export async function logoutAction() {
  const user = await requireUser();
  await audit(user, "logout");
  await destroySession();
  redirect("/login");
}

export async function changePasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const next = String(form.get("next") ?? "");
  if (user.passwordHash && !(await verifyPassword(String(form.get("current") ?? ""), user.passwordHash))) {
    return { error: "Your current password is incorrect." };
  }
  const problem = passwordProblem(next);
  if (problem) return { error: problem };
  if (next !== String(form.get("confirm") ?? "")) return { error: "The new passwords do not match." };
  await db.update(users).set({ passwordHash: await hashPassword(next) }).where(eq(users.id, user.id));
  await destroyUserSessions(user.id);
  await createSession(user.id);
  await audit(user, "user.password_changed");
  return { ok: "Password updated. Other sessions were signed out." };
}

// ---------- Organizations ----------

export async function saveOrgAction(orgId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const name = str(form, "name");
  const kind = str(form, "kind") === "internal" ? "internal" : "customer";
  const description = str(form, "description") || null;
  if (!name || name.length > 200) return { error: "Enter a name (up to 200 characters)." };
  let id = orgId;
  if (orgId) {
    const { user, org } = await requireOrg(orgId, "manager");
    if (org.ownerId) return { error: "Personal vaults cannot be renamed." };
    await db.update(organizations).set({ name, kind, description, updatedAt: new Date() }).where(eq(organizations.id, orgId));
    await audit(user, "org.updated", { orgId, detail: name });
    revalidatePath("/", "layout");
  } else {
    const user = await requireAdmin();
    const [row] = await db.insert(organizations).values({ name, kind, description }).returning({ id: organizations.id });
    id = row.id;
    await audit(user, "org.created", { orgId: id, detail: name });
    revalidatePath("/", "layout");
  }
  redirect(`/orgs/${id}`);
}

export async function deleteOrgAction(orgId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const { org } = await requireOrg(orgId, "manager");
  if (org.ownerId) return { error: "Personal vaults cannot be deleted." };
  if (str(form, "confirm") !== org.name) return { error: "Type the organization name exactly to confirm." };
  await db.delete(organizations).where(eq(organizations.id, orgId));
  await audit(user, "org.deleted", { detail: org.name });
  revalidatePath("/", "layout");
  redirect("/orgs");
}

export async function setAccessAction(orgId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { user, org } = await requireOrg(orgId, "manager");
  if (org.ownerId) return { error: "Personal vaults cannot be shared." };
  const userId = str(form, "userId");
  const level = str(form, "level");
  if (!isUuid(userId)) return { error: "Choose a user." };
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "That user no longer exists." };
  if (level === "none") {
    await db.delete(orgAccess).where(and(eq(orgAccess.orgId, orgId), eq(orgAccess.userId, userId)));
  } else {
    if (!(LEVELS as readonly string[]).includes(level)) return { error: "Unknown access level." };
    await db.insert(orgAccess).values({ orgId, userId, level })
      .onConflictDoUpdate({ target: [orgAccess.userId, orgAccess.orgId], set: { level } });
  }
  await audit(user, "access.changed", { orgId, detail: `${target.email}: ${level}` });
  revalidatePath("/", "layout");
  return { ok: `Access updated for ${target.name}.` };
}

// ---------- Vault entries ----------

export async function saveEntryAction(kindRaw: string, orgId: string, id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const kind = kindOrThrow(kindRaw);
  let target: string;
  let dest: string | null = null;
  try {
    const { user } = await requireOrg(orgId, "editor");
    if (id) {
      const existing = await getEntry(kind, orgId, id);
      if (!existing) return { error: "This entry no longer exists." };
      if (Number(form.get("version")) !== existing.version) {
        return { error: "Someone else saved this entry while you were editing. Reload to see their changes." };
      }
      const values = await parseForm(kind, orgId, form, existing);
      const folderId = await resolveFolder(orgId, form.get("folderId"));
      if (await updateEntry(kind, existing, values, user.id)) {
        await audit(user, `${kind}.updated`, { orgId, entityType: kind, entityId: id, detail: String(values.name) });
      }
      // Where an entry lives is not part of its content, so moving it does not create a version.
      if (folderId !== ((existing.folderId as string | null) ?? null)) {
        await moveEntry(kind, id, folderId);
        await audit(user, `${kind}.moved`, { orgId, entityType: kind, entityId: id, detail: String(values.name) });
      }
      if (kind === "assets") await saveLinks(user, orgId, id, String(values.name), values.credentialSource === "linked" ? form.getAll("credentialIds").map(String) : []);
      target = id;
    } else {
      const values = await parseForm(kind, orgId, form, null);
      const folderId = await resolveFolder(orgId, form.get("folderId"));
      target = await createEntry(kind, orgId, values, user.id, folderId);
      if (kind === "assets" && values.credentialSource === "linked") {
        await saveLinks(user, orgId, target, String(values.name), form.getAll("credentialIds").map(String));
      }
      // "New credential" started from a device links the new credential to that device.
      const linkTo = str(form, "linkTo");
      if (kind === "credentials" && linkTo) {
        const device = await getEntry("assets", orgId, linkTo);
        if (device) {
          await appendLink(device.id, target);
          if (device.credentialSource !== "linked") {
            await updateEntry("assets", device, { ...snapshotOf("assets", device), credentialSource: "linked", userVaultKey: null }, user.id);
          }
          await audit(user, "assets.credentials_linked", { orgId, entityType: "assets", entityId: device.id, detail: `${device.name}: ${values.name}` });
          dest = `/orgs/${orgId}/assets/${device.id}`;
        }
      }
      await audit(user, `${kind}.created`, { orgId, entityType: kind, entityId: target, detail: String(values.name) });
    }
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
  redirect(dest ?? `/orgs/${orgId}/${kind}/${target}`);
}

async function saveLinks(user: { id: string; email: string }, orgId: string, assetId: string, name: string, ids: string[]) {
  if (await setLinkedCredentials({ id: assetId, orgId }, ids)) {
    await audit(user, "assets.credentials_linked", { orgId, entityType: "assets", entityId: assetId, detail: `${name}: ${ids.length} linked` });
  }
}

// redirect() and notFound() signal through thrown errors that must not be swallowed.
function isRedirect(err: unknown) {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.includes("NOT_FOUND") || digest.startsWith("NEXT_HTTP_ERROR"));
}

export async function deleteEntryAction(kindRaw: string, orgId: string, id: string) {
  const kind = kindOrThrow(kindRaw);
  const { user } = await requireOrg(orgId, "manager");
  const existing = await getEntry(kind, orgId, id);
  if (existing) {
    await deleteEntry(kind, existing, user.id);
    await audit(user, `${kind}.deleted`, { orgId, entityType: kind, entityId: id, detail: existing.name });
    if (existing.folderId) redirect(`/orgs/${orgId}/folders/${existing.folderId}`);
  }
  redirect(`/orgs/${orgId}/${kind}`);
}

export async function restoreAction(kindRaw: string, orgId: string, id: string, version: number) {
  const kind = kindOrThrow(kindRaw);
  const { user } = await requireOrg(orgId, "editor");
  const existing = await getEntry(kind, orgId, id);
  if (!existing) redirect(`/orgs/${orgId}/${kind}`);
  if (await restoreRevision(kind, existing, version, user.id)) {
    await audit(user, `${kind}.restored`, { orgId, entityType: kind, entityId: id, detail: `${existing.name}: version ${version}` });
  }
  redirect(`/orgs/${orgId}/${kind}/${id}`);
}

export type EntryInfo = {
  credentialName?: string; source: "direct" | "linked" | "user" | "none"; problem?: string;
  username?: string; hasPassword: boolean; hasTotp: boolean; canReveal: boolean;
  hostname?: string; connect?: { protocol: string; href: string };
};

// What the right-click menu and the item header can offer. Contains no secrets.
export async function entryInfoAction(orgId: string, kindRaw: string, id: string): Promise<EntryInfo | { error: string }> {
  try {
    const kind = kindOrThrow(kindRaw);
    const { user, level } = await requireOrg(orgId);
    const entry = await getEntry(kind, orgId, id);
    if (!entry) return { error: "This item no longer exists." };
    const r = await resolveCredential(user, kind, entry);
    const info: EntryInfo = {
      source: r.source, problem: r.problem, credentialName: r.credential?.name,
      username: r.credential?.username ?? undefined, hasPassword: Boolean(r.credential?.password), hasTotp: Boolean(r.credential?.totp),
      // A personal vault credential is the user's own; shared credentials need editor access to reveal.
      canReveal: r.source === "user" || level === "editor" || level === "manager",
    };
    if (kind === "assets") {
      const host = String(entry.hostname || entry.ipAddress || "");
      const protocol = String(entry.protocol ?? "none");
      info.hostname = host || undefined;
      if (host && protocol !== "none") {
        const port = Number(entry.port) || DEFAULT_PORTS[protocol];
        info.connect = { protocol, href: protocol === "rdp" ? `/orgs/${orgId}/assets/${id}/rdp` : `${protocol}://${host}${port === DEFAULT_PORTS[protocol] ? "" : `:${port}`}` };
      }
    }
    return info;
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
}

export async function revealForEntryAction(orgId: string, kindRaw: string, id: string, field: "password" | "totp", purpose: "view" | "copy" = "view"): Promise<{ value?: string; remaining?: number; error?: string }> {
  try {
    const kind = kindOrThrow(kindRaw);
    const { user, level } = await requireOrg(orgId);
    const entry = await getEntry(kind, orgId, id);
    if (!entry) return { error: "This item no longer exists." };
    const r = await resolveCredential(user, kind, entry);
    if (!r.credential) return { error: r.problem ?? "No credential is available." };
    if (r.source !== "user" && level !== "editor" && level !== "manager") {
      return { error: "You do not have permission to reveal secrets in this organization." };
    }
    const stored = field === "password" ? r.credential.password : r.credential.totp;
    if (!stored) return { error: field === "password" ? "No password is stored." : "No one-time code is set up." };
    const plain = decryptSecret(stored);
    const verb = field === "totp" ? "totp_generated" : purpose === "copy" ? "copied" : "revealed";
    const device = kind === "assets" ? `${entry.name}: ` : "";
    const via = r.source === "user" ? " (from their personal vault)" : "";
    // Logged against the organization being worked on, so its activity shows who used which credential on which device.
    await audit(user, `credentials.${verb}`, { orgId, entityType: kind, entityId: id, detail: `${device}${r.credential.name}${via}` });
    if (field === "totp") { const { code, remaining } = totp(plain); return { value: code, remaining }; }
    return { value: plain };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
}

export async function revealSecretAction(orgId: string, id: string, field: "password" | "totp") {
  return revealForEntryAction(orgId, "credentials", id, field);
}

export async function fetchCertAction(orgId: string, host: string, port: number): Promise<{ cert?: FetchedCert; error?: string }> {
  try {
    await requireOrg(orgId, "editor");
    return { cert: await fetchCertificate(host.trim(), port || 443) };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
}

export async function recheckCertAction(orgId: string, id: string, _prev: FormState): Promise<FormState> {
  try {
    const { user } = await requireOrg(orgId, "editor");
    const existing = await getEntry("certificates", orgId, id);
    if (!existing) return { error: "This certificate no longer exists." };
    if (!existing.host) return { error: "Add a host to this certificate first." };
    const cert = await fetchCertificate(String(existing.host), Number(existing.port) || 443);
    const values = Object.fromEntries(ENTITIES.certificates.fields.map((f) => [f.name, (existing[f.name] as string | number | null) ?? null]));
    const changed = await updateEntry("certificates", existing, { ...values, ...cert }, user.id);
    if (changed) await audit(user, "certificates.updated", { orgId, entityType: "certificates", entityId: id, detail: `${existing.name}: refreshed from host` });
    revalidatePath(`/orgs/${orgId}/certificates/${id}`);
    return { ok: changed ? `Updated from ${existing.host}. Now expires ${cert.notAfter}.` : "The host still presents the same certificate." };
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
}

// ---------- User administration ----------

export async function createUserAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const password = String(form.get("password") ?? "");
  const role = str(form, "role") === "admin" ? "admin" : "member";
  if (!name || !EMAIL.test(email)) return { error: "Enter a name and a valid email address." };
  // An empty password creates an SSO-only account.
  if (password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
  }
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return { error: "A user with that email already exists." };
  await db.insert(users).values({ email, name, role, passwordHash: password ? await hashPassword(password) : null });
  await audit(admin, "user.created", { detail: `${email} (${role})` });
  revalidatePath("/admin/users");
  return { ok: `${name} was added.` };
}

export async function updateUserAction(userId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!isUuid(userId)) return { error: "Unknown user." };
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) return { error: "Unknown user." };
  const role = str(form, "role") === "admin" ? "admin" : "member";
  const disabled = form.get("disabled") === "on";
  const password = String(form.get("password") ?? "");
  const ssoOnly = form.get("ssoOnly") === "on";
  if (target.id === admin.id && (role !== "admin" || disabled || ssoOnly)) {
    return { error: "You cannot remove your own administrator access, password or account." };
  }
  const patch: Partial<typeof users.$inferInsert> = { role, disabled };
  if (ssoOnly) {
    patch.passwordHash = null;
  } else if (password) {
    const problem = passwordProblem(password);
    if (problem) return { error: problem };
    patch.passwordHash = await hashPassword(password);
  }
  await db.update(users).set(patch).where(eq(users.id, userId));
  if (disabled || password || ssoOnly) await destroyUserSessions(userId);
  await audit(admin, "user.updated", { detail: `${target.email}: role ${role}${disabled ? ", disabled" : ""}${ssoOnly ? ", password removed" : password ? ", password reset" : ""}` });
  revalidatePath("/admin/users");
  return { ok: "Saved." };
}

// ---------- Folders and the navigation tree ----------

export async function loadTreeAction(orgId: string): Promise<OrgTree | null> {
  try {
    await requireOrg(orgId);
    return await loadTree(orgId);
  } catch (err) {
    if (isRedirect(err)) throw err;
    return null;
  }
}

export async function saveFolderAction(orgId: string, folderId: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  let target: string;
  try {
    const { user } = await requireOrg(orgId, "editor");
    const name = str(form, "name");
    const icon = str(form, "icon") || "folder";
    if (!name || name.length > 120) return { error: "Enter a folder name (up to 120 characters)." };
    if (!FOLDER_ICONS.some(([v]) => v === icon)) return { error: "Unknown folder icon." };
    const parentId = await resolveFolder(orgId, form.get("parentId"));
    if (folderId) {
      const existing = await getFolder(orgId, folderId);
      if (!existing) return { error: "This folder no longer exists." };
      if (parentId && descendantIds(await listFolders(orgId), folderId).has(parentId)) {
        return { error: "A folder cannot be moved inside itself." };
      }
      await db.update(folders).set({ name, icon, parentId, updatedAt: new Date() }).where(eq(folders.id, folderId));
      await audit(user, "folder.updated", { orgId, entityType: "folders", entityId: folderId, detail: name });
      target = folderId;
    } else {
      const [row] = await db.insert(folders).values({ orgId, name, icon, parentId }).returning({ id: folders.id });
      await audit(user, "folder.created", { orgId, entityType: "folders", entityId: row.id, detail: name });
      target = row.id;
    }
  } catch (err) {
    if (isRedirect(err)) throw err;
    return { error: message(err) };
  }
  redirect(`/orgs/${orgId}/folders/${target}`);
}

export async function deleteFolderAction(orgId: string, folderId: string) {
  const { user } = await requireOrg(orgId, "manager");
  const folder = await getFolder(orgId, folderId);
  if (!folder) redirect(`/orgs/${orgId}`);
  await deleteFolder(folder);
  await audit(user, "folder.deleted", { orgId, entityType: "folders", entityId: folderId, detail: `${folder.name} (contents moved up one level)` });
  redirect(folder.parentId ? `/orgs/${orgId}/folders/${folder.parentId}` : `/orgs/${orgId}`);
}
