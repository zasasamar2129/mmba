# MMBA_STEP_11B_FIX_REPORT.md

**Step:** 11B-FIX — Generic Tenant RBAC + Clean TypeScript Verification
**Branch:** `step10-audit`
**Commit:** `e81f26e`
**Parent:** `cee08d4` (Step 11B)

---

## 40.1 Executive Summary

**Found and fixed:**

1. **Critical authorization gap (confirmed, not theoretical).** All five generic tenant
   routes under `/v2/tenants/:table` authorized every table with `ModuleName.CUSTOMERS`.
   A user holding only customer permissions could read and mutate payments, checks,
   accounting (accounts + journal entries + lines), chat, repairs, SIMs, leads,
   contracts, notifications, attachments, consignments, audit logs and broadcasts.
   Measured with the test suite re-run against the vulnerable code: **28 tables leaked**.

2. **A second authorization-adjacent defect found while fixing the first.** The generic
   DELETE route soft-deleted `payment` and `checkRecord` unconditionally. The Step 5
   financial guards (completed/verified payments, deposited/cleared checks) live in
   `server/db.ts` on the JSON-store path only, so the PostgreSQL route bypassed them
   entirely. Fixed as part of §3.6 of the task.

3. **Clean-checkout TypeScript failure.** Reproduced: a fresh clone produced **16**
   `tsc` errors, 2 more than the 14 baseline, because `prisma/db.ts` imports generated
   `./schema.d` and `./schema.json` that are gitignored and not regenerated before
   typechecking. Fixed with a reproducible generation lifecycle.

**Intentionally NOT changed:**

- Tenant architecture, repository layer, Prisma schema, contract emission.
- `tenantRepository.ts` / `customerRepository.ts` tenant scoping (verified correct).
- The legacy JSON `customerRepository` and its dedicated `/v2/tenants/customers` route.
- The 14 pre-existing baseline TypeScript errors (unrelated to this step; §40.7).
- `tsconfig.json` (no weakening, no suppression).
- No generated artifact was committed.

---

## 40.2 Generic Tenant RBAC Fix

### Original vulnerability

`server/routes.ts` registered all five generic handlers with a hardcoded customer module:

```ts
apiRouter.get   ('/v2/tenants/:table',      requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW));
apiRouter.get   ('/v2/tenants/:table/:id',  requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW));
apiRouter.post  ('/v2/tenants/:table',      requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE));
apiRouter.put   ('/v2/tenants/:table/:id',  requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT));
apiRouter.delete('/v2/tenants/:table/:id',  requirePermission(ModuleName.CUSTOMERS, PermissionAction.ARCHIVE));
```

`requirePermission` runs **before** the handler, so the table name was never consulted
for authorization. Any authenticated user with `CUSTOMERS:VIEW` could `GET
/api/v2/tenants/payment` and read every payment row in their tenant.

### New table → module mapping

Single source of truth: **`server/tenantTableModules.ts`**.

| Generic table | Module |
|---|---|
| `customer` (dedicated route) | `CUSTOMERS` |
| `lead`, `leadActivity`, `dateSuggestion` | `LEADS` |
| `interaction` | `CALLS` |
| `task` | `TASKS` |
| `contract`, `contractInstallment` | `CONTRACTS` |
| `payment`, `account`, `journalEntry`, `journalEntryLine` | `PAYMENTS` |
| `checkRecord` | `CHECKS` |
| `simCard` | `SIM_INVENTORY` |
| `repair` | `REPAIRS` |
| `consignment` | `CONSIGNMENTS` |
| `attachment`, `documentShare`, `shareableLink` | `DOCUMENTS` |
| `voiceNote` | `NOTES` |
| `chatConversation`, `chatMessage`, `chatParticipant`, `messageReaction`, `chatMessageReadReceipt` | `CHAT` |
| `broadcast`, `broadcastRecipient` | `CHAT_BROADCAST` |
| `notification`, `notificationDelivery`, `problemReport` | `INBOX` |
| `registeredHolder` | `CUSTOMERS` |
| `auditLog` | `AUDIT_LOGS` |

