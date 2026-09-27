# MMBA Step 10: Deep Multi-Tenant & Production Readiness Audit Report

**Date:** 2026-09-24
**Status:** AUDIT ONLY — no implementation performed
**Repository:** MMBA Pro (Centralized JSON-file-store SaaS CRM)

---

## A. Executive Summary

MMBA is currently a **single-tenant, centralized application** operating as one monolithic deployment with a single JSON-file database (`data/mmba_production_database.json`). There is **no concept of a tenant, business, workspace, or organization** anywhere in the codebase — not in the database schema, not in the API routes, not in the frontend state, and not in the authentication system.

Every user, customer, financial record, chat thread, file, and notification lives in a **single global namespace**. The application assumes a one-server-one-business model. There is no `tenantId`, `businessId`, `companyId`, `organizationId`, or `workspaceId` field on any entity type. The entire system is owned by a single `usr-admin` super-admin account.

**Current tenant-readiness: NOT READY.** The system has zero multi-tenant isolation. Every resource is globally accessible by any authenticated user who knows an ID. There is no tenant boundary enforcement anywhere — not in middleware, not in route handlers, not in database queries, not in the frontend.

**Major risks:**
1. **Complete absence of tenant isolation** — all data is in one flat JSON store with no scoping
2. **Pervasive IDOR/BOLA vulnerabilities** — every `:id` endpoint resolves by raw ID with no ownership check
3. **Single point of failure** — one JSON file, one JWT secret, one database store
4. **No domain/hostname resolution** — no subdomain infrastructure exists
5. **Authorization is role-only** — no business membership check; an admin in one business could access any other business's data (if businesses existed)
6. **Frontend state is tenant-unaware** — localStorage/cache has no tenant boundary
7. **Storage is globally shared** — files have no tenant ownership
8. **Single JWT secret** — shared across the entire deployment, no per-tenant key material

**Whether the current foundation can reasonably evolve into the intended SaaS architecture:** YES, but the entire data layer, authentication model, authorization model, and API surface require fundamental restructuring. The JSON-file store must be replaced with a proper relational database that supports per-tenant schema or row-level security. The `User` model must be decomposed into `User → Membership → Tenant`. The authorization middleware must acquire tenant context before every database operation.

---

## B. Current Architecture

### B.1 Authentication

**File:** `server/auth.ts`
**File:** `server/routes.ts` (login endpoint)

- JWT-based authentication with HS256 algorithm
- Token lifetime: 24 hours
- Token revocation via `tokenVersion` field on `User` — bumping it invalidates all previous tokens
- Login accepts `usernameOrEmail` (supports username, email, or mobile)
- Password hashing: bcrypt (cost 10)
- Session revocation: `POST /auth/logout` and `POST /auth/sessions/revoke-all` both increment `tokenVersion`
- **No email verification** exists
- **No password reset flow** — only admin can reset password via `POST /users/:id/reset-password`
- **No concurrent session tracking** — `tokenVersion` invalidates all sessions globally
- JWT secret loaded from `JWT_SECRET` env var; server refuses to start if missing
- **Single JWT secret for the entire deployment** — no per-tenant key material

**What exists:** ✓ JWT issuance/validation, ✓ token revocation, ✓ bcrypt hashing, ✓ rate-limited login
**What is missing:** ✗ email verification, ✗ password reset self-service, ✗ concurrent session management, ✗ per-tenant identity, ✗ multi-tenant auth

### B.2 Authorization / RBAC

**File:** `src/lib/permissions.ts`
**File:** `server/routes.ts` (`requirePermission` middleware)

- Centralized RBAC via `hasPermission(user, module, action)` function
- Roles defined in `DEFAULT_ROLES` array in `src/lib/permissions.ts`
- 13 roles: GOD, OWNER, SUPERVISOR, ACCOUNTING_ADMIN, FINANCE_MANAGER, SALES, SALES_AGENT, STORE_OPERATIONS, TECHNICAL, REPAIR_TECHNICIAN, SUPER_ADMIN, TECHNICIAN, READ_ONLY
- Each role has `permissions: Permission[]` mapping `ModuleName` to `PermissionAction[]`
- `isAdmin(user)` checks if role is GOD, OWNER, or SUPER_ADMIN
- `requirePermission(module, action)` middleware guards every route
- **Authorization is checked per-route** — there is no centralized enforcement; each handler calls `requirePermission` explicitly
- **No business membership check** — authorization is purely role-based with no tenant context
- **No ownership check** — routes do not verify the user owns/has access to the specific resource being requested

**Critical finding:** `requirePermission` only checks if the user's role allows the action. It does NOT check if the user belongs to the same business/tenant as the target resource. Since no tenant concept exists, this is currently vacuously true for everything.

### B.3 Database

**File:** `server/db.ts` (`CentralDatabase` class)

- **Engine:** Custom in-memory JSON file store (no SQL, no ORM)
- **Storage:** Single file `data/mmba_production_database.json` (configurable via `DATABASE_PATH`)
- **Schema:** `CentralDatabaseSchema` interface containing ALL entities in one flat object
- **Persistence:** Write-queue serialized JSON writes with temp-file + rename atomicity
- **No migrations** — version/revision tracking but no migration system
- **No foreign keys** — no relational constraints; all references are by string ID
- **No indexes** — all queries are `Array.find()` / `Array.filter()` linear scans
- **No soft deletion** — `delete*()` methods remove from array entirely
- **Audit fields:** `createdAt`, `updatedAt` on most entities; no `deletedAt`
- **Single global store** — all tenants would share this one file

**Entity list (all global, no tenant scoping):**
- `users`, `roles`, `customers`, `leads`, `calls`, `interactions`, `voiceNotes`, `tasks`, `contracts`, `payments`, `checks`, `sims`, `repairs`, `attachments`, `accounts`, `journalEntries`, `journalEntryLines`, `accountingPeriods`, `documentShares`, `conversations`, `chatMessages`, `broadcasts`, `broadcastRecipients`, `messageAttachments`, `registeredHolders`, `contractInstallments`, `trustedBiometricDevices`, `notifications`, `userNotificationDevices`, `notificationDeliveries`, `notificationSettings`, `auditLogs`, `dateSuggestions`, `sharedLinks`, `problemReports`, `settings`

**Every entity above is stored in a single global array with no tenant field.** There is no `tenantId` on any type in `src/types/index.ts`.

### B.4 API

**File:** `server/routes.ts`

- Express router mounted at `/api/v1` and `/api`
- All routes protected by `requireAuth` middleware (except `/auth/login`, `/auth/biometric-*`, `/health`, `/healthz`, `/readyz`)
- `requireAuth` extracts user from `Authorization: Bearer <token>` header or `?token=` query param
- `requirePermission(module, action)` guards every CRUD route
- **No tenant context** — `req` has no `tenantId`, `businessId`, or similar
- **No ownership scoping** — every `GET /:id`, `PUT /:id`, `DELETE /:id` resolves by raw ID against the global store
- **No route-level tenant validation**

**Key vulnerability pattern — every IDOR-prone route:**
```ts
apiRouter.get('/customers/:id', requirePermission(...), (req, res) => {
  const customer = centralDb.getState().customers.find((c) => c.id === req.params.id);
  // NO ownership/tenant check — any authenticated user can access any customer by ID
});
```

Same pattern exists for: `/leads/:id`, `/calls/:id`, `/interactions/:id`, `/tasks/:id`, `/contracts/:id`, `/payments/:id`, `/checks/:id`, `/sims/:id`, `/repairs/:id`, `/attachments/:id`, `/voice-notes/:id`, `/users/:id`.

### B.5 Frontend

**File:** `src/services/storage.ts` (`CentralStorageService`)
**File:** `src/auth.ts`
**File:** `src/services/api.ts`

- **State management:** CentralStorageService with in-memory cache + localStorage snapshot
- **Auth token:** Stored in `localStorage.getItem('mmba_auth_token')` — **NOT HttpOnly, NOT secure**
- **Session state:** `sessionStorage.getItem('mmba_session_active')`, `localStorage.getItem('mmba_is_logged_in')`
- **Active user:** `localStorage.getItem('mmba_active_user')`
- **Cache snapshot:** `localStorage.getItem('mmba_central_cache_snapshot')` — contains ALL entities for all users
- **No tenant context** — no tenant ID in any localStorage key or in-memory state
- **Cross-tab sync:** `storage` event listener for typing events
- **Background sync:** Polls `/api/sync/version` every 3.5 seconds, full sync on revision mismatch
- **Route guards:** Not implemented in the frontend routing (no protected routes that check tenant membership)
- **API calls:** No tenant ID sent in headers or body — all requests are global

