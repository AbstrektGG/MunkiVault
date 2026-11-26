# MunkiVault

IT documentation and asset management for managed service providers and internal IT teams.
Organizations (customers and your own infrastructure) hold systems, credentials, certificates and
Markdown documents, with version history, per-organization access control, an audit log and
single sign-on.

## Features

| Area | What it does |
| --- | --- |
| Layout | Remote Desktop Manager style: the app menu (collapsible to an icon rail), then a tree pane showing one vault at a time with a vault picker, filter and resizable width, then the selected item's details |
| Right-click menu | On any tree item: Open, Connect, Copy username, Copy password, Copy OTP, View password, View OTP, Copy host, Edit properties. Folders offer New folder and New item. Shift+F10 opens it from the keyboard. The same actions sit in each item's header |
| Device credentials | Set on the device: none, one or more linked credentials (the first is the default), or each user's personal vault. One credential can serve many devices; its page lists them under Used by. RDP files carry the username, never the password |
| Personal vaults | Every user has a private vault that nobody else, administrators included, can open. A device set to "each user's personal vault" uses the credential with a given name from whoever is signed in, and every use is audited under that person |
| Organizations | Customers and internal infrastructure, each with its own entries, activity and access list |
| Folders | Nest folders inside an organization (sites, servers, switches, passwords and so on), each with its own icon. Any item can live in any folder. Deleting a folder moves its contents up a level |
| Systems | Servers, network gear, cloud services and more, with hostname, IP, OS, serial, warranty and Markdown notes |
| Remote connections | One click connect: downloads a `.rdp` file, or opens `ssh://`, `https://`, `vnc://` links |
| Credentials | Passwords and TOTP seeds encrypted with AES-256-GCM. Hidden until revealed, auto-hide after 30 seconds, every reveal audited |
| One-time codes | Store a TOTP seed and generate the 6 digit codes in the app |
| Certificates | Fetch a live certificate from any host and port, track expiry, re-check on demand |
| Expirations | Certificates, passwords and warranties that are expired or due, across all organizations |
| Documents | Markdown editor with toolbar, split preview and sanitised rendering |
| Password generator | Runs in the browser, available standalone and on every credential form |
| Version history | Every save is a version. Field level changes, line diffs for Markdown, one click restore |
| Access control | Administrators see everything. Members get viewer, editor or manager access per organization |
| Single sign-on | OpenID Connect (Microsoft Entra ID, Google Workspace, Okta, Keycloak, Authentik) alongside local accounts |
| Audit log | Sign-ins, reveals, changes, access changes and RDP downloads, with actor and IP |
| Search | Across systems, credentials, certificates and documents you can access. Secrets are never searched |

## Quick start (development)

Requires Node 22 and PostgreSQL 14 or newer.

```bash
cp .env.example .env.local
```

```bash
npm run keygen
```

Put the generated key in `MUNKIVAULT_MASTER_KEY` and set `DATABASE_URL`, then:

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run dev
```

Open http://localhost:3000. The first visit asks you to create the administrator account.

## Deploying with Docker

```bash
cp .env.example .env
```

Set `MUNKIVAULT_MASTER_KEY`, `APP_URL` and add a `POSTGRES_PASSWORD` line to `.env`, then:

```bash
docker compose up -d --build
```

Run it behind a TLS terminating reverse proxy and set `APP_URL` to the public `https://` address.
Session cookies are marked `Secure` only when `APP_URL` starts with `https://`. The proxy must set
`X-Forwarded-For` for the audit log to record client addresses.

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `MUNKIVAULT_MASTER_KEY` | 32 random bytes, base64. Encrypts every stored secret |
| `APP_URL` | Public base URL. Used for SSO redirects and secure cookies |
| `SESSION_HOURS` | Session lifetime, default 12 |
| `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` | Enables single sign-on when set |
| `OIDC_NAME` | Label on the sign-in button |
| `OIDC_ALLOWED_DOMAINS` | Comma separated email domains allowed through SSO. Empty allows any |
| `OIDC_AUTO_PROVISION` | `true` creates an account on first SSO sign-in, `false` requires an administrator to add the user first |

### Single sign-on with Microsoft Entra ID

1. Register an application (single tenant) in Entra ID.
2. Add a Web redirect URI: `<APP_URL>/api/auth/sso/callback` (also shown under Administration, Settings).
3. Create a client secret.
4. Set `OIDC_ISSUER=https://login.microsoftonline.com/<tenant-id>/v2.0`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET`, then restart.

Accounts created by SSO are members with no organization access until an administrator or manager
grants it. An SSO identity is only ever linked by email to an account that has no local password,
so a local account (such as the first administrator) cannot be taken over through the identity
provider. To move a local account to SSO, tick "SSO only" for it under Administration, Users.
Keep one local administrator as a break-glass account.

## Security model

- **Secrets at rest**: passwords and TOTP seeds are encrypted with AES-256-GCM before they reach the
  database. The key lives only in the server environment. This protects a stolen database or backup;
  it does not protect against someone who controls the running server. Back the key up separately:
  without it the secrets are unrecoverable.
- **Secrets in transit to the browser**: never included in pages. A reveal is an explicit, audited
  server call that requires editor access.
- **Passwords**: scrypt (N=32768, r=8, p=3). Sign-in is throttled per email and address.
- **Sessions**: random 256 bit tokens, stored hashed, `HttpOnly` and `SameSite=Lax` cookies.
- **Authorization**: every organization page and action checks the caller's level on the server.
  Organizations a user cannot access respond with 404. Viewers can see items but not reveal shared
  secrets; they can use their own personal vault credential on devices set up for it.
- **Personal vaults**: only the owner can open their vault. Administrators cannot open, search or
  reveal another user's vault. Administrators can still see in the audit log that someone used
  their personal credential on a device (never the secret itself).
- **Markdown**: sanitised with DOMPurify before rendering.

Known limits of this first version: sign-in throttling is held in memory (per process), there is no
second factor for local accounts (use SSO with MFA at the identity provider), certificate checks run
on demand rather than on a schedule, and there are no expiry notifications yet.

## Design tokens

All colours, radii, fonts and shadows are CSS variables in `src/app/tokens.css`. That file is the
single place to apply the MunkiVault design system values.

## Project layout

```
src/db/schema.ts        Tables (Drizzle ORM)
src/lib/entities.ts     Field definitions for systems, credentials, certificates and documents
src/lib/store.ts        Create, update, delete and restore with version history
src/lib/folders.ts      Folders, folder paths and the navigation tree
src/lib/access.ts       Organization access checks and audit logging
src/lib/auth.ts         Sessions and sign-in throttling
src/lib/oidc.ts         OpenID Connect sign-in
src/lib/crypto.ts       Secret encryption, password hashing, TOTP
src/app/actions.ts      Server actions (all mutations)
src/app/(app)/          Signed-in pages
```

Moving an item between folders is recorded in the audit log but does not create a new version, since
it does not change the item itself.

Adding a field to an entry type is a column in `schema.ts`, a line in `entities.ts` and
`npm run db:generate`; forms, detail pages and history pick it up.

## Updating an existing install

```bash
git pull
```

```bash
npm install
```

```bash
npm run db:migrate
```

```bash
npm run build
```

Then restart with `npm start`. `db:migrate` reads `DATABASE_URL` from the shell, so export it first.

## Tests

```bash
npm test
```

```bash
npm run typecheck
```