**Note on accounting:** `ModuleName` has no `ACCOUNTING` member. The accounting role
(`ACCOUNTING_ADMIN`) is granted `PAYMENTS` + `CHECKS` in the existing permission
model, so the ledger maps to `PAYMENTS`. A customer-only user is denied. These three
entries are the ones to move if a dedicated accounting module is added later.

### Unknown-table behaviour

`getTenantTableModule()` returns `null` for any unrecognised table and **never** falls
back to a default module. `requireTenantTablePermission()` rejects with **404
`UNKNOWN_TABLE`** before making any permission decision. `Object.prototype.hasOwnProperty`
is used so prototype keys (`constructor`, `__proto__`, `toString`) cannot resolve to a
module. Error bodies carry no SQL, Prisma, or permission internals.

### Operation permission mapping

Unchanged from the existing model (`PermissionAction`), just bound to the resolved module:

| Operation | Required action |
|---|---|
| GET collection / record | `VIEW` |
| POST | `CREATE` |
| PUT | `EDIT` |
| DELETE | `ARCHIVE` |

The client cannot influence the module: the table name comes only from the URL path.

### Affected verticals

All 30 registered generic tables. Before: 28 leaked to a customer-only user.
After: 0.

---

## 40.3 Authorization Regression Results

`test/step11bfix-authorization.ts` — 86 checks, pure logic.
`test/step11bfix-generic-routes-http.ts` — 83 checks, real router + real PostgreSQL.

| Vertical | Customer-only user | Correct-module user |
|---|---|---|
| customers | ALLOWED (200) | ALLOWED (200) |
| leads | DENIED (403) | ALLOWED (200) |
| contracts | DENIED (403) | ALLOWED (200) |
| payments | DENIED (403) | ALLOWED (200) |
| checks | DENIED (403) | ALLOWED (200) |
| accounting (account) | DENIED (403) | ALLOWED (200) |
| accounting (journalEntry) | DENIED (403) | ALLOWED (200) |
| accounting (journalEntryLine) | DENIED (403) | ALLOWED (200) |
| chat (chatMessage) | DENIED (403) | ALLOWED (200) |
| chat (chatConversation) | DENIED (403) | ALLOWED (200) |
| repairs | DENIED (403) | ALLOWED (200) |
| SIMs | DENIED (403) | ALLOWED (200) |
| tasks | DENIED (403) | ALLOWED (200) |
| notifications | DENIED (403) | ALLOWED (200) |
| attachments | DENIED (403) | ALLOWED (200) |
| consignments | DENIED (403) | ALLOWED (200) |
| interaction | DENIED (403) | ALLOWED (200) |
| contractInstallment | DENIED (403) | ALLOWED (200) |
| registeredHolder | ALLOWED (200, maps to CUSTOMERS) | ALLOWED (200) |
| All remaining tables | DENIED (403) | ALLOWED (200) |
| Unknown table (6 variants incl. `constructor`, `__proto__`) | 404 | 404 |

Mutations (POST/PUT/DELETE) denied for customer-only users across payments, checks,
accounting, chat, repairs, SIMs, leads, attachments.

**Control assertion (guards against vacuous passes):** the customer-only user *is*
allowed on `customer` and `registeredHolder` — the two CUSTOMERS-mapped tables. Without
this, a misconfigured role catalogue would make every "denied" check pass for the wrong
reason. This control caught exactly that bug during development (see §40.12).

Admin roles (GOD, OWNER, SUPER_ADMIN) retain full access to every generic table.

**Negative control:** with the vulnerable code restored, the suite reports
`LEAKED: lead, interaction, voiceNote, task, contract, payment, checkRecord, simCard,
repair, consignment, chatConversation, chatMessage, attachment, notification, auditLog,
broadcast, broadcastRecipient, messageReaction, contractInstallment, dateSuggestion,
shareableLink, problemReport, documentShare, leadActivity, notificationDelivery, account,
journalEntry, journalEntryLine` — 28 tables. With the fix: 0.

---

## 40.4 Tenant Isolation Results

Two independent boundaries verified separately (§40.3 covers RBAC, this covers tenancy).