**Critical finding:** `localStorage` contains the full application state snapshot for ALL users. Any user who can access the browser can see all customers, payments, accounting records, etc. There is no tenant-based cache partitioning.

### B.6 Storage / Files

**File:** `server/routes.ts` (attachments endpoints)
**File:** `src/lib/fileUtils.ts` (if exists)

- **Physical storage:** Files stored as base64 `dataUrl` in the JSON database (in `attachments[].dataUrl`, `voiceNotes[].audioDataUrl`)
- **No file system storage** — everything is embedded in the JSON blob
- **No tenant-based path structure** — files are keyed by ID only
- **No signed URLs** — attachment content served directly by API
- **No upload authorization beyond role check** — any user with `CREATE` permission on `CUSTOMERS` module can upload
- **SVG handling:** SVGs served as `attachment` disposition to prevent XSS
- **MIME validation:** Magic bytes sniffing + extension mapping

**Cross-tenant file risk:** Any authenticated user can `GET /attachments/:id` and retrieve any attachment by ID, regardless of which customer it belongs to. The same applies to voice notes.

### B.7 Chat & Messaging

**File:** `server/db.ts` (chat operations)
**File:** `src/types/index.ts` (`ChatConversation`, `ChatMessage`, `ChatMemberRole`)

- **Conversation types:** `ONE_TO_ONE`, `GROUP`, `BROADCAST`
- **ChatMemberRole:** `MEMBER`, `ADMIN`, `OWNER`
- **No tenant scoping** — conversations have no `tenantId` or `businessId`
- **No participant ownership check** — any user can manipulate any conversation ID
- **Participants:** Stored as `conversationMembers` with `ChatMemberRole`
- **Messages:** Global array, indexed by `conversationId`
- **Broadcasts:** Global array with `BroadcastRecipient` records

**Cross-tenant chat risk:** A user can access any conversation by ID, read any message, send to any thread. No ownership verification exists.

### B.8 Push Notifications

**File:** `server/webPushService.ts`
**File:** `server/notificationScheduler.ts`
**File:** `server/db.ts` (device management)

- **VAPID keys:** Generated or loaded from `./data/vapid_keys.json` or env vars
- **Device storage:** `userNotificationDevices` array in global DB — scoped by `userId` only
- **No tenant scoping** — push subscriptions have no tenant association
- **Notification dispatch:** `Notification` objects have `userId` but no `tenantId`
- **Delivery tracking:** `notificationDeliveries` array indexed by `notificationId` and `userId`

**Cross-tenant notification risk:** A user could potentially subscribe with another user's endpoint or access another user's notification subscriptions.

### B.9 Accounting / Finance

**File:** `server/db.ts` (accounting operations)
**File:** `src/types/index.ts` (`Account`, `JournalEntry`, `JournalEntryLine`, `AccountingPeriod`, `Payment`, `Check`)

- **Chart of accounts:** `DEFAULT_SEED_ACCOUNTS` (13 accounts) — single global chart
- **Journal entries:** Global array, no tenant scoping
- **Accounting periods:** `DEFAULT_SEED_PERIODS` (2 periods for Iranian calendar years 1403, 1404) — global
- **Payments/Checks:** Global arrays, no business association
- **Double-entry validation:** Enforced at save time (debit = credit)
- **No tenant isolation** — all financial records are in one global store

**Critical finding:** Financial reports aggregate ALL data. In a multi-tenant deployment, financial summaries would leak other tenants' data unless scoped.

### B.10 Deployment

**File:** `server.ts`
**File:** `server/prodHelpers.ts`
**File:** `.env.example`

- **Runtime:** Express.js on Node.js, served via Vite build or tsx dev
- **Reverse proxy:** Expected but not configured; `TRUST_PROXY` env var controls `app.set('trust proxy', 1)`
- **HTTPS:** Not terminated in-app; HSTS deliberately not set (deployment layer responsibility)
- **CORS:** Configurable via `ALLOWED_ORIGINS` env var; defaults to localhost in dev
- **Rate limiting:** Three tiers — auth (10/5min), general (600/15min), sensitive (30/10min)
- **Request IDs:** `crypto.randomUUID()` per request, echoed in `X-Request-Id` header
- **Structured logging:** JSON-ish console logs with request IDs
- **Graceful shutdown:** SIGTERM/SIGINT handlers with 15s timeout
- **Health endpoints:** `/health`, `/healthz`, `/readyz`
- **Single process, single instance** — no clustering, no horizontal scaling
- **Single JWT secret** for the entire deployment
- **No multi-tenant configuration** — no tenant registry, no domain mapping, no subdomain handling

---

## C. Tenant Isolation Matrix

| Resource | Current Scope | Enforcement | Cross-Tenant Risk | Recommended Future Scope |
|---|---|---|---|---|
| **Users** | Global single array | None (single `usr-admin`) | CRITICAL — all users in one flat list | `User` record belongs to `Tenant` via `TenantMembership` |
| **Customers** | Global array, no owner field | None — `find(c => c.id === id)` | CRITICAL — any user accesses any customer by ID | Scoped to `Tenant` via `customer.tenantId`; query must filter by tenant |
| **Leads** | Global array, no owner field | None | CRITICAL — any user accesses any lead by ID | Scoped to `Tenant` via `lead.tenantId` |
| **Calls** | Global array, no owner field | None | CRITICAL | Scoped to `Tenant` |
| **Interactions** | Global array, filtered by `customerId`/`leadId` | None — ID-based only | CRITICAL | Scoped to `Tenant` |
| **Voice Notes** | Global array | None | CRITICAL | Scoped to `Tenant`; ownership via `createdById` |
| **Tasks** | Global array | None — `canViewTask` checks creator/assignee but NOT tenant | HIGH — task visible to any user who knows the ID | Scoped to `Tenant` |
| **Contracts** | Global array | None | CRITICAL | Scoped to `Tenant` |
| **Payments** | Global array | None | CRITICAL — financial data globally visible | Scoped to `Tenant`; accounting scoped to tenant |
| **Checks** | Global array | None | CRITICAL | Scoped to `Tenant` |
| **Accounts** | Global chart (13 default accounts) | None | CRITICAL — single global chart of accounts | Per-tenant chart of accounts |
| **Journal Entries** | Global array | None | CRITICAL — financial data globally visible | Scoped to `Tenant` |
| **Attachments** | Global array, `customerId` optional | None — `GET /attachments/:id` by raw ID | CRITICAL — any user downloads any attachment | Scoped to `Tenant`; access check on `customerId` |
| **Chat Conversations** | Global array | None — ID-based access | CRITICAL — any user reads any conversation | Scoped to `Tenant` via participant membership |
| **Chat Messages** | Global array, indexed by `conversationId` | None | CRITICAL | Scoped to `Tenant` |
| **Notifications** | Global array, `userId` field | None — any user can access any notification by ID | HIGH | Scoped to `Tenant` and `userId` |
| **Push Subscriptions** | Global array, `userId` field | None | HIGH — subscription ownership not verified | Scoped to `TenantMembership` chain |
| **Audit Logs** | Global array | None | HIGH — all audit logs in one flat list | Scoped to `Tenant`; platform admins see all |
| **Settings** | Single global `settings` object | None | CRITICAL — one config for entire deployment | Per-tenant settings |
| **Roles** | Global `roles` array | None | HIGH — role definitions are global | Global role catalog + per-tenant role assignments |
| **Reports** | Generated from global data | None | CRITICAL — reports combine all data | Scoped to `Tenant` |
| **Date Suggestions** | Global array, `customerId` filter | None | MEDIUM | Scoped to `Tenant` |
| **Shareable Links** | Global array | None — token-based, no tenant check | MEDIUM | Scoped to `Tenant` |
| **Problem Reports** | Global array | None | MEDIUM | Scoped to `Tenant` |
| **Registered Holders** | Global array | None | HIGH | Scoped to `Tenant` |
| **Contract Installments** | Global array | None | HIGH | Scoped to `Tenant` |
| **Trusted Biometric Devices** | Global array | None | HIGH | Scoped to `Tenant` and `userId` |
| **Document Shares** | Global array | None | HIGH | Scoped to `Tenant` |
| **Accounting Periods** | Global array (2 default periods) | None | CRITICAL — single global period set | Per-tenant accounting periods |

---

## D. Authorization Matrix

| Area | Public | Authenticated | Tenant Member | Tenant Admin | Tenant Owner | Platform Admin |
|---|---|---|---|---|---|---|
| **Login** | ✓ | — | — | — | — | — |
| **Auth/Me** | — | ✓ | ✓ | ✓ | ✓ | ✓ |
| **Profile Update** | — | ✓ (self) | ✓ (self) | ✓ (self/team) | ✓ | ✓ |
| **Password Change** | — | ✓ (self + current pwd) | ✓ | ✓ | ✓ | ✓ |
| **Customer List** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Customer Detail** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Customer Create** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Customer Edit** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Customer Delete** | — | Role-gated | ✗ | ✓ | ✓ | ✓ |
| **Financial Records** | — | Role-gated | ✗ | ✓ | ✓ | ✓ |
| **Accounting** | — | Role-gated | ✗ | ACCOUNTING_ADMIN | ✓ | ✓ |
| **Chat** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Users Management** | — | Role-gated | ✗ | ADMIN_ONLY | ✓ | ✓ |
| **Audit Logs** | — | Role-gated | ✗ | ✗ | ✓ | SUPER_ADMIN |
| **Settings** | — | Role-gated | ✗ | VIEW | ✓ | ✓ |
| **Attachments** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Reports** | — | Role-gated | Role-gated | ✓ | ✓ | ✓ |
| **Notifications** | — | ✓ (self) | ✓ (self) | ✓ (team) | ✓ | ✓ |
| **Push Subscriptions** | — | ✓ (self) | ✓ (self) | — | — | — |
| **Tenant Admin Panel** | — | — | — | — | — | PLATFORM_ADMIN |

**Current state:** All "Tenant Member/Admin/Owner" cells currently collapse to "Role-gated" because there is no tenant concept. The distinction between platform admin and tenant admin does not exist. `isAdmin()` returns true for GOD, OWNER, and SUPER_ADMIN — these are effectively platform-level roles today but would need to be split into platform-admin vs. tenant-owner/admin in the multi-tenant model.

---

## E. API Route Matrix

### E.1 Auth Routes

| Route | Method | Current Auth | Current AuthZ | Tenant-Sensitive | IDOR/BOLA Risk | Recommended Level |
|---|---|---|---|---|---|---|
| `/auth/login` | POST | None | Rate-limited | No | Low | PUBLIC |
| `/auth/me` | GET | Bearer token | `getAuthUser` | No | Low | AUTHENTICATED |
| `/auth/profile` | PUT | Bearer token | `getAuthUser` + role | No | Medium | AUTHENTICATED |
| `/auth/password` | PUT | Bearer token | `getAuthUser` + role | No | Medium | AUTHENTICATED |
| `/auth/logout` | POST | Bearer token | `getAuthUser` | No | Low | AUTHENTICATED |
| `/auth/sessions/revoke-all` | POST | Bearer token | `getAuthUser` | No | Low | AUTHENTICATED |
| `/auth/biometric-challenge` | POST | None | Rate-limited | No | Low | PUBLIC |
| `/auth/biometric-login` | POST | None | Rate-limited | No | Low | PUBLIC |

### E.2 CRM Routes

| Route | Method | Current Auth | Current AuthZ | Tenant-Sensitive | IDOR/BOLA Risk | Recommended Level |
|---|---|---|---|---|---|---|
| `/customers` | GET | Bearer | `requirePermission(CUSTOMERS, VIEW)` | **YES** | **CRITICAL** | TENANT_MEMBER (scoped) |
| `/customers/:id` | GET | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/customers` | POST | Bearer | `requirePermission(CUSTOMERS, CREATE)` | **YES** | **HIGH** | TENANT_MEMBER |
| `/customers/:id` | PUT | Bearer | `requirePermission(CUSTOMERS, EDIT)` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/customers/:id` | DELETE | Bearer | `requirePermission(CUSTOMERS, ARCHIVE)` | **YES** | **CRITICAL** | TENANT_ADMIN |
| `/customers/bulk-delete` | POST | Bearer | `requirePermission + sensitiveLimiter` | **YES** | **CRITICAL** | TENANT_ADMIN |
| `/leads` | GET | Bearer | `requirePermission(LEADS, VIEW)` | **YES** | **CRITICAL** | TENANT_MEMBER (scoped) |
| `/leads/:id` | GET | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/leads/:id/convert` | POST | Bearer | `requirePermission(CUSTOMERS, CREATE)` | **YES** | **HIGH** | TENANT_MEMBER |
| `/contacts/lookup` | GET | Bearer | None (no auth check!) | **YES** | **CRITICAL** | AUTHENTICATED |

**Critical finding:** `/contacts/lookup` has NO `requireAuth` or `requirePermission` middleware. Any request with a valid token (or even without one, since `requireAuth` is applied at router level but this endpoint's path might bypass) can search all customers and leads. The `requireAuth` middleware IS applied at `apiRouter.use(requireAuth)` level, so this endpoint IS authenticated — but it has no `requirePermission` check and returns ALL matching data regardless of business ownership.

### E.3 Financial Routes

| Route | Method | Current Auth | Current AuthZ | Tenant-Sensitive | IDOR/BOLA Risk | Recommended Level |
|---|---|---|---|---|---|---|
| `/payments` | GET | Bearer | `requirePermission(PAYMENTS, VIEW)` | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/payments/:id` | GET | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/payments` | POST | Bearer | `requirePermission` | **YES** | **HIGH** | TENANT_MEMBER |
| `/accounts` | GET | Bearer | None visible | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/journal-entries` | GET | Bearer | None visible | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/checks` | GET/POST/PUT/DELETE | Bearer | `requirePermission(CHECKS, ...)` | **YES** | **CRITICAL** | TENANT_MEMBER |

### E.4 Communication Routes

| Route | Method | Current Auth | Current AuthZ | Tenant-Sensitive | IDOR/BOLA Risk | Recommended Level |
|---|---|---|---|---|---|---|
| `/voice-notes` | GET | Bearer | `requirePermission(NOTES, VIEW)` | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/voice-notes/:id` | GET | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/voice-notes/:id/audio` | GET | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/voice-notes/:id` | DELETE | Bearer | `requirePermission + owner-or-admin` | **YES** | **CRITICAL** | TENANT_MEMBER (ownership) |
| `/conversations` (chat) | GET/POST | Bearer | None visible in routes.ts | **YES** | **CRITICAL** | TENANT_MEMBER |
| `/chat-messages` | GET/POST | Bearer | None visible | **YES** | **CRITICAL** | TENANT_MEMBER |

**Critical finding:** Chat routes (`/conversations`, `/chat-messages`, `/broadcasts`) do NOT appear to have `requirePermission` middleware in `routes.ts`. They are likely protected by the `requireAuth` router-level middleware only, meaning any authenticated user can access any conversation or message.

### E.5 Admin Routes

| Route | Method | Current Auth | Current AuthZ | Tenant-Sensitive | IDOR/BOLA Risk | Recommended Level |
|---|---|---|---|---|---|---|
| `/users` | GET/POST/PUT/DELETE | Bearer | `requirePermission(USERS, ...)` + `isAdmin` | **YES** | **CRITICAL** | PLATFORM_ADMIN |
| `/users/:id/reset-password` | POST | Bearer | `requirePermission + isAdmin` | **YES** | **HIGH** | PLATFORM_ADMIN |
| `/roles` | GET/POST | Bearer | `requirePermission` | **YES** | **HIGH** | PLATFORM_ADMIN |
| `/audit-logs` | GET | Bearer | None visible | **YES** | **HIGH** | PLATFORM_ADMIN |
| `/settings` | GET/PUT | Bearer | `requirePermission` | **YES** | **CRITICAL** | TENANT_OWNER |

---

## F. Database Findings

### F.1 Tenant-Sensitive Tables (all currently global)

Every table in `CentralDatabaseSchema` is a flat global array. No table has a `tenantId` field.

### F.2 Missing Foreign Keys