| Scenario | Expected | Actual |
|---|---|---|
| Tenant A host → own-tenant customer record | 200 | 200 |
| Tenant B host → tenant A customer record (IDOR) | 404 | 404 |
| Tenant B host → PUT tenant A customer | 404 | 404 |
| Tenant B host → tenant A generic-route record (IDOR) | 404 | 404 |
| Tenant B host → tenant A payment record | 404 | 404 |
| Cross-tenant PUT did not modify the record | unchanged | unchanged |

Cross-tenant existence is not leaked: denied reads return 404, not 403.

**Documented scope limit:** `DELETE /v2/tenants/customers/:id` is served by the legacy
JSON-store `customerRepository`, which is single-tenant by construction and has no
`tenantId` predicate — a cross-tenant id is not meaningful on that path. IDOR is
asserted on the tenant-scoped generic route instead. Converting that legacy route is
outside this step's scope.

---

## 40.5 Financial Safety Results

The Step 5 guards did **not** hold on the PostgreSQL path. They now do.

| Scenario | Expected | Actual |
|---|---|---|
| DELETE `COMPLETED` payment | refused | 409 |
| DELETE `VERIFIED` payment | refused | 409 |
| DELETE `PENDING` payment | status transition only | 200, row intact, `status=DELETED` |
| DELETE `DEPOSITED` check | refused | 409 |
| DELETE `CLEARED` check | refused | 409 |
| DELETE `RECEIVED` check | status transition only | 200 |
| `COMPLETED` payment status after refused delete | unchanged | `COMPLETED` |
| `auditLog` DELETE | append-only, no removal | status transition |

Settled financial records are never removed by any status. Error responses use 409 with
`error: FINANCIAL_RECORD_PROTECTED` and the existing Persian message text from
`server/db.ts`, adding no new information beyond what the JSON path already returns.

---

## 40.6 Prisma Contract Generation Fix

**Why a clean checkout failed:** `prisma/db.ts` imports
`import type { Contract } from './schema.d'` and
`import contractJson from './schema.json' with { type: 'json' }`. Both files are emitted
by `prisma contract emit` and both are gitignored (from the Step 11B cleanup, commit
`1d3d675`). Nothing regenerated them before `tsc`, so a fresh clone had two unresolvable
imports.

**Root cause of the gap:** `lint` was `tsc --noEmit` — a bare compiler invocation with
no contract-generation step in its lifecycle.

**Fix — a deterministic lifecycle, not committed artifacts (§3.2 of the task):**

```json
"typecheck": "prisma contract emit && tsc --noEmit",
"lint": "npm run typecheck"
```

`lint` now delegates so there is exactly one typecheck path and no way to run a bare
`tsc` that skips generation. Generation was deliberately **not** added to `dev`,
`build`, or `start` (§19 of the task).

**Artifacts remain untracked and ignored**, as intended. Verified after two consecutive
emits: `git status --short` is empty, while `prisma/schema.d.ts` (705,366 bytes) and
`prisma/schema.json` (459,865 bytes) exist on disk.

**Generation is deterministic:** two consecutive runs both produced
`storageHash 8f41ea2a97dd361c0694a52f21ebe5f416d0d7c33bd0ad2c342f1a1ca41f213c`.

**No strictness was weakened** (§20 of the task): no `@ts-ignore`, no `skipLibCheck`
change (already `true` on main), no `prisma/db.ts` exclusion, no stub declarations, no
module-resolution change, `tsconfig.json` untouched.

---

## 40.7 TypeScript Results

**Before the fix** — fresh clone of `step10-audit` at `cee08d4`, `npm install`, `npx tsc --noEmit`:

```
prisma/db.ts(3,31): error TS2307: Cannot find module './schema.d' or its corresponding type declarations.
prisma/db.ts(4,26): error TS2307: Cannot find module './schema.json' or its corresponding type declarations.
+ 14 pre-existing errors
= 16 errors
```

**After the fix** — `npm run typecheck` (= `prisma contract emit && tsc --noEmit`):

```
14 errors — none in prisma/db.ts
```

**Remaining baseline errors (pre-existing, unrelated to this step, unchanged):**

| File | Count | Nature |
|---|---|---|
| `src/components/common/ErrorBoundary.tsx` | 9 | React class component `state`/`setState`/`props` typing (TS2339) |
| `src/lib/webAuthn.ts` | 4 | `Uint8Array<ArrayBuffer>` not assignable to `ArrayBuffer` (TS2322) |
| `src/services/pushService.ts` | 1 | `Uint8Array<ArrayBufferLike>` not assignable to `string \| BufferSource` (TS2322) |