- **All relationships are string-ID references with no FK constraints.** For example:
  - `customerId` on `interactions`, `tasks`, `contracts`, `payments`, `calls` references `customers.id` but there is no constraint
  - `journal_entry_id` on `journalEntryLines` references `journalEntries.id` — no constraint
  - `account_id` on `journalEntryLines` references `accounts.id` — no constraint
  - `conversationId` on `chatMessages` references `conversations.id` — no constraint
  - `leadId` on `customers` references `leads.id` — no constraint
- **No cascade delete behavior defined** — child records become orphaned when parent is deleted

### F.3 Missing Indexes

- **All queries are O(n) linear scans.** There are no indexes on any field.
- Critical missing indexes: `customers[mobile]`, `customers[phone]`, `leads[mobile]`, `users[username]`, `users[email]`, `users[mobile]`, `payments[customerId]`, `journalEntries[entry_number]`, `conversations[id]`, `attachments[customerId]`
- The `findUserByCredential` method does a full `Array.find()` scan on every login

### F.4 Uniqueness Issues

Currently globally unique fields that would need to become per-tenant unique:
- `users[username]` — currently checked globally
- `customers[code]` (e.g., `CUST-1041`) — currently sequential global counter
- `leads[leadCode]` (e.g., `LEAD-1001`) — currently sequential global counter
- `accounts[code]` (e.g., `101`) — currently fixed default accounts
- `journalEntries[entry_number]` — currently global sequential counter
- `invoiceNumber` (if used) — would need per-tenant uniqueness
- `phone`/`mobile` on customers — currently checked globally for duplicates
- `slug` (if introduced for tenants) — would need per-tenant uniqueness

### F.5 Cascade Issues

- **No cascade delete.** Deleting a customer leaves orphaned interactions, tasks, contracts, payments, calls, attachments, voice notes, date suggestions
- **No cascade delete.** Deleting a lead leaves orphaned interactions, tasks
- **No cascade delete.** Deleting a user leaves orphaned audit log entries (referencing `userId`)
- **No cascade delete.** Deleting an account (if deleted) leaves orphaned journal entry lines

### F.6 Migration Concerns

- **No migration system exists.** The `CentralDatabaseSchema` has `version` and `revision` fields but no migration runner
- **Schema changes require manual JSON transformation** — adding a `tenantId` field to every record would require a full database rewrite
- **No backup-restore with schema version tracking** — `backupService.ts` backs up the raw JSON but doesn't track schema version
- **Data type inconsistencies:** Fields like `customerId`/`customer_id`, `leadId`/`lead_id`, `userId`/`user_id`, `interactionType`/`interaction_type` have camelCase and snake_case variants — no normalization convention

---

## G. Storage Findings

### G.1 File Ownership

- Files are stored as base64 `dataUrl` strings inside the JSON database
- `Attachment` records have optional `customerId` and `customerName` fields
- `VoiceNote` records have optional `customerId` and `relatedEntityId` fields
- **No physical file system storage** — everything is in the JSON blob
- **No separate storage service** — files are inseparable from the database

### G.2 Storage Layout

- **Current:** `data/mmba_production_database.json` contains all data including file content
- **No tenant-aware directory structure** exists
- **No object storage integration** — no S3, MinIO, or similar
- **No signed URLs** — attachments served directly by API

### G.3 Download Authorization

**File:** `server/routes.ts` (`/attachments/:id/content` and `/attachments/:id/preview`)

```ts
const att = centralDb.getState().attachments.find((a) => a.id === req.params.id);
if (!att) return res.status(404).json({ success: false, message: 'فایل پیوست یافت نشد.' });
// No ownership check — any authenticated user with VIEW permission can download any attachment
```

**CRITICAL:** No verification that the requesting user has access to the customer/entity the attachment belongs to. Any authenticated user can download any attachment by guessing the ID.

### G.4 Upload Authorization

**File:** `server/routes.ts` (`POST /attachments`)

```ts
apiRouter.post('/attachments', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE), async (req: Request, res: Response) => {
  const att: Attachment = req.body;
  const saved = await centralDb.saveAttachment(att);
  // No tenant context attached; no business verification
});
```

**CRITICAL:** The uploaded attachment is stored globally with no `tenantId`. The `customerId` in the request body is trusted as-is — a malicious client could set any `customerId`.

### G.5 Cross-Tenant Storage Risk

**Attack scenario:** User A (Tenant A) guesses `attachment-id-xyz` → `GET /attachments/attachment-id-xyz/content` → retrieves Tenant B's confidential document. The server checks only that the user is authenticated and has `VIEW` permission on `CUSTOMERS` module — it never checks if the attachment belongs to a customer the user has access to.

### G.6 Future Tenant-Aware Storage Design

Recommended layout:
```
storage/
├── tenants/
│   ├── {tenantId}/
│   │   ├── attachments/
│   │   │   ├── {attachmentId}/
│   │   │   │   ├── file.{ext}
│   │   │   │   └── metadata.json
│   │   │   └── index.json
│   │   ├── voice-notes/
│   │   ├── exports/
│   │   └── avatars/
```

Or, for object storage:
```
s3://mmba-storage/{tenantId}/attachments/{attachmentId}/
s3://mmba-storage/{tenantId}/voice-notes/{voiceNoteId}/
```

With signed URLs for download access, scoped to the user's tenant membership.

---

## H. Security Findings

### H.1 CRITICAL: Complete Absence of Tenant Isolation

**File:** `server/db.ts`, `server/routes.ts`, `src/types/index.ts`
**Evidence:** No `tenantId`, `businessId`, `companyId`, or similar field exists on any entity type. All database queries resolve by raw ID against global arrays.
**Why it matters:** In a multi-tenant deployment, every data query returns ALL tenants' data. Any user can access any other tenant's customers, financial records, chat messages, files, and audit logs by simply knowing an ID.
**Recommended fix:** Introduce `Tenant` and `TenantMembership` entities; add `tenantId` to every tenant-sensitive table; enforce tenant scoping in every database query.
**Implementation phase:** Step 10 — Multi-Tenant Architecture Foundation

### H.2 CRITICAL: Pervasive IDOR/BOLA in Every ID-Based Endpoint

**File:** `server/routes.ts` — ALL `/:id` endpoints
**Evidence:** Every `GET /customers/:id`, `GET /leads/:id`, `GET /payments/:id`, `GET /attachments/:id`, `GET /voice-notes/:id`, `GET /contracts/:id`, `GET /checks/:id`, `GET /sims/:id`, `GET /repairs/:id`, `GET /tasks/:id`, `GET /interactions/:id` resolves by raw `req.params.id` against the global array with no ownership or tenant check.
**Why it matters:** Any authenticated user can access any record by guessing its ID. There is no access control boundary between resources.
**Recommended fix:** Add ownership verification middleware that checks the requesting user's `TenantMembership` and filters by `tenantId` before resolving the resource. For resources that don't yet have `tenantId`, verify the user's business membership before allowing access.
**Implementation phase:** Step 10 — Tenant Isolation Layer

### H.3 CRITICAL: Trust Client-Provided `customerId` in Attachment Upload

**File:** `server/routes.ts` (`POST /attachments`)
**Evidence:** The `Attachment` object from `req.body` is passed directly to `centralDb.saveAttachment(att)` without verifying the `customerId` belongs to a customer the authenticated user can access.
**Why it matters:** A malicious client can upload an attachment and set `customerId` to any customer ID, effectively planting files in other businesses' records.
**Recommended fix:** Server must resolve the `customerId` from the authenticated user's business membership, not from client input. If `customerId` is in the request, verify the user has access to that customer.
**Implementation phase:** Step 10 — Authorization Enforcement

### H.4 HIGH: No Ownership Check on Voice Note Edit

**File:** `server/routes.ts` (`PUT /voice-notes/:id`)
**Evidence:** The only check is `authUser.id === existing.createdById || isAdmin(authUser)`. No tenant/tenantId verification.
**Why it matters:** In a multi-tenant deployment, a user from Tenant A could edit a voice note created by a user in Tenant B if they happen to know the voice note's ID and the voice note has no `tenantId`.
**Recommended fix:** Add `tenantId` to voice notes; verify `voiceNote.tenantId === user.tenantId` in addition to ownership.
**Implementation phase:** Step 10

### H.5 HIGH: No Ownership Check on Task Access

**File:** `src/lib/permissions.ts` (`canViewTask`, `canExecuteTask`, `canShareTask`)
**Evidence:** Task visibility checks creator, assignee, and shared users — but no `tenantId` or business membership check. `isAdmin(user)` returns true for any user with GOD/OWNER/SUPER_ADMIN role globally.
**Why it matters:** A platform admin can see all tasks across all businesses. In a multi-tenant model, tenant admins should only see their own tenants' tasks.
**Recommended fix:** Add `tenantId` to tasks; add tenant membership check to all task visibility functions; split `isAdmin` into platform-admin and tenant-admin checks.
**Implementation phase:** Step 10

### H.6 HIGH: Chat Messages Accessible by ID Guess

**File:** `server/db.ts` (`findInteractionById`), `server/routes.ts`
**Evidence:** No `requirePermission` check visible for chat/message endpoints. Messages and conversations have no `tenantId`. Any authenticated user can access any conversation by ID.
**Why it matters:** Business A's sensitive customer conversations could be accessed by Business B's employees by guessing conversation IDs.
**Recommended fix:** Add `tenantId` to `ChatConversation` and `ChatMessage`; verify participant membership in the conversation; enforce tenant scoping on all chat queries.
**Implementation phase:** Step 10 — Chat Isolation

### H.7 HIGH: Global Audit Logs Contain All Tenants' Data

**File:** `server/db.ts` (`logAudit`), `server/routes.ts`
**Evidence:** `auditLogs` is a single global array. Every audit log entry records `userId`, `userName`, `userRole`, `action`, `module`, `targetId`, `targetType`, `ipAddress`.
**Why it matters:** In a multi-tenant deployment, tenant admins could see audit logs from other tenants, leaking business activities, user actions, and potentially sensitive operational data.
**Recommended fix:** Scoping audit logs to `tenantId`; platform-level audit log viewer for platform admins only.
**Implementation phase:** Step 10

### H.8 MEDIUM: No Host Header Validation

**File:** `server.ts`
**Evidence:** Express app does not validate the `Host` header. No `hostname` parsing or tenant resolution middleware exists.
**Why it matters:** Without hostname validation, the application is vulnerable to host-header injection attacks, DNS rebinding, and subdomain takeover. A malicious actor could register a similar subdomain and serve content from the same origin.
**Recommended fix:** Add hostname validation middleware; whitelist allowed hostnames; reject requests with unexpected `Host` headers; implement tenant resolution based on hostname.
**Implementation phase:** Step 11 — Tenant Domains

### H.9 MEDIUM: No CSRF Protection for Cookie-Based Auth Migration

**File:** `src/services/api.ts`
**Evidence:** Code comment acknowledges CSRF is not the live risk because auth uses `Authorization: Bearer` header, not cookies. Explicitly notes: "FUTURE ARCHITECTURAL RULE: if auth is ever migrated to cookies (HttpOnly), REVISIT this CSRF decision BEFORE the migration."
**Why it matters:** If the architecture evolves to use cookies for session management (e.g., for custom domain support), CSRF protection becomes mandatory.
**Recommended fix:** When implementing cookie-based auth (for custom domains), add CSRF tokens with SameSite cookies and anti-CSRF headers.
**Implementation phase:** Step 11 (if custom domains require cookie-based auth)

### H.10 MEDIUM: localStorage Contains Sensitive Application State

**File:** `src/services/storage.ts` (`saveLocalCacheSnapshot`)
**Evidence:** `localStorage.setItem('mmba_central_cache_snapshot', JSON.stringify(safeSnapshot))` stores ALL entities including customers, payments, financial records, audit logs, and notifications. `localStorage.setItem('mmba_active_user', JSON.stringify(this.currentUser))` stores the user object.
**Why it matters:** XSS attacks can exfiltrate all application data from localStorage. In a multi-tenant deployment, cached data from one tenant could persist when another tenant's user logs in.
**Recommended fix:** Implement cache invalidation on logout; tenant-aware cache keys; consider IndexedDB with per-tenant namespaces; avoid storing financial data in client-side cache; add Content Security Policy to mitigate XSS.
**Implementation phase:** Step 10 — Frontend Tenant Boundary

### H.11 MEDIUM: Single JWT Secret for Entire Deployment

**File:** `server/auth.ts` (`getJwtSecret`)
**Evidence:** `JWT_SECRET` is a single environment variable used for all token signing and verification. No per-tenant or per-user key material.
**Why it matters:** If the JWT secret is compromised, ALL tokens for ALL tenants are compromised. There is no isolation boundary.
**Recommended fix:** Consider per-tenant JWT key material or at minimum a key rotation mechanism with tenant-scoped token validation. In the multi-tenant model, tenant administrators should not be able to forge tokens for other tenants.
**Implementation phase:** Step 10 — Authentication Identity Layer

### H.12 MEDIUM: No Concurrent Session Management

**File:** `server/auth.ts`, `server/routes.ts` (`/auth/logout`, `/auth/sessions/revoke-all`)
**Evidence:** `tokenVersion` invalidates ALL sessions globally when bumped. No tracking of individual active sessions, no per-device session management, no ability to revoke a single device.
**Why it matters:** In a multi-tenant deployment, a tenant admin should be able to revoke sessions for their own tenants' users without affecting other tenants.
**Recommended fix:** Implement per-device session tokens; add session registry; allow individual session revocation; scope session management to `tenantId`.
**Implementation phase:** Step 10 — Session Management

### H.13 LOW: No Rate Limiting on Tenant Resolution Endpoints