**Delta introduced by this step: 0.** No zero-error claim is made; the repository still
has these 14 pre-existing errors, which are unrelated to tenant RBAC or Prisma contracts.

---

## 40.8 Build Results

```
npm run build = PASS
vite build  ✓ 2192 modules transformed
esbuild     ✓ dist/server.cjs 398.1kb
```

Reported separately from the typecheck result, as required (§24 of the task). A passing
esbuild/Vite build is not treated as evidence that `tsc --noEmit` succeeds.

---

## 40.9 Test Results

| Command | Result |
|---|---|
| `npm run test:rbac` | **PASS** — 86/86 |
| `npm run test:rbac:http` | **PASS** — 83/83 |
| `npx tsx test/step12-verticals.ts` | **PASS** — 6 verticals, cross-tenant read/update/delete blocked |
| `npx tsx test/step12-tenant-context.ts` | **PASS** — subdomain resolves, wrong-tenant 403, unknown host 404 |
| `npx tsx test/step12-isolation.ts` | **PASS** — cross-tenant read null, update null, delete 0 |
| `npm run contract:emit` | **PASS** — deterministic, artifacts stay ignored |
| `git diff --check` | **PASS** — no whitespace errors |

The HTTP suite mounts the **real `apiRouter`** and drives it over `node:http`, so it
cannot drift from production wiring. It uses a real PostgreSQL database.

PostgreSQL: **available and used** — PostgreSQL 18.6 on 127.0.0.1:5432, database
`mmba_test` initialized via `prisma db init` (46 tables) and seeded via
`scripts/migrate-json-to-pg.ts` + platform records. All database-backed tests above
actually executed.

---

## 40.10 Clean Checkout Results

**Procedure (Option A, §22 of the task):** fresh `git clone --depth 1 --branch
step10-audit` into a new directory (`C:\mmba-verify\repo`), with no inherited
`node_modules` and no `prisma/schema.d.ts` / `prisma/schema.json`.

- Branch: `step10-audit`
- Commit: `7c9fb3c` (report commit; fix commit `e81f26e`)
- Node: v24.11.1, npm: 11.19.1
- `npm ci` → 485 packages, `prisma` binary present
- Pre-install `ls prisma/`: `db.ts`, `schema.prisma` only — generated artifacts absent, as required
- `git status --short`: clean

**Results:**

| Step | Result |
|---|---|
| `npx tsc --noEmit` (bare, no generation) | **16 errors** — the defect, reproduced |
| `npm run typecheck` (`prisma contract emit && tsc --noEmit`) | **14 errors**, `prisma/db.ts` clean |
| `npm run build` | **PASS** — `dist/server.cjs` 398.1kb |
| `git status --short` after generation | **empty** — artifacts correctly ignored |
| `prisma/` after typecheck | `db.ts`, `schema.prisma`, `schema.d.ts`, `schema.json` — generated |
| `npx tsx test/step11bfix-authorization.ts` | **PASS** — 86/86 |
| `npx tsx test/step11bfix-generic-routes-http.ts` | **PASS** — 83/83 |

The clean-checkout property holds: a developer can go from `git clone` to a successful
typecheck and build without inheriting generated files from any other machine.

*Note:* the first two install attempts in `%TEMP%` failed with a Windows
`ENOTEMPTY` file-lock error inside `@prisma/composer-cli`. That is an npm/Windows
file-handling issue, not a project defect; `npm ci` in a non-`%TEMP%` path completed
cleanly and produced the results above.

---

## 40.11 Files Changed

| File | Change | Reason |
|---|---|---|
| `server/tenantTableModules.ts` | **new** | Server-owned table → `ModuleName` map; `getTenantTableModule()` with no fallback; frozen; `Object.hasOwn` guard; Step 5 protected-status sets | The single source of truth for generic-table authorization |
| `server/routes.ts` | modified | Generic CRUD derives the module from `:table` via `requireTenantTablePermission()`; unknown table → 404; financial DELETE guard | Closes the RBAC gap and the financial-guard bypass |
| `package.json` | modified | Added `typecheck` (`prisma contract emit && tsc --noEmit`); `lint` delegates; added `test:rbac`, `test:rbac:http` | Reproducible contract lifecycle before typecheck |
| `test/step11bfix-authorization.ts` | **new** | 86 pure-logic checks: map integrity, prototype keys, unknown tables, customer-only denials, permission matrix, financial status sets | Regression coverage for the map |
| `test/step11bfix-generic-routes-http.ts` | **new** | 83 HTTP checks over the real router + real PostgreSQL | End-to-end proof the vulnerability is closed |

No secrets, credentials, dumps, or generated artifacts committed. `git diff --check`
clean.

---

## 40.12 Known Limitations

1. **`npm ci` failed twice in `%TEMP%`** with a Windows `ENOTEMPTY` file-lock error
   inside `@prisma/composer-cli`. This is an npm/Windows file-handling issue, not a
   project defect. Cloning to a non-`%TEMP%` path and running `npm ci` there
   completed cleanly and the full clean-checkout verification passed (§40.10). No
   repository change is warranted.

2. **`account` / `journalEntry` / `journalEntryLine` map to `PAYMENTS`,** because
   `ModuleName` has no `ACCOUNTING` member. Correct for the current role model (the
   accounting role holds `PAYMENTS` + `CHECKS`), but a dedicated accounting module would
   be the cleaner design. Three entries to change if that module is added.

3. **`registeredHolder` maps to `CUSTOMERS`.** A judgment call — registered SIM holders
   are customer-adjacent records. It does grant `CUSTOMERS:VIEW` users read access to
   that table. If registered holders should be customer-module-free, that entry is the
   one to change.

4. **`auditLog` maps to `AUDIT_LOGS`.** Anyone with `AUDIT_LOGS:VIEW` can read their own
   tenant's audit rows through the generic route. Row-level tenant scoping is enforced
   separately by the repository, so this cannot leak across tenants — but the Step 11B
   spec (§28) notes tenant audit logs should not be globally readable. The generic route
   is tenant-scoped, so this is consistent; worth a dedicated audit-log read path later.

5. **The legacy JSON `customerRepository` is not tenant-scoped** — it has no `tenantId`
   predicate, because it is the pre-PostgreSQL single-tenant store. Its dedicated
   `/v2/tenants/customers` route is therefore not covered by the tenant-isolation
   guarantees. Converting that route is outside this step's scope.

6. **Not re-verified in this step:** Docker Compose bring-up, Prisma Studio
   interactive launch, the full CRM functional-regression matrix, attachment/file and
   chat isolation over HTTP. These were covered or explicitly marked in the Step 11B
   report and are unchanged by this fix.

---

## 40.13 Security Assessment

**The generic-route authorization vulnerability is fixed and regression-tested.**

Evidence:

- Source inspection: no generic `:table` route references `requirePermission` any more
  (§39 search — `grep "requirePermission" server/routes.ts | grep ":table"` returns
  nothing; all 5 handlers use `requireTenantTablePermission`).
- Mapping has no permissive fallback; unknown tables return `404` before any permission
  decision; prototype keys cannot resolve.
- Customer-only user denied on 28 previously-leaking tables, across GET/POST/PUT/DELETE.
- Tests proven to catch the bug: re-introducing the vulnerable `requirePermission`
  calls makes the suite fail with 28 leaks; restoring the fix returns 83/83.
- Controls present so denials cannot pass vacuously.
- Client cannot select the module via query, body, or header (asserted, including
  `?module=`, `?__proto__=`, `?constructor=`, and a body `module` field).
- Step 5 financial guards now enforced on the PostgreSQL path.
- Tenant isolation re-verified independently (IDOR → 404, no existence leak).

**This does not mean the MMBA platform is secure.** Out of scope and unverified here:
the legacy JSON store's lack of tenant scoping (limitation 5), the pre-existing 14
TypeScript errors, authenticated-JWT hardening, rate-limit bypass under scale,
attachment/chat isolation over HTTP, and everything in the Step 11B report's
known-limitations list.

---

*Generated on branch `step10-audit` at commit `e81f26e`, 2026-09-27.*