**File:** `server/security.ts`
**Evidence:** Rate limiting exists per-IP and per-account for auth, and per-IP for general API. No rate limiting specifically for tenant resolution or hostname-based endpoints (which don't exist yet).
**Why it matters:** When tenant domain resolution is implemented, without rate limiting on resolution endpoints, an attacker could enumerate valid tenant hostnames.
**Recommended fix:** Add rate limiting to tenant resolution middleware; monitor for abnormal hostname resolution patterns.
**Implementation phase:** Step 11

### H.14 LOW: Debug/Development Configuration in Production Code

**File:** `server.ts` (dev mode Vite middleware), `server/security.ts` (dev CSP relaxation)
**Evidence:** `if (process.env.NODE_ENV !== 'production')` branch mounts Vite dev middleware. Security headers relax CSP for `'unsafe-inline'` and `ws:` in development.
**Why it matters:** If `NODE_ENV` is accidentally set to `development` in production, the Vite dev server and relaxed CSP become active, exposing the application to XSS and debug access.
**Recommended fix:** Ensure `NODE_ENV=production` is enforced in production deployment; add startup validation that rejects `NODE_ENV=development` when `TRUST_PROXY=true` or when binding to `0.0.0.0`.
**Implementation phase:** Step 9 (already partially addressed) / Step 17

---

## I. Production Readiness Findings

### I.1 HTTPS
- **Not verifiable from source alone.** The repository has no TLS configuration, no nginx/caddy/docker config, no SSL certificate management.
- `securityHeaders` explicitly does NOT set `Strict-Transport-Security` — "HSTS deliberately NOT set: no TLS termination point is visible in the repository."
- **Recommendation:** TLS termination must be configured at the reverse proxy layer. HSTS should be enabled there.

### I.2 Reverse Proxy
- **Expected but not configured.** The application assumes a reverse proxy exists (Express `trust proxy` setting).
- `TRUST_PROXY` env var controls `app.set('trust proxy', 1)`.
- **No nginx/caddy/traefik configuration files exist in the repository.**
- `resolveAllowedOrigins()` in `prodHelpers.ts` expects `ALLOWED_ORIGINS` to be set explicitly in production.

### I.3 CORS
- **Configurable via `ALLOWED_ORIGINS` env var.** Defaults to localhost in development.
- In production, falls back to `panel.mobilemeisam.ir` and `panel.johannapage.website` if `APP_URL` is set.
- **No wildcard CORS** — explicit origin allowlist is enforced.
- **Future multi-tenant concern:** Each tenant will have its own frontend origin. The `ALLOWED_ORIGINS` list must be extensible per tenant.

### I.4 CSRF
- **Not applicable currently** (Bearer token auth, not cookies). Code explicitly acknowledges this and notes it must be revisited if cookies are introduced.
- **Future concern:** Custom domain support may require cookie-based auth for SSO or embedded widgets, which would require CSRF protection.

### I.5 Authentication
- **JWT with Bearer token** — not cookie-based.
- **Token stored in localStorage** — vulnerable to XSS.
- **No refresh token mechanism** — 24-hour token lifetime with no silent renewal.
- **No email verification** — account creation/registration flow not present.
- **No password reset self-service** — admin-only password reset.
- **Token revocation via `tokenVersion`** — works but invalidates ALL sessions globally.

### I.6 Authorization
- **Role-based only** — no ownership or business membership check.
- **Per-route enforcement** — no centralized authorization pipeline.
- **No resource-level authorization** — `canViewTask` is the only function with creator/assignee logic, and it has no tenant check.

### I.7 Rate Limits
- **Three tiers implemented:** Auth (10/5min per IP+account), General (600/15min per IP), Sensitive (30/10min).
- **In-memory sliding window** — does not survive restarts, does not work across processes.
- **No distributed rate limiting** — single-process assumption.

### I.8 Security Headers
- **CSP configured** — strict in production, relaxed in dev.
- **X-Frame-Options: DENY**, **X-Content-Type-Options: nosniff**, **Referrer-Policy: strict-origin-when-cross-origin**.
- **Permissions-Policy** — restricts camera, microphone, geolocation, etc.
- **worker-src 'self'** — service workers must be same-origin.
- **HSTS not set** — must be configured at deployment layer.

### I.9 Logging
- **Structured JSON-ish console logging** via `structuredLog()`.
- **Request IDs** via `loggerMiddleware` — every request gets a `crypto.randomUUID()`.
- **Error logging** — `finalErrorHandler` logs full error details server-side, safe message client-side.
- **No log aggregation** — no ELK, Splunk, or similar integration.
- **Audit logs stored in JSON** — `auditLogs` array in central DB, capped at 2000 entries.

### I.10 Monitoring
- **Health endpoints:** `/health`, `/healthz`, `/readyz` — liveness, readiness, and revision info.
- **No uptime monitoring integration** — no Pingdom, Datadog, or similar.
- **No alerting** — no configured alerts for error rates, latency, storage capacity.
- **No metrics** — no request latency histograms, error counters, or business metrics.

### I.11 Backups
- **`backupService.ts` exists** — full database backup to `./data/backups/`.
- **Backup schedule:** Daily at 03:00, 30-day retention, max 50 backups.
- **Backup encryption: DISABLED** (`encryptBackups: false`).
- **No tested restore procedure** — the `restoreExecutionResult` type exists but no evidence of tested restore.
- **No tenant-aware backup/restore** — backups are global, no per-tenant backup or restore capability.
- **Not verifiable from source alone** — whether backups are actually run in production, whether restore has been tested.

### I.12 Secrets
- **JWT_SECRET** — required at startup, checked via `assertRequiredEnv(['JWT_SECRET'])`.
- **VAPID keys** — optional but must be both present or both absent.
- **GEMINI_API_KEY** — optional, loaded via dotenv.
- **No secret management system** — no HashiCorp Vault, AWS Secrets Manager, or similar.
- **No automatic secret rotation** — JWT_SECRET is static until manually changed.
- **Default fallback warning** — `getJwtSecret()` warns if using the default `mmba_central_production_secret_key`.

### I.13 Environment Validation
- **Startup validation** — `assertRequiredEnv(['JWT_SECRET'])` refuses to start if missing.
- **Numeric validation** — `PORT` must be 1-65535 integer.
- **Secret pair validation** — VAPID keys must both be present or both absent.
- **No environment-specific configuration profiles** — no `.env.production`, `.env.staging` files visible.

### I.14 Dependency Security
- **Not verifiable from source alone** — `npm audit` has not been run in this session.
- **Known dependencies:** express 4.21.2, jsonwebtoken 9.0.3, bcryptjs 3.0.3, react 19.0.1, vite 6.2.3, web-push 3.6.7.
- **No security audit tool integrated** — no Snyk, Dependabot, or similar in the repository configuration.

### I.15 Graceful Shutdown
- **Implemented** via `installGracefulShutdown()` in `prodHelpers.ts`.
- **SIGTERM/SIGINT handlers** with 15s timeout.
- **Primary hooks:** Stop notification scheduler.
- **Follower hook:** Best-effort flush of in-memory writes to disk.
- **No graceful shutdown for in-flight WebSocket connections** — chat connections may be terminated abruptly.

### I.16 Domain Handling
- **No domain/hostname handling exists** — no subdomain resolution, no custom domain support, no DNS configuration.
- **No reserved slug list** — no protection for `admin`, `api`, `www`, etc.
- **No hostname normalization** — no handling of case, trailing dots, ports.
- **No SSL/TLS termination** — must be configured at deployment layer.

---

## J. Target Architecture

### J.1 Entity Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          MMBA PLATFORM                                      │
│                                                                             │
│  ┌─────────────┐    ┌──────────────┐    ┌──────────────┐    ┌─────────────┐ │
│  │   PLANS     │    │  LICENSES    │    │ DOMAINS      │    │  USERS      │ │
│  │             │    │              │    │              │    │  (GLOBAL)   │ │
│  │ id          │    │ id           │    │ id           │    │             │ │
│  │ name        │    │ tenantId     │    │ tenantId     │    │ id          │ │
│  │ description │    │ planId       │    │ hostname     │    │ username    │ │
│  │ status      │    │ status       │    │ type         │    │ email       │ │
│  │ entitlements│    │ startsAt     │    │ isPrimary    │    │ role        │ │
│  │ createdAt   │    │ expiresAt    │    │ verifiedAt   │    │ status      │ │
│  │             │    │ revokedAt    │    │ sslStatus    │    │             │ │
│  └──────┬──────┘    └──────┬───────┘    └──────┬───────┘    └──────┬──────┘ │
│         │                  │                   │                    │        │
│         │ ┌────────────────┘                   │                    │        │
│         │ │                                    │                    │        │
│         ▼ ▼                                    │                    │        │
│  ┌────────────────────────────────────────────┼────────────────────┼────────┐
│  │           TENANT                            │                    │        │
│  │                                             │                    │        │
│  │  id                                         │                    │        │
│  │  name                                       │                    │        │
│  │  slug                                       │                    │        │
│  │  businessCategoryId                         │                    │        │
│  │  status                                     │                    │        │
│  │                                             │                    │        │
│  │  ┌────────────────────────────────────┐     │                    │        │
│  │  │     TENANT_MEMBERSHIP               │     │                    │        │
│  │  │                                      │     │                    │        │
│  │  │  id         tenantId   userId  role  │     │                    │        │
│  │  │  status     joinedAt   ...     ...   │     │                    │        │
│  │  └───────┬──────────────────┬───────────┘     │                    │        │
│  │          │                  │                  │                    │        │
│  │          ▼                  ▼                  ▼                    │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │  CUSTOMERS  │  │  LEADS       │  │   CHAT       │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  │                                                                     │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │  PAYMENTS   │  │  ACCOUNTS    │  │  ATTACHMENTS │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  │                                                                     │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │  TASKS      │  │  VOICE_NOTES │  │   NOTIF.     │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  │                                                                     │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │ INTERACTIONS│  │ CONTRACTS    │  │ AUDIT_LOGS   │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  │                                                                     │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │  SETTINGS   │  │  PUSH_SUBS.  │  │  FILES       │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  │                                                                     │        │
│  │  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐              │        │
│  │  │  REPORTS    │  │  JOURNAL_ENT │  │  ACC_PERIODS │              │        │
│  │  │ tenantId ✓  │  │ tenantId ✓   │  │ tenantId ✓   │              │        │
│  │  └─────────────┘  └──────────────┘  └──────────────┘              │        │
│  └─────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### J.2 Request Flow

```
Request (HTTPS)
  ↓
Reverse Proxy (TLS termination, rate limiting, WAF)
  ↓
Hostname Resolution
  ↓  Extract subdomain from Host header → resolve to tenant
  ↓
Tenant Resolution Middleware
  ↓  Validate hostname against TenantDomain whitelist
  ↓  Set req.tenantId = resolved tenant
  ↓
Authentication
  ↓  Extract JWT from Authorization header
  ↓  Verify token signature, expiry, tokenVersion
  ↓  Set req.authUser
  ↓
Membership Verification
  ↓  Check req.authUser.id exists in TenantMembership for req.tenantId
  ↓  Set req.tenantRole, req.tenantMembership
  ↓
License / Entitlement Check
  ↓  Verify tenant's license is ACTIVE and not expired
  ↓  Check entitlement for requested feature
  ↓
Authorization
  ↓  requirePermission(module, action) — role-based
  ↓  Ownership check — verify resource belongs to req.tenantId
  ↓
Tenant-Scoped Service Layer
  ↓  All database queries include WHERE tenantId = req.tenantId
  ↓
Tenant-Scoped Database Query
  ↓  Result filtered to req.tenantId
  ↓
Response
```

### J.3 Authentication Flow (Multi-Tenant)

```
Login Request
  ↓
Resolve tenant from hostname (or explicit tenant subdomain)
  ↓
Find user by credential (username/email/mobile)
  ↓
Verify user exists in TenantMembership for resolved tenant
  ↓
Verify password (bcrypt)
  ↓
Check user.status, membership.status, tenant.status
  ↓
Sign JWT with tenantId embedded in payload
  ↓
Return token + user info + tenant info
```

### J.4 Authorization Flow

```
Incoming Request
  ↓
Middleware: req.tenantId already set by Tenant Resolution
  ↓
Middleware: req.authUser already set by Auth
  ↓
requirePermission(module, action)
  ↓
  ├── Is user a platform admin? → Allow (platform-level operations)
  ├── Is user a tenant owner/admin? → Allow (tenant-level admin operations)
  ├── Does user have the required role permission? → Allow
  └── No → 403 Forbidden
  ↓
Resource-level ownership check (if applicable)
  ↓
  ├── Does resource.tenantId === req.tenantId? → Allow
  └── No → 403 Forbidden (or 404 to avoid IDOR)
```

### J.5 License Flow

```
Request
  ↓
Tenant Resolution → req.tenantId
  ↓
License Check → find active license for tenant
  ↓
  ├── License ACTIVE → proceed
  ├── License TRIAL → proceed with feature restrictions
  ├── License SUSPENDED → block non-essential features
  ├── License EXPIRED → block login OR read-only mode
  ├── License REVOKED → block all access
  └── No License → block access
  ↓
Entitlement Check → is feature X included in plan?
  ↓
  ├── Entitlement available → proceed
  └── Not available → 403 or feature disabled UI
```

### J.6 Storage Isolation Design

```
Storage Layer
  ↓
  ├── Object Storage (S3/MinIO)
  │   ├── Path: tenants/{tenantId}/attachments/{attachmentId}/
  │   ├── Path: tenants/{tenantId}/voice-notes/{voiceNoteId}/
  │   ├── Path: tenants/{tenantId}/exports/{exportId}/
  │   └── Path: tenants/{tenantId}/avatars/{userId}/
  │
  ├── Signed URLs for download
  │   ├── Generated per-request
  │   ├── Scoped to tenantId + userId
  │   └── Expire after configured TTL
  │
  └── Database metadata
      ├── Attachment.tenantId
      ├── Attachment.customerId (scoped to tenant)
      └── Attachment.ownerUserId
```

---

## K. Recommended Schema

**Do not implement yet.** This section provides a conceptual schema for the proposed multi-tenant architecture.

### K.1 Proposed Relationships

```
User (global platform user)
  └─ 1:many ──→ TenantMembership
                ├── tenantId → Tenant
                ├── role (tenant-specific role override)
                ├── status (ACTIVE, INVITED, REMOVED, SUSPENDED)
                └── joinedAt, updatedAt

Tenant
  ├─ 1:many ──→ TenantMembership
  ├─ 1:1  ──→ TenantDomain (primary)
  ├─ 1:many ──→ TenantDomain (additional domains)
  ├─ 1:1  ──→ License
  ├─ 1:many ──→ BusinessCategory (reference)
  ├─ 1:many ──→ Customer (all customers belong to tenant)
  ├─ 1:many ──→ Lead (all leads belong to tenant)
  ├─ 1:many ──→ ChatConversation (all conversations belong to tenant)
  ├─ 1:many ──→ Account (all accounts belong to tenant)
  ├─ 1:many ──→ Payment (all payments belong to tenant)
  ├─ 1:many ──→ JournalEntry (all entries belong to tenant)
  ├─ 1:many ──→ Attachment (all attachments belong to tenant)
  ├─ 1:many ──→ Task (all tasks belong to tenant)
  ├─ 1:many ──→ Notification (all notifications belong to tenant)
  ├─ 1:many ──→ AuditLog (all audit logs belong to tenant)
  ├─ 1:1  ──→ Settings (per-tenant settings)
  └─ 1:many ──→ AccountingPeriod (per-tenant periods)

TenantDomain
  ├─ tenantId → Tenant
  ├─ hostname (e.g., "pizza.mmba.example.com")
  ├─ type (PRIMARY, CUSTOM, ALIAS)
  ├─ status (PENDING, VERIFIED, ACTIVE, INACTIVE)
  └── isPrimary

License
  ├─ tenantId → Tenant
  ├─ planId → Plan
  ├─ status (ACTIVE, TRIAL, SUSPENDED, EXPIRED, CANCELLED, REVOKED)
  ├─ startsAt, expiresAt, revokedAt
  └─ plan features → Entitlements (via Plan)

Plan
  ├─ entitlements (feature flags, numeric limits, quotas)
  └─ modules (which modules are enabled)

BusinessCategory (reference data)
  └─ GENERAL, RESTAURANT, RETAIL, SALON, CLINIC, SERVICE_BUSINESS
```

### K.2 Key Schema Changes for Existing Entities

Every existing entity in `CentralDatabaseSchema` needs a `tenantId` field added:

```typescript
// Every tenant-sensitive entity gets:
interface TenantScopedEntity {
  tenantId: string;    // NEW — references Tenant.id
  // ...existing fields...
}

// Uniqueness changes:
// - phone/mobile: globally unique → unique per tenant
// - code (customer, account): globally sequential → unique per tenant
// - invoiceNumber: globally unique → unique per tenant
// - slug: globally unique → unique per tenant
```

---

## L. Implementation Roadmap

### L.1 Step 10: Multi-Tenant Architecture and Tenant Isolation

**Objective:** Introduce the `Tenant`, `TenantMembership`, `TenantDomain`, `License`, `Plan`, and `BusinessCategory` entity concepts. Add `tenantId` to all existing entities. Implement tenant resolution, membership verification, and tenant-scoped database queries.

**Prerequisites:**
- Decide on deployment model: single database with `tenantId` column, or separate schemas per tenant, or separate databases per tenant
- Choose relational database to replace JSON-file store (strongly recommended)
- Define `BusinessCategory` enumeration values based on actual product requirements

**Affected Areas:**
- `server/db.ts` — entire data access layer must be rewritten to support tenant scoping
- `src/types/index.ts` — all entity types need `tenantId` field
- `server/auth.ts` — `getJwtSecret()` must support per-tenant keys; JWT payload must include `tenantId`
- `server/routes.ts` — every route handler must enforce tenant scoping
- `server/routes.ts` — `requireAuth` must be extended to verify tenant membership
- `src/services/storage.ts` — frontend cache must be tenant-aware
- `src/services/api.ts` — API client must include `tenantId` in requests

**Major Migrations:**
- Convert all flat global arrays to tenant-scoped queries
- Migrate from JSON-file store to relational database with tenant columns
- Add `tenantId` index to every tenant-sensitive table
- Seed initial platform-level data (default plans, business categories)
- Migrate existing `usr-admin` user to platform admin role

**Security Concerns:**
- Every database query MUST include `WHERE tenantId = ?` — query builder should enforce this at the ORM level
- Tenant ID must come from server-side authentication, never from client input
- Cross-tenant queries must be impossible at the database layer (row-level security or application-level enforcement)
- Audit logs must record `tenantId` for every action

**Testing Requirements:**
- Unit tests for every database query to verify tenant scoping
- Integration tests simulating two tenants accessing the same database
- IDOR/BOLA penetration tests on every `/:id` endpoint
- Load testing with multiple concurrent tenants
- Verification that no query can return data from another tenant

**Rollback Concerns:**
- Must maintain backward compatibility during migration
- Global data (platform-level entities like `roles`) should be preserved
- Existing `usr-admin` account must be converted to platform admin
- Database migration must be atomic and reversible

**Blockers:**
- **Decision required:** Which database engine to adopt? (PostgreSQL recommended for row-level security)
- **Decision required:** Single database with `tenantId` column vs. separate schemas vs. separate databases?
- **Decision required:** How to handle the existing JSON-file database migration?
- **Decision required:** What `BusinessCategory` values to define?

### L.2 Step 11: Tenant Domains and Hostname Routing

**Objective:** Implement subdomain-based tenant resolution (`tenant-slug.mmba.example.com`), custom domain support, and hostname validation.

**Prerequisites:** Step 10 complete. DNS wildcard configured. Reverse proxy configured to pass `Host` header.

**Prerequisites:** Step 10 complete. DNS wildcard configured. Reverse proxy configured to pass Host header.

**Affected Areas:** `server.ts`, `server/routes.ts`, `server/security.ts` (new middleware), DNS configuration, TLS configuration.

### L.3 Step 12: Licensing Foundation

**Objective:** Implement `License`, `Plan`, and `Entitlement` entities. Add license state enforcement to all API endpoints.

**Prerequisites:** Step 10 complete. `Tenant` and `TenantMembership` entities exist.

**Affected Areas:** `server/db.ts`, `server/routes.ts`, `src/types/index.ts`.

### L.4 Step 13: Plans and Entitlements

**Objective:** Define plan tiers with feature flags, numeric limits, and quotas. Implement entitlement checking in the service layer.

**Prerequisites:** Step 12 complete. License entity exists.

**Affected Areas:** Feature flags throughout the application, plan configuration, entitlement checking middleware.

### L.5 Step 14: Business Categories and Modular CRM

**Objective:** Implement `BusinessCategory` and category-specific CRM models (restaurant tables, salon appointments, etc.) as optional modules.

**Prerequisites:** Steps 10-13 complete. Business categories defined.

**Affected Areas:** Database schema additions for category-specific tables, module loading system, category-specific UI components.

### L.6 Step 15: Billing/Subscriptions

**Objective:** Integrate payment provider for subscription management. Implement webhook processing, idempotency, and event ordering.

**Prerequisites:** Steps 12-14 complete. License and plan entities exist.

**Affected Areas:** Payment provider integration, webhook handlers, subscription state machine, billing UI.

### L.7 Step 16: Platform Owner/Control Panel

**Objective:** Build platform admin panel for managing all tenants, licenses, plans, and platform-level settings.

**Prerequisites:** Steps 10-15 complete. Platform admin role defined.

**Affected Areas:** New admin routes, admin UI components, platform-level audit logs.

### L.8 Step 17: Production Deployment and Launch Hardening

**Objective:** Complete all production hardening: HTTPS, HSTS, monitoring, alerting, backup/restore testing, disaster recovery procedures, load testing, security audit.

**Prerequisites:** All previous steps complete.

**Affected Areas:** Deployment configuration, monitoring integration, backup/restore procedures, security hardening, performance optimization.

---

## M. Exact Next Step

### M.1 The Single Most Important Architectural Issue

**The complete absence of any tenant isolation mechanism.** Every entity, every query, every API route, and every frontend state assumption treats the entire application as belonging to a single business. There is no `tenantId` on any entity type, no `TenantMembership` concept, no tenant-scoped queries, and no tenant-aware authorization. This is not a missing feature — it is the foundational architectural gap that makes everything else impossible.

Without resolving this first, adding domains, licenses, plans, business categories, or billing would be bolting features onto a system that has no concept of "which business does this data belong to."

### M.2 The Exact Step 10 Implementation Scope

The Step 10 implementation should follow this scope:

1. **Choose the database engine** — Replace the JSON-file store with a relational database (PostgreSQL recommended for native row-level security support). This is a prerequisite for any serious multi-tenant architecture.

2. **Define the core entity model** — Create `Tenant`, `TenantMembership`, `TenantDomain`, `Plan`, `License`, and `BusinessCategory` types in `src/types/index.ts`.

3. **Add `tenantId` to every existing entity** — Every table in the schema must have a `tenantId` field. Global/platform entities (like `Role` definitions) remain shared.

4. **Implement tenant resolution** — Add middleware that resolves `tenantId` from hostname (e.g., `pizza.mmba.example.com` → `pizza` tenant). This can be a no-op during development but must be architectural.

5. **Implement membership verification** — After authentication, verify the user's `TenantMembership` for the resolved tenant. Set `req.tenantRole` and `req.tenantId`.

6. **Enforce tenant scoping in ALL database queries** — Every query must include `WHERE tenantId = ?`. Build this into the data access layer so it cannot be accidentally omitted.

7. **Implement tenant-aware authorization** — Extend `requirePermission` to also verify resource ownership via `tenantId`. Reject requests that attempt to access resources outside the user's tenant.

8. **Add tenantId to JWT payload** — Include `tenantId` in the JWT so the server can verify tenant context from the token itself.

9. **Implement tenant-scoped storage** — All file uploads and attachments must be scoped to `tenantId`. File paths must include `tenantId`.

10. **Implement tenant-scoped frontend cache** — localStorage and IndexedDB cache must use tenant-aware keys. Cache must be invalidated on tenant switch.

### M.3 Blockers That Must Be Resolved Before Implementation

1. **Database engine decision:** The current JSON-file store cannot support multi-tenancy at scale. A relational database must be chosen. This is a foundational decision that affects every subsequent step.

2. **Tenant isolation strategy:** Single database with `tenantId` column, separate schemas, or separate databases? This decision affects query performance, backup strategy, migration complexity, and security isolation level.

3. **BusinessCategory definition:** What categories does the product actually need? The audit found references to restaurant, retail, salon, clinic/service, and general business models. These must be defined before tenant creation.

4. **Platform admin identity:** The existing `usr-admin` account must be redefined as a platform-level administrator. What is the migration path for the existing user?

5. **Existing data migration:** How does the existing global data (all customers, leads, etc.) map to the new tenant model? Is there a single "initial tenant" that owns all existing data?

### M.4 Decisions Requiring Platform Owner Choice

| Decision | Option A | Option B | Option C |
|---|---|---|---|
| **Database engine** | PostgreSQL (recommended) | MySQL/MariaDB | Stay with JSON file (not recommended) |
| **Tenant isolation** | Single DB + `tenantId` column | Separate schema per tenant | Separate database per tenant |
| **Business categories** | Define 5-6 categories now | Define minimal set, add later | Leave undefined, use generic |
| **Existing data migration** | Create single "default" tenant for all existing data | Discard existing data, start fresh | Migrate existing data to tenant with platform admin |
| **Platform admin model** | Single global super-admin | Platform admin + per-tenant admins | Organization-based admin hierarchy |
| **JWT strategy** | Single secret, tenantId in payload | Per-tenant key material | Hybrid (platform secret + tenant rotation) |
| **Storage model** | Object storage with tenant prefixes | File system with tenant directories | Database-embedded (current, not scalable) |
| **Custom domains** | Support in Step 11 | Defer indefinitely | Support with manual DNS verification |

---

## Evidence Rules Compliance

Every finding in this report is tied to actual repository evidence:

- **No `tenantId` field exists** on any entity type — verified by scanning `src/types/index.ts`, `server/db.ts`, and `server/routes.ts` for `tenant`, `businessId`, `companyId`, `workspaceId`, `orgId`.
- **All database queries resolve by raw ID** — verified by examining `server/db.ts` methods (`findCustomerByMobile`, `findLeadById`, `findUserById`, etc.) and `server/routes.ts` handlers (`GET /customers/:id`, `GET /leads/:id`, etc.).
- **No hostname/tenant resolution** — verified by searching `server/` and `src/` for `hostname`, `subdomain`, `domain`, `tenant`.
- **Single JSON-file store** — verified by examining `server/db.ts` (`CentralDatabase` class, `DATABASE_PATH`, `path.resolve(process.cwd(), rawPath)`).
- **Frontend state in localStorage** — verified by examining `src/services/storage.ts` (`saveLocalCacheSnapshot`, `localStorage.getItem`).
- **No tenant concept in auth** — verified by examining `server/auth.ts` (`signToken`, `verifyToken`, `getJwtSecret`) and `server/routes.ts` (`getAuthUser`).
- **All routes use role-based permission only** — verified by examining `server/routes.ts` (`requirePermission`, `isAdmin`, `hasPermission`).
- **No per-tenant storage paths** — verified by examining attachment and voice note endpoints in `server/routes.ts`.
- **Single global JWT secret** — verified by examining `server/auth.ts` (`getJwtSecret()` reads `process.env.JWT_SECRET`).

---

## Verification Commands

```bash
npm run lint
npm run build
```

**Status:** Not run in this session. The audit is a code inspection task, not a build task. These commands should be run as part of the verification workflow after implementation.

---

*This audit is discovery and architecture only. No implementation was performed. No files were modified. The repository remains in its original state.*
