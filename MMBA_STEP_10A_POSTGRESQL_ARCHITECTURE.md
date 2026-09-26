# MMBA — STEP 10A: PostgreSQL + Prisma Architecture & Tenant Schema Specification

**Status:** Architecture / schema design only  
**Purpose:** Define the safe foundation for converting the current MMBA single-tenant JSON application into a production SaaS platform with PostgreSQL, Prisma, tenant isolation, licensing, business categories, custom domains/subdomains, and future hosted customer provisioning.

**Reconciled against:** Actual repository code inspected during Step 10 audit (2026-09-24)

---

# 1. REPOSITORY VERIFICATION

## 1.1 Current Runtime

| Layer | Technology | Evidence |
|---|---|---|
| **Backend** | Express.js 4.21.2 on Node.js | `server.ts`, `package.json` |
| **Frontend** | React 19 + Vite 6, Tailwind CSS 4 | `src/App.tsx`, `vite.config.ts`, `package.json` |
| **Database** | Custom JSON-file store (`CentralDatabase` class) | `server/db.ts` — `data/mmba_production_database.json` |
| **Auth** | JWT HS256 + bcrypt | `server/auth.ts` |
| **ORM** | None (raw array operations) | `server/db.ts` |
| **Storage** | Base64 embedded in JSON | `server/db.ts` (`Attachment.dataUrl`, `VoiceNote.audioDataUrl`) |
| **Push** | web-push library + VAPID | `server/webPushService.ts` |
| **i18n** | Custom Persian/Persian-to-English | `src/lib/i18n.ts` |
| **Build** | Vite build + esbuild server bundle | `package.json` scripts |
| **Process** | Single Express process | `server.ts` |

## 1.2 Current Authentication

- JWT with 24-hour lifetime, `tokenVersion` revocation
- Bearer token in `Authorization` header (not cookies)
- Token stored in `localStorage` (NOT HttpOnly)
- Single `JWT_SECRET` for entire deployment
- Roles: GOD, OWNER, SUPER_ADMIN, SUPERVISOR, ACCOUNTING_ADMIN, FINANCE_MANAGER, SALES, SALES_AGENT, STORE_OPERATIONS, TECHNICAL, REPAIR_TECHNICIAN, TECHNICIAN, READ_ONLY (13 roles)
- No email verification, no self-service password reset, no concurrent session management

## 1.3 Current RBAC

- Centralized `hasPermission(user, module, action)` in `src/lib/permissions.ts`
- `isAdmin(user)` returns true for GOD, OWNER, SUPER_ADMIN
- Per-route `requirePermission(module, action)` middleware in `server/routes.ts`
- **No tenant/business membership check** — authorization is purely role-based
- 13 roles defined in `DEFAULT_ROLES` array

## 1.4 Current Storage

- Single JSON file: `data/mmba_production_database.json`
- All data embedded: attachments as base64 `dataUrl`, voice notes as base64 `audioDataUrl`
- No file system storage, no object storage
- Backup service (`server/backupService.ts`) creates JSON archive files in `./data/backups/`

## 1.5 Current Entities Found

All entity types are defined in `src/types/index.ts` (1781 lines, 105 exported types). Verified current entity list:

| # | Entity | File/Type | Notes |
|---|--------|-----------|-------|
| 1 | **User** | `User` | `id, name, username, password, email, mobile, role, department, status, tokenVersion` |
| 2 | **Role** | `Role` | `id, name, titleFa, titleEn, descriptionFa, descriptionEn, permissions` |
| 3 | **Customer** | `Customer` | `id, code, name, phone, mobile, nationalId, company, address, status, tags` |
| 4 | **Lead** | `Lead` | `id, leadCode, mobile, name, status, source, assignedUserId, interactionCount` |
| 5 | **Interaction** | `Interaction` | `id, customerId, customerMobile, leadId, userId, interactionType, startedAt` |
| 6 | **Call** | `Call` | `id, customerId, leadId, userId, callType, dateTime, durationSeconds, subject` |
| 7 | **Task** | `Task` | `id, title, description, customerId, leadId, assignedUserId, sharedWithUserIds, priority, status` |
| 8 | **Contract** | `Contract` | `id, contractNumber, customerId, type, amount, status, financialSnapshot` |
| 9 | **Payment** | `Payment` | `id, receiptNumber, customerId, amount, method, status, contractId, installmentId` |
| 10 | **Check** | `CheckItem` (`Check`) | `id, type, customerId, customerName, issuerName, amount, bankName, checkNumber, status` |
| 11 | **SIM Card** | `SimCard` | `id, phoneNumber, operator, type, status, customerId, ownerCustomerId, registeredHolderId` |
| 12 | **Repair** | `RepairTicket` (`Repair`) | `id, trackingCode, customerId, deviceType, brand, model, status` |
| 13 | **Consignment** | `Consignment` | `id, simId, ownerCustomerId, status, soldPrice, settlementStatus` |
| 14 | **Attachment** | `Attachment` | `id, customerId, dataUrl, fileName, mimeType, size` |
| 15 | **VoiceNote** | `VoiceNote` | `id, audioDataUrl, mimeType, durationSeconds, customerId, relatedEntityId` |
| 16 | **Account** | `Account` | `id, code, name, account_type, is_active, parent_id` |
| 17 | **JournalEntry** | `JournalEntry` | `id, entry_number, entry_date, description, status, created_by` |
| 18 | **JournalEntryLine** | `JournalEntryLine` | `id, journal_entry_id, account_id, debit, credit` |
| 19 | **AccountingPeriod** | `AccountingPeriod` | `id, period, start_date, end_date, status` |
| 20 | **Notification** | `Notification` | `id, userId, title, message, body, category, priority, read` |
| 21 | **UserNotificationDevice** | `UserNotificationDevice` | `id, userId, pushEndpoint, deviceName, browser` |
| 22 | **NotificationDelivery** | `NotificationDelivery` | `id, notificationId, userId, channel, status` |
| 23 | **NotificationSettings** | `NotificationSettings` | `enableNotifications, enableSound, quietHoursEnabled` |
| 24 | **AuditLog** | `AuditLog` | `id, timestamp, userId, userName, userRole, action, module, ipAddress` |
| 25 | **DateSuggestion** | `DateSuggestion` | `id, customerId, jalaliDate, operatorId, status` |
| 26 | **ShareableLink** | `ShareableLink` | `id, token, relatedEntityId, isRevoked, accessCount` |
| 27 | **ProblemReport** | `ProblemReport` | `id, title, description, status, priority` |
| 28 | **DocumentShare** | `DocumentShare` | `id, documentId, sharedWith, status` |
| 29 | **ChatConversation** | `ChatConversation` | `id, type, title, priority, status, createdById` |
| 30 | **ChatMessage** | `ChatMessage` | `id, conversationId, senderId, content, status, isRead` |
| 31 | **ConversationMember** | `ConversationMember` | `id, conversationId, userId, role` |
| 32 | **Broadcast** | `Broadcast` | `id, title, body, status, createdById` |
| 33 | **BroadcastRecipient** | `BroadcastRecipient` | `id, broadcastId, userId, status` |
| 34 | **MessageAttachment** | `MessageAttachment` | `id, messageId, attachmentId` |
| 35 | **MessageReaction** | `MessageReaction` | `id, messageId, userId, emoji` |
| 36 | **ChatMessageReadReceipt** | `ChatMessageReadReceipt` | `id, messageId, userId, readAt` |
| 37 | **RegisteredHolder** | `RegisteredHolder` | `id, fullName, nationalId, mobile, activeSimCount` |
| 38 | **ContractInstallment** | `ContractInstallment` | `id, contractId, customerId, installmentNumber, status` |
| 39 | **TrustedBiometricDevice** | `TrustedBiometricDevice` | `id, userId, credentialId, deviceName, isRevoked` |
| 40 | **Settings** | `settings` (object) | `systemName, organizationName, currency, autoLockMinutes, requireTwoFactor` |
| 41 | **LeadActivity** | `LeadActivity` | `id, leadId, type, result, operatorId` |
| 42 | **Interaction** (call center) | `Interaction` | (same as #5 — unified) |
| 43 | **ContactImportRow** | `ContactImportRow` | Batch import metadata |
| 44 | **User** (seed) | `SEED_USERS` | Single `usr-admin` SUPER_ADMIN |
| 45 | **Accounts** | `DEFAULT_SEED_ACCOUNTS` | 13 default accounts |
| 46 | **AccountingPeriods** | `DEFAULT_SEED_PERIODS` | 2 periods (1403, 1404) |

---

# 2. CURRENT DATA MODEL

## 2.1 CentralDatabaseSchema (Current)

All 40+ entity types are stored in a single `CentralDatabaseSchema` object (`server/db.ts` line 43-93). Every field is a flat array or object. There is no `tenantId`, `businessId`, `companyId`, `workspaceId`, or any business identifier on any entity.

**Critical observation:** The `CentralDatabaseSchema.settings` field is a single global object — one configuration for the entire deployment.

## 2.2 Current Ownership Model

| Entity | Owner field | Tenant field | Enforcement |
|--------|-------------|--------------|-------------|
| User | N/A | **NONE** | None |
| Customer | `code` (global) | **NONE** | None — `find(c => c.id === id)` |
| Lead | `leadCode` (global) | **NONE** | None — `find(l => l.id === id)` |
| Payment | `customerId` | **NONE** | None — `find(p => p.id === id)` |
| Account | `code` (global) | **NONE** | None |
| JournalEntry | `entry_number` (global) | **NONE** | None |
| Attachment | `customerId` (optional) | **NONE** | None — `find(a => a.id === id)` |
| ChatConversation | None | **NONE** | None — `find(c => c.id === id)` |
| ChatMessage | `conversationId` | **NONE** | None — `find(m => m.id === id)` |
| Notification | `userId` | **NONE** | None — any user can access any notification |
| AuditLog | `userId` | **NONE** | None — global flat array |
| Settings | N/A (global) | **NONE** | None — one settings object |

**Confirmed:** Zero tenant fields exist in any entity type.

---

# 3. TARGET POSTGRESQL ARCHITECTURE

## 3.1 Technology Stack

```
React + Vite (unchanged)
       │
       ▼
Express API (unchanged, enhanced)
       │
       ├── Authentication (enhanced)
       ├── Tenant Resolution Middleware (new)
       ├── Membership / RBAC (enhanced)
       ├── Tenant Authorization (new)
       └── Business Services (existing)
              │
              ▼
           Prisma Client
              │
              ▼
         PostgreSQL
```

## 3.2 Prisma Schema Strategy

**Prisma** is the preferred ORM/schema/migration layer because:
- The current codebase uses TypeScript exclusively — Prisma generates type-safe TypeScript client
- Prisma Migrate provides deterministic migration history
- Prisma Studio provides browser-based database inspection
- Prisma supports PostgreSQL row-level security (RLS) as a backup enforcement layer

**`prisma/schema.prisma`** will contain all entity definitions. Each migration in `prisma/migrations/` represents a schema version.

## 3.3 Development Database

**PostgreSQL** via local installation or Docker Compose. Docker Compose recommended for reproducible development environments.

Development commands (to be documented):
```bash
npm run db:dev          # Start PostgreSQL via Docker Compose
npm run db:studio       # Open Prisma Studio
npm run db:migrate      # prisma migrate dev
npm run db:seed         # Seed development data
npm run db:reset        # prisma migrate reset (dev only)
```

## 3.4 Production Database

Production PostgreSQL must be a managed instance (e.g., AWS RDS, Supabase, Neon, or self-administered). Connection via `DATABASE_URL` environment variable.

**Never place `DATABASE_URL` in:** source code, `.env.example` with real credentials, frontend code, logs, API responses, committed build artifacts.

**Production migration command:**
```bash
prisma migrate deploy
```

## 3.5 Prisma Studio

Prisma Studio will be available for development database inspection:
```bash
npm run db:studio
```

Usage: Inspect tenants, users, memberships, customers, accounting, audit logs, relationships. **Do not expose Prisma Studio to the public internet.**

---

# 4. SCOPE CLASSIFICATION

Every current entity classified as one of: `PLATFORM`, `TENANT`, `USER`, `GLOBAL/SYSTEM`.

| Entity | Scope | Reason |
|--------|-------|--------|
| **Plan** | PLATFORM | Platform-level product offering |
| **BusinessCategory** | PLATFORM | Platform reference data |
| **PlatformAdmin** | PLATFORM | Platform owner/operator access |
| **Tenant** | PLATFORM (parent) / TENANT (child) | Top-level tenant container |
| **TenantMembership** | TENANT | User's role within a specific tenant |
| **TenantDomain** | PLATFORM (parent) / TENANT (child) | Domain mapping for tenants |
| **License** | TENANT | License bound to a specific tenant |
| **User** | GLOBAL | Global identity, referenced by TenantMembership |
| **Role** | GLOBAL | Platform role catalog |
| **Customer** | TENANT | Belongs to a specific tenant |
| **Lead** | TENANT | Belongs to a specific tenant |
| **Call** | TENANT | Belongs to a specific tenant |
| **Interaction** | TENANT | Belongs to a specific tenant |
| **Task** | TENANT | Belongs to a specific tenant |
| **Contract** | TENANT | Belongs to a specific tenant |
| **Payment** | TENANT | Belongs to a specific tenant |
| **Check** | TENANT | Belongs to a specific tenant |
| **SimCard** | TENANT | Belongs to a specific tenant |
| **Repair** | TENANT | Belongs to a specific tenant |
| **Consignment** | TENANT | Belongs to a specific tenant |
| **Attachment** | TENANT | Belongs to a specific tenant |
| **VoiceNote** | TENANT | Belongs to a specific tenant |
| **Account** | TENANT | Per-tenant chart of accounts |
| **JournalEntry** | TENANT | Belongs to a specific tenant |
| **JournalEntryLine** | TENANT | Belongs to a specific journal entry |
| **AccountingPeriod** | TENANT | Per-tenant periods |
| **Notification** | TENANT | Belongs to a specific tenant + user |
| **UserNotificationDevice** | TENANT | Belongs to a specific tenant + user |
| **NotificationDelivery** | TENANT | Belongs to a specific tenant + notification |
| **NotificationSettings** | USER | Per-user preferences |
| **AuditLog** | TENANT | Scoped to tenant (platform admin sees all) |
| **DateSuggestion** | TENANT | Belongs to a specific tenant + customer |
| **ShareableLink** | TENANT | Belongs to a specific tenant |
| **ProblemReport** | TENANT | Belongs to a specific tenant |
| **DocumentShare** | TENANT | Belongs to a specific tenant |
| **ChatConversation** | TENANT | Belongs to a specific tenant |
| **ChatMessage** | TENANT | Belongs to a specific tenant + conversation |
| **ConversationMember** | TENANT | Belongs to a specific tenant + conversation |
| **Broadcast** | TENANT | Belongs to a specific tenant |
| **BroadcastRecipient** | TENANT | Belongs to a specific tenant + broadcast |
| **MessageAttachment** | TENANT | Belongs to a specific tenant + message |
| **MessageReaction** | TENANT | Belongs to a specific tenant + message |
| **ChatMessageReadReceipt** | TENANT | Belongs to a specific tenant + message |
| **RegisteredHolder** | TENANT | Belongs to a specific tenant |
| **ContractInstallment** | TENANT | Belongs to a specific tenant + contract |
| **TrustedBiometricDevice** | USER | Belongs to a specific user |
| **Settings** | PLATFORM (global) / TENANT | Platform settings + per-tenant settings |
| **LeadActivity** | TENANT | Belongs to a specific tenant + lead |
| **ContactImportRow** | TENANT | Batch import metadata |
| **BackupManifest** | PLATFORM | Global backup metadata |

### GLOBAL/SYSTEM items (justified)
- **Role** — Platform role catalog. Role definitions are shared; tenant-specific role assignments happen via `TenantMembership.role`.
- **User** — Global identity. A user may have `TenantMembership` records in multiple tenants.
- **PlatformAdmin** — Platform owner/operator. Distinct from tenant membership.
- **BusinessCategory** — Platform reference data.
- **Plan** — Platform product offering.
- **Settings (platform)** — Global system configuration.

---

# 5. PROPOSED SCHEMA

## 5.1 Core Platform Entities

### User (GLOBAL)
```
id              UUID (PK)
username        STRING, UNIQUE
email           STRING, UNIQUE
mobile          STRING, UNIQUE (global phone dedup)
password_hash   STRING
name            STRING
department      STRING?
status          UserStatus (ACTIVE, INACTIVE, SUSPENDED)
role            UserRole (global role catalog reference)
avatar          STRING?
tokenVersion    INT, DEFAULT 0
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
lastLoginAt     TIMESTAMPTZ
```
**Note:** `User` is a global identity. A user may have zero, one, or many `TenantMembership` records. The global `role` field represents the platform-level role; per-tenant role is in `TenantMembership`.

### Role (GLOBAL)
```
id              UUID (PK)
name            STRING, UNIQUE
titleFa         STRING
titleEn         STRING?
descriptionFa   TEXT?
descriptionEn   TEXT?
permissions     JSONB  -- Array of {module, actions}
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**Note:** Role definitions are shared globally. Per-tenant role assignment is in `TenantMembership.roleId`.

### BusinessCategory (PLATFORM)
```
id              UUID (PK)
key             STRING, UNIQUE   -- e.g., "RESTAURANT", "RETAIL"
name            STRING
description     TEXT?
isActive        BOOLEAN, DEFAULT true
sortOrder       INT, DEFAULT 0
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**Note:** Business categories are platform-level reference data. Initial set determined from product requirements (see Section 18).

### Plan (PLATFORM)
```
id              UUID (PK)
key             STRING, UNIQUE   -- e.g., "FREE", "PRO", "ENTERPRISE"
name            STRING
description     TEXT?
isActive        BOOLEAN, DEFAULT true
sortOrder       INT, DEFAULT 0
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**Note:** Plans describe product entitlements. Actual limits/features are defined via `Entitlement` records linked to `Plan`.

### Entitlement (PLATFORM)
```
id              UUID (PK)
planId          UUID, FK → Plan
module          ModuleName
action          PermissionAction
limitType       ENUM(FEATURE, NUMERIC, QUOTA, MODULE_ACCESS)
limitValue      DECIMAL?        -- For numeric limits (maxUsers, maxCustomers, etc.)
isEnabled       BOOLEAN, DEFAULT true
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(planId, module, action)
```
**Note:** Plans define entitlements. A tenant's license references a plan, and the tenant's entitlements are derived from the plan.

## 5.2 Tenant Core Entities

### Tenant (TENANT)
```
id              UUID (PK)
name            STRING, NOT NULL
slug            STRING, UNIQUE, INDEX  -- Safe for hostname use
businessCategoryId UUID, FK → BusinessCategory
status          TenantStatus (PROVISIONING, ACTIVE, SUSPENDED, TRIAL, CANCELLED)
planId          UUID, FK → Plan
licenseId       UUID, FK → License?
settingsId      UUID, FK → TenantSettings
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**TenantStatus values:**
- `PROVISIONING` — Tenant created but not yet active
- `ACTIVE` — Fully operational
- `SUSPENDED` — Temporarily disabled (data preserved)
- `TRIAL` — Trial period active
- `CANCELLED` — Terminated (data retention policy applies)

**Slug requirements:**
- Normalized: lowercase, hyphen-separated
- Unique globally
- Cannot contain arbitrary filesystem/path characters
- Reserved platform names blocked: `www`, `api`, `admin`, `app`, `mail`, `support`, `status`, `billing`

### TenantMembership (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL, INDEX
roleId          UUID, FK → Role, NOT NULL
status          MembershipStatus (ACTIVE, INVITED, REMOVED, SUSPENDED)
joinedAt        TIMESTAMPTZ
removedAt       TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, userId)  -- One membership per user per tenant
```
**MembershipStatus values:**
- `ACTIVE` — Member is active
- `INVITED` — Invitation sent, not yet accepted
- `REMOVED` — Removed from tenant (record preserved for audit)
- `SUSPENDED` — Temporarily suspended

**Critical rule:** A user's role in Tenant A must not automatically grant the same permissions in Tenant B. Role is per-membership.

### TenantDomain (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
hostname        STRING, UNIQUE, INDEX  -- Normalized lowercase
type            DomainType (SUBDOMAIN, CUSTOM_DOMAIN)
isPrimary       BOOLEAN, DEFAULT false
status          DomainStatus (PENDING, VERIFIED, ACTIVE, DISABLED)
verifiedAt      TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(hostname)  -- Each hostname belongs to one tenant
```
**DomainType values:**
- `SUBDOMAIN` — `tenant-slug.mmba-domain.example`
- `CUSTOM_DOMAIN` — `customer-owned-domain.com`

**DomainStatus values:**
- `PENDING` — Domain claimed but not yet verified
- `VERIFIED` — DNS verification completed
- `ACTIVE` — Verified and serving tenant data
- `DISABLED` — Domain disabled (tenant suspended, etc.)

**Hostname normalization:** Lowercase, strip trailing dots, strip `www.` prefix, validate format.

### License (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, UNIQUE  -- One active license per tenant
planId          UUID, FK → Plan, NOT NULL
licenseKeyHash  STRING  -- SHA-256 hash of license key (never store plaintext)
status          LicenseStatus (TRIAL, ACTIVE, SUSPENDED, EXPIRED, REVOKED)
issuedAt        TIMESTAMPTZ
startsAt        TIMESTAMPTZ
expiresAt       TIMESTAMPTZ?
suspendedAt     TIMESTAMPTZ?
revokedAt       TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**LicenseStatus values:**
- `TRIAL` — Trial period active
- `ACTIVE` — Fully operational
- `SUSPENDED` — Temporarily disabled
- `EXPIRED` — Expired (grace period may apply)
- `REVOKED` — Permanently revoked

**Note:** Historical licenses are retained for audit. A tenant may have multiple license records over time; only one is `UNIQUE(tenantId)` for the current active license.

### TenantSettings (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, UNIQUE
systemName      STRING
organizationName STRING
currency        STRING
autoLockMinutes INT
requireTwoFactor BOOLEAN
maintenanceMode BOOLEAN, DEFAULT false
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```
**Note:** Platform-level settings (`PlatformSettings`) exist separately. `TenantSettings` is per-tenant configuration.

## 5.3 Tenant-Owned Business Entities

Every tenant-owned entity must have a `tenantId` foreign key.

### Customer (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
code            STRING, INDEX  -- Per-tenant unique (not global)
name            STRING, NOT NULL
phone           STRING?
mobile          STRING, INDEX  -- Per-tenant unique
nationalId      STRING?
nationalCode    STRING?
email           STRING?
company         STRING?
companyName     STRING?
type            CustomerType
source          STRING?
city            STRING?
address         TEXT?
category        CustomerCategory?
status          CustomerStatus, DEFAULT ACTIVE
tags            STRING[]?
notes           TEXT?
creditLimit     DECIMAL?
assignedUserId  UUID, FK → User?
assignedUserName STRING?
leadId          UUID, FK → Lead?
leadCode        STRING?
registrationReason STRING?
registrationReasonOther STRING?
jobTitle        STRING?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, code)
UNIQUE(tenantId, mobile)
```

### Lead (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
leadCode        STRING, INDEX  -- Per-tenant unique
mobile          STRING
name            STRING?
company         STRING?
status          LeadStatus
source          STRING?
notes           TEXT?
assignedUserId  UUID, FK → User?
assignedUserName STRING?
convertedCustomerId UUID, FK → Customer?
convertedCustomerName STRING?
convertedAt     TIMESTAMPTZ?
lastContactAt   TIMESTAMPTZ?
interactionCount INT, DEFAULT 0
lastFollowUp    JSONB?
activities      JSONB?
nextFollowUpAt  TIMESTAMPTZ?
nextFollowUpTaskId UUID?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, leadCode)
UNIQUE(tenantId, mobile)
```

### Call (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
customerId      UUID, FK → Customer?
leadId          UUID, FK → Lead?
leadCode        STRING?
customerName    STRING?
customerMobile  STRING?
userId          UUID, FK → User?
userName        STRING?
callType        STRING
dateTime        TIMESTAMPTZ?
durationSeconds INT?
subject         STRING?
notes           TEXT?
customerRequest STRING?
outcome         STRING?
transcript      TEXT?
voiceTranscript TEXT?
result          String?
followUpRequired BOOLEAN, DEFAULT false
followUpDueDate TIMESTAMPTZ?
followUpDate    TIMESTAMPTZ?
followUpUserId  UUID, FK → User?
followUpUserName STRING?
followUpTaskId  UUID, FK → Task?
followUpCompleted BOOLEAN, DEFAULT false
createdAt       TIMESTAMPTZ
```

### Task (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
title           STRING, NOT NULL
description     TEXT?
customerId      UUID, FK → Customer?
leadId          UUID, FK → Lead?
assignedUserId  UUID, FK → User?
assignedUserName STRING?
sharedWithUserIds UUID[]?
sharedWithUserNames STRING[]?
creatorUserId   UUID, FK → User?
creatorUserName STRING?
priority        TaskPriority
status          TaskStatus
dueDate         TIMESTAMPTZ
reminderDate    TIMESTAMPTZ?
completedAt     TIMESTAMPTZ?
attachmentIds   STRING[]?
tags            STRING[]?
voiceNoteAudioUrl STRING?
voiceNoteDuration INT?
voiceNoteTranscript TEXT?
voiceNoteId     UUID?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### Contract (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
contractNumber  STRING, INDEX  -- Per-tenant unique
customerId      UUID, FK → Customer, NOT NULL
customerName    STRING?
customerNationalId STRING?
title           STRING, NOT NULL
type            ContractType
contractType    ContractType
startDate       TIMESTAMPTZ?
endDate         TIMESTAMPTZ?
amount          DECIMAL?
totalAmount     DECIMAL?
prepaymentAmount DECIMAL?
installmentCount INT?
status          ContractStatus
notes           TEXT?
terms           TEXT?
termsAndConditions TEXT?
attachmentIds   STRING[]?
createdById     UUID, FK → User?
createdByName   STRING?
signedAt        TIMESTAMPTZ?
simCardId       UUID, FK → SimCard?
simNumber       STRING?
saleType        SaleType
saleAmount      DECIMAL?
downPayment     DECIMAL?
financialSnapshot JSONB?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, contractNumber)
```

### Payment (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
receiptNumber   STRING, INDEX
customerId      UUID, FK → Customer, NOT NULL
customerName    STRING?
amount          DECIMAL, NOT NULL
date            TIMESTAMPTZ?
paymentDate     TIMESTAMPTZ?
description       TEXT?
method          PaymentMethod
paymentType     PaymentType
referenceNumber STRING?
status          PaymentStatus, DEFAULT PENDING
notes           TEXT?
contractId      UUID, FK → Contract?
installmentId   UUID, FK → ContractInstallment?
destinationAccount STRING?
bankName        STRING?
receiptDocumentId UUID?
referredToUserId UUID, FK → User?
referredToUserName STRING?
referredBy      STRING?
reportedByUserId UUID, FK → User?
recordedByUserId UUID, FK → User?
verifiedByUserId UUID, FK → User?
verifiedAt      TIMESTAMPTZ?
finalizedByUserId UUID, FK → User?
finalizedAt     TIMESTAMPTZ?
attachmentIds   STRING[]?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### Check (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
type            CheckType
customerId      UUID, FK → Customer, NOT NULL
customerName    STRING?
issuerName      STRING?
amount          DECIMAL, NOT NULL
bankName        STRING?
branchName      STRING?
checkNumber     STRING?
sayadNumber     STRING?
issueDate       TIMESTAMPTZ?
dueDate         TIMESTAMPTZ, NOT NULL
status          CheckStatus, DEFAULT RECEIVED
notes           TEXT?
receiverName    STRING?
drawerName      STRING?
depositDate     TIMESTAMPTZ?
clearanceDate   TIMESTAMPTZ?
attachmentIds   STRING[]?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### SimCard (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
phoneNumber     STRING, INDEX
operator        SimOperator
type            SimType
status          SimStatus
category        SimCategory?
isRound         BOOLEAN
roundCategory   STRING?
salePrice       DECIMAL?
costPrice       DECIMAL?
puk             STRING?
pukCode         STRING?
pinCode         STRING?
iccid           STRING?
customerId      UUID, FK → Customer?
customerName    STRING?
ownerCustomerId UUID, FK → Customer?
ownerCustomerName STRING?
notes           TEXT?
shelfLocation   STRING?
assignedUserId  UUID, FK → User?
activatedAt     TIMESTAMPTZ?
registeredHolderId UUID, FK → RegisteredHolder?
registeredHolderName STRING?
ownershipRegistrationDate TIMESTAMPTZ?
purchaseDate    TIMESTAMPTZ?
purchasePrice   DECIMAL?
purchasedByUserId UUID, FK → User?
saleType        SaleType
saleDescription TEXT?
soldByUserId    UUID, FK → User?
mortgageStatus  MortgageStatus?
consignmentId   UUID, FK → Consignment?
consignmentStatus ConsignmentStatus?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### Repair (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
trackingCode    STRING, INDEX
ticketNumber    STRING?
customerId      UUID, FK → Customer, NOT NULL
customerName    STRING?
customerMobile  STRING?
deviceType      STRING?
brand             STRING?
deviceModel       STRING?
model             STRING?
serialNumber      STRING?
imei              STRING?
problemDescription TEXT, NOT NULL
status            RepairStatus
diagnosis         TEXT?
workPerformed     TEXT?
partsUsed         JSONB?
estimatedCost     DECIMAL, NOT NULL
finalCost         DECIMAL?
completionDate    TIMESTAMPTZ?
deliveredDate     TIMESTAMPTZ?
customerApproved  BOOLEAN
warrantyPeriodDays INT?
createdAt         TIMESTAMPTZ
updatedAt         TIMESTAMPTZ
UNIQUE(tenantId, trackingCode)
```

### Account (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
code            STRING, INDEX  -- Per-tenant unique
name            STRING, NOT NULL
account_type    AccountType
is_active       BOOLEAN, DEFAULT true
parent_id       UUID, FK → Account?
description     TEXT?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, code)
```

### JournalEntry (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
entry_number    INT, INDEX  -- Per-tenant sequential
entry_date      TIMESTAMPTZ, NOT NULL
description     TEXT, NOT NULL
reference_type  String?
reference_id    UUID?
status          JournalEntryStatus, DEFAULT POSTED
created_by      UUID, FK → User?
created_by_name STRING?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, entry_number)
```

### JournalEntryLine (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
journal_entry_id UUID, FK → JournalEntry, NOT NULL, INDEX
account_id      UUID, FK → Account, NOT NULL
debit           DECIMAL, DEFAULT 0
credit          DECIMAL, DEFAULT 0
description     TEXT?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### AccountingPeriod (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
period          STRING, INDEX  -- e.g., "1403"
start_date      TIMESTAMPTZ, NOT NULL
end_date        TIMESTAMPTZ, NOT NULL
status          AccountingPeriodStatus, DEFAULT OPEN
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, period)
```

### Attachment (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
customerId      UUID, FK → Customer?
customerName    STRING?
storageKey      STRING, NOT NULL  -- e.g., "tenants/{tenantId}/attachments/{id}/file.ext"
originalFilename STRING, NOT NULL
mimeType        STRING, NOT NULL
sizeBytes       INT, NOT NULL
checksum        STRING?  -- SHA-256 of file content
dataUrl         TEXT?  -- For development; production uses storageKey only
uploadedAt      TIMESTAMPTZ
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### VoiceNote (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
storageKey      STRING, NOT NULL  -- e.g., "tenants/{tenantId}/voice-notes/{id}.{ext}"
audioDataUrl    TEXT?  -- For development
mimeType        STRING, NOT NULL
fileName        STRING?
durationSeconds INT?
transcription   TEXT?
category        VoiceNoteCategory
tags            STRING[]?
customerId      UUID, FK → Customer?
relatedEntityId UUID?
relatedEntityType String?
createdById     UUID, FK → User?
createdByName   STRING?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### Notification (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL, INDEX
title           STRING, NOT NULL
message         TEXT
body            TEXT?
category        STRING?
priority        STRING, DEFAULT NORMAL
read            BOOLEAN, DEFAULT false
snoozedUntil    TIMESTAMPTZ?
relatedEntityType String?
relatedEntityId UUID?
relatedCustomerName STRING?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### AuditLog (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
timestamp       TIMESTAMPTZ, NOT NULL
userId          UUID, FK → User, NOT NULL
userName        STRING, NOT NULL
userRole        UserRole, NOT NULL
action          STRING, NOT NULL
module          ModuleName, NOT NULL
entityType      String?
entityName      STRING?
targetId        UUID?
targetType      String?
details         TEXT?
ipAddress       STRING?
fieldName       STRING?
oldValue        JSONB?
newValue        JSONB?
result          String, DEFAULT SUCCESS
requestId       UUID?
createdAt       TIMESTAMPTZ
```
**Note:** Platform admins can query all tenants' audit logs. Tenant admins can only see their own tenant's audit logs.

## 5.4 Chat / Messaging Entities

### ChatConversation (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
type            ConversationType, NOT NULL
title           STRING?
priority        ConversationPriority, DEFAULT NORMAL
status          ConversationStatus, DEFAULT ACTIVE
createdById     UUID, FK → User, NOT NULL
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### ConversationMember (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
conversationId  UUID, FK → ChatConversation, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL
role            ChatMemberRole, NOT NULL  -- MEMBER, ADMIN, OWNER
joinedAt        TIMESTAMPTZ
leftAt          TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
UNIQUE(conversationId, userId)
```

### ChatMessage (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
conversationId  UUID, FK → ChatConversation, NOT NULL, INDEX
senderId        UUID, FK → User, NOT NULL
content         TEXT, NOT NULL
status          MessageStatus, DEFAULT SENT
isRead          BOOLEAN, DEFAULT false
isDeleted       BOOLEAN, DEFAULT false
attachments     JSONB?  -- MessageAttachmentRef[]
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### MessageAttachment (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
messageId       UUID, FK → ChatMessage, NOT NULL, INDEX
attachmentId    UUID, FK → Attachment, NOT NULL
createdAt       TIMESTAMPTZ
```

### MessageReaction (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
messageId       UUID, FK → ChatMessage, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL
emoji           STRING, NOT NULL
createdAt       TIMESTAMPTZ
UNIQUE(messageId, userId, emoji)
```

### ChatMessageReadReceipt (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
messageId       UUID, FK → ChatMessage, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL
readAt          TIMESTAMPTZ, NOT NULL
UNIQUE(messageId, userId)
```

### Broadcast (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
title           STRING, NOT NULL
body            TEXT, NOT NULL
status          BroadcastStatus, DEFAULT DRAFT
createdById     UUID, FK → User, NOT NULL
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### BroadcastRecipient (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
broadcastId     UUID, FK → Broadcast, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL
status          BroadcastRecipientStatus, DEFAULT PENDING
sentAt          TIMESTAMPTZ?
deliveredAt     TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
UNIQUE(broadcastId, userId)
```

### TypingIndicator (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
conversationId  UUID, FK → ChatConversation, NOT NULL
userId          UUID, FK → User, NOT NULL
isTyping        BOOLEAN, DEFAULT true
timestamp       TIMESTAMPTZ, NOT NULL
```

## 5.5 Other Tenant-Owned Entities

### DateSuggestion (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
customerId      UUID, FK → Customer, NOT NULL
jalaliDate      STRING, NOT NULL
operatorId      UUID, FK → User, NOT NULL
operatorName    STRING, NOT NULL
activityType    String, NOT NULL
result          STRING?
nextFollowUpDate TIMESTAMPTZ?
nextFollowUpJalali STRING?
taskId          UUID, FK → Task?
metadata        JSONB?
createdAt       TIMESTAMPTZ
```

### ShareableLink (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
token           STRING, UNIQUE, NOT NULL
relatedEntityId UUID, NOT NULL
relatedEntityType String, NOT NULL
accessCount     INT, DEFAULT 0
isRevoked       BOOLEAN, DEFAULT false
createdById     UUID, FK → User, NOT NULL
createdAt       TIMESTAMPTZ
```

### ProblemReport (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
title           STRING, NOT NULL
description     TEXT, NOT NULL
status          ProblemReportStatus
priority        ProblemReportPriority
screenshotUrl   STRING?
submittedById   UUID, FK → User, NOT NULL
assignedToId    UUID, FK → User?
resolutionNotes TEXT?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### DocumentShare (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
documentId      UUID, NOT NULL
documentType    STRING, NOT NULL
sharedWith      UUID[], NOT NULL  -- User IDs
status          DocumentShareStatus, DEFAULT PENDING
createdById     UUID, FK → User, NOT NULL
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### RegisteredHolder (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
fullName        STRING, NOT NULL
nationalId      STRING, NOT NULL
mobile          STRING, NOT NULL
shebaNumber     STRING?
activeSimCount  INT?
maxCapacity     INT?
remainingCapacity INT?
isAtCapacity    BOOLEAN
birthDate       TIMESTAMPTZ?
address         TEXT?
notes           TEXT?
isActive        BOOLEAN, DEFAULT true
nationalIdImageUrl STRING?
nationalIdImageName STRING?
nationalIdImageSize INT?
nationalIdImageType STRING?
nationalIdImageUploadedBy UUID, FK → User?
nationalIdImageUploadedAt TIMESTAMPTZ?
createdById     UUID, FK → User?
isDeleted       BOOLEAN, DEFAULT false
deletedBy       UUID, FK → User?
deletedAt       TIMESTAMPTZ?
deleteReason    TEXT?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### ContractInstallment (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
contractId      UUID, FK → Contract, NOT NULL, INDEX
simCardId       UUID, FK → SimCard?
simNumber       STRING?
customerId      UUID, FK → Customer, NOT NULL
customerName    STRING?
installmentNumber INT, NOT NULL
dueDate         TIMESTAMPTZ, NOT NULL
principalAmount DECIMAL, NOT NULL
commissionAmount DECIMAL, NOT NULL
totalDue        DECIMAL, NOT NULL
totalAmount     DECIMAL?
paidAmount      DECIMAL, DEFAULT 0
remainingAmount DECIMAL, NOT NULL
status          InstallmentStatus, DEFAULT PENDING
notes           TEXT?
repaymentMethod STRING?
checkNumber     STRING?
bankName        STRING?
destinationAccount STRING?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, contractId, installmentNumber)
```

### UserNotificationDevice (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL, INDEX
pushEndpoint    STRING, NOT NULL, INDEX
deviceName      STRING, NOT NULL
browser         STRING?
platform        DevicePlatform?
enabled         BOOLEAN, DEFAULT true
lastSeenAt      TIMESTAMPTZ?
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
UNIQUE(tenantId, userId, pushEndpoint)
```

### NotificationDelivery (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
notificationId  UUID, FK → Notification, NOT NULL, INDEX
userId          UUID, FK → User, NOT NULL
channel         DeliveryChannel, NOT NULL
status          DeliveryStatus, DEFAULT PENDING
sentAt          TIMESTAMPTZ?
deliveredAt     TIMESTAMPTZ?
failedAt        TIMESTAMPTZ?
errorMessage    TEXT?
createdAt       TIMESTAMPTZ
```

### NotificationSettings (USER)
```
id              UUID (PK)
userId          UUID, FK → User, NOT NULL, UNIQUE
enableNotifications BOOLEAN, DEFAULT true
enableSound     BOOLEAN, DEFAULT true
soundVolume     INT, DEFAULT 80
soundChime      STRING, DEFAULT 'crystal'
quietHoursEnabled BOOLEAN, DEFAULT false
quietHoursStart STRING, DEFAULT '22:00'
quietHoursEnd   STRING, DEFAULT '07:30'
defaultSnoozeMinutes INT, DEFAULT 15
createdAt       TIMESTAMPTZ
updatedAt       TIMESTAMPTZ
```

### TrustedBiometricDevice (USER)
```
id              UUID (PK)
userId          UUID, FK → User, NOT NULL, INDEX
credentialId    STRING, NOT NULL
deviceName      STRING, NOT NULL
deviceType      DevicePlatform, NOT NULL
userAgent       STRING?
createdAt       TIMESTAMPTZ
lastUsedAt      TIMESTAMPTZ?
isRevoked       BOOLEAN, DEFAULT false
revokedAt       TIMESTAMPTZ?
publicKey       STRING?
UNIQUE(userId, credentialId)
```

### LeadActivity (TENANT)
```
id              UUID (PK)
tenantId        UUID, FK → Tenant, NOT NULL
leadId          UUID, FK → Lead, NOT NULL, INDEX
type            LeadActivityType, NOT NULL
result          STRING, NOT NULL
operatorId      UUID, FK → User, NOT NULL
operatorName    STRING, NOT NULL
createdAt       TIMESTAMPTZ
jalaliDate      STRING?
nextFollowUpDate TIMESTAMPTZ?
nextFollowUpJalali STRING?
taskId          UUID, FK → Task?
metadata        JSONB?
```

---

# 6. RELATIONSHIP DIAGRAM

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              PLATFORM                                       │
│                                                                             │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────────────┐│
│  │  Plan    │  │ BusinessCat  │  │   Role        │  │   PlatformAdmin  ││
│  │          │  │              │  │               │  │                  ││
│  │ id PK    │  │ id PK        │  │ id PK         │  │ id PK            ││
│  │ key UNIQ │  │ key UNIQ     │  │ name UNIQ     │  │ userId FK        ││
│  │ name     │  │ name         │  │ titleFa       │  │ platformRole     ││
│  │ status   │  │ isActive     │  │ permissions   │  │ createdAt        ││
│  └────┬─────┘  └──────┬───────┘  └───────┬───────┘  └──────────────────┘│
│       │               │                  │                                  │
│       │ 1:N           │ 1:N              │                                  │
│       ▼               ▼                  │                                  │
│  ┌──────────┐  ┌──────────────┐          │                                  │
│  │ Entitlement│ │ TenantDomain │◄─────────┤ (Platform hosts domains)       │
│  │          │  │              │          │                                  │
│  │ planId FK│  │ id PK        │          │                                  │
│  │ module   │  │ tenantId FK  │          │                                  │
│  │ action   │  │ hostname UNIQ│          │                                  │
│  │ limitVal │  │ type         │          │                                  │
│  │ isEnabled│  │ isPrimary    │          │                                  │
│  └────┬─────┘  └──────┬───────┘          │                                  │
│       │               │                   │                                  │
└───────┼───────────────┼───────────────────┼──────────────────────────────────┘
        │               │                   │
        │ 1:N           │ 1:N               │
        ▼               ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                                TENANT                                      │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ Tenant                                                            │    │
│  │ ├── id PK                                                          │    │
│  │ ├── name                                                           │    │
│  │ ├── slug UNIQ, INDEX                                              │    │
│  │ ├── businessCategoryId FK ──→ BusinessCategory                    │    │
│  │ ├── planId FK ──→ Plan                                            │    │
│  │ ├── status                                                        │    │
│  │ ├── createdAt / updatedAt                                         │    │
│  │ └── settingsId FK ──→ TenantSettings                              │    │
│  └───────────────────────────┬───────────────────────────────────────┘    │
│                              │                                              │
│              ┌───────────────┼───────────────────────┐                     │
│              │ 1:N           │ 1:N                    │ 1:1                  │
│              ▼               ▼                        ▼                      │
│  ┌──────────────┐  ┌────────────────┐  ┌──────────────────┐               │
│  │ TenantDomain │  │ License        │  │ TenantSettings   │               │
│  │              │  │                │  │                  │               │
│  │ tenantId FK  │  │ tenantId UNIQ  │  │ tenantId UNIQ    │               │
│  │ hostname UNIQ│  │ planId FK      │  │ systemName       │               │
│  │ type         │  │ licenseKeyHash │  │ organizationName │               │
│  │ isPrimary    │  │ status         │  │ currency         │               │
│  │ status       │  │ expiresAt      │  │ autoLockMinutes  │               │
│  │ verifiedAt   │  │ createdAt      │  │ require2FA       │               │
│  └──────────────┘  └───────┬────────┘  └──────────────────┘               │
│                            │                                                │
│              ┌─────────────┼─────────────────────┐                         │
│              │ 1:N           │ 1:N                    │ 1:N                  │
│              ▼               ▼                        ▼                      │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │ TenantMembership                                                  │    │
│  │ ├── id PK                                                          │    │
│  │ ├── tenantId FK ──→ Tenant, NOT NULL, INDEX                       │    │
│  │ ├── userId FK ──→ User, NOT NULL, INDEX                           │    │
│  │ ├── roleId FK ──→ Role, NOT NULL                                  │    │
│  │ ├── status (ACTIVE, INVITED, REMOVED, SUSPENDED)                  │    │
│  │ ├── joinedAt / removedAt                                           │    │
│  │ └── UNIQUE(tenantId, userId)                                       │    │
│  └───────────────────────────┬───────────────────────────────────────┘    │
│                              │                                              │
└──────────────────────────────┼──────────────────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │ 1:N (every entity)  │ 1:N (every entity)  │ 1:N (every entity)
         ▼                     ▼                     ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  ALL TENANT     │  │  ALL TENANT     │  │  ALL TENANT     │
│  ENTITIES       │  │  ENTITIES       │  │  ENTITIES       │
│                 │  │                 │  │                 │
│  Customer       │  │  ChatMessage    │  │  Payment        │
│  Lead           │  │  ChatConversation│ │  Attachment     │
│  Task           │  │  Broadcast      │  │  Account        │
│  Contract       │  │  Notification   │  │  JournalEntry   │
│  SimCard        │  │  AuditLog       │  │  AccountingPeriod│
│  Repair         │  │  DateSuggestion │  │  ...            │
│  ...            │  │  ...            │  │  ...            │
│                 │  │                 │  │                 │
│  ALL have:      │  │  ALL have:      │  │  ALL have:      │
│  tenantId FK    │  │  tenantId FK    │  │  tenantId FK    │
│  + createdAt    │  │  + createdAt    │  │  + createdAt    │
│  + updatedAt    │  │  + updatedAt    │  │  + updatedAt    │
└─────────────────┘  └─────────────────┘  └─────────────────┘

USER (GLOBAL)
  │
  └── 1:N ──→ TenantMembership ──→ Tenant
  │
  └── 1:N ──→ UserNotificationDevice
  │
  └── 1:1 ──→ NotificationSettings
  │
  └── 1:N ──→ TrustedBiometricDevice
```

---

# 7. TENANT ISOLATION MODEL

## 7.1 Server-Side Request Flow

```
HTTP Request (HTTPS)
     │
     ▼
Security / Request ID (loggerMiddleware)
     │  - X-Request-Id sanitized or crypto.randomUUID()
     │  - Structured log with requestId
     ▼
Tenant Resolution Middleware (NEW)
     │  1. Extract hostname from Host header
     │  2. Normalize hostname (lowercase, strip trailing dot)
     │  3. Validate against TenantDomain whitelist
     │  4. Reject malformed/unknown hostnames
     │  5. Set req.tenantId = resolved tenant.id
     │  6. Set req.tenantSlug = resolved tenant.slug
     │
     │  IMPORTANT: tenantId comes from hostname, NOT from request body
     ▼
Authentication
     │  - Extract JWT from Authorization header
     │  - Verify signature, expiry, tokenVersion
     │  - Set req.authUser
     ▼
Membership Verification
     │  - Query TenantMembership where userId = req.authUser.id
     │    AND tenantId = req.tenantId
     │  - Verify membership status = ACTIVE
     │  - Set req.tenantRole = membership.roleId
     │  - Set req.tenantMembership = membership record
     │  - If no active membership → 403 Forbidden
     ▼
Authorization
     │  - requirePermission(module, action) — role-based
     │  - Verify user has the required role permission
     │  - For resource access: verify resource.tenantId === req.tenantId
     │  - If not → 403 Forbidden (or 404 for IDOR protection)
     ▼
Tenant-Scoped Service Layer
     │  - Every database query MUST include WHERE tenantId = req.tenantId
     │  - Use Prisma `tenantId` filter on every query
     │  - NEVER use raw findById without tenantId filter
     ▼
PostgreSQL
     │  - All queries include tenantId in WHERE clause
     │  - Optionally: PostgreSQL Row-Level Security (RLS) as backup
     │  - Composite indexes on (tenantId, ...) for performance
```

## 7.2 Critical Rule: Tenant Context from Trusted Source Only

**The server must NEVER trust client-provided tenant identifiers.** The effective tenant is derived exclusively from:

1. **Hostname resolution** (primary) — `TenantDomain` lookup from `Host` header
2. **Authenticated membership** (secondary) — `TenantMembership` record verified against the resolved tenant

**Never allow:**
```ts
// FORBIDDEN: client-provided tenantId
const tenantId = req.body.tenantId;
const tenantId = req.query.tenantId;
const tenantId = req.headers['x-tenant-id'];
```

**Always derive:**
```ts
// REQUIRED: server-derived tenant context
const tenantId = req.tenantId;  // Set by Tenant Resolution Middleware
const membership = req.tenantMembership;  // Verified against req.authUser
```

## 7.3 Platform Admin Access

Platform admins can:
- View all tenants' metadata (not financial data by default)
- Manage plans, categories, licenses
- Suspend/activate tenants
- Access platform-level audit logs

Platform admin access to tenant data must be:
- **Explicitly authorized** — not automatic
- **Strongly audited** — every access logged
- **Time-bounded** — if impersonation is ever supported

---

# 8. HOSTNAME RESOLUTION MODEL

## 8.1 Request → Tenant Resolution

```
Host header
     │
     ▼
Normalize hostname
     │  - Convert to lowercase
     │  - Strip trailing dot
     │  - Strip "www." prefix (if applicable)
     │  - Validate format: [a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*
     │  - Reject if malformed
     ▼
Lookup TenantDomain
     │  - WHERE hostname = normalized AND status = ACTIVE
     │  - Reject if not found
     ▼
Resolve Tenant
     │  - JOIN TenantDomain → Tenant
     │  - Verify Tenant.status = ACTIVE (or TRIAL)
     │  - Reject if suspended/cancelled
     ▼
Set req.tenantId = Tenant.id
```

## 8.2 Reserved Slug Check

Before accepting a tenant slug, verify it is not in the reserved list:
```ts
const RESERVED_SLUGS = ['www', 'api', 'admin', 'app', 'mail', 'support', 'status', 'billing', 'cdn', 'static', 'assets', 'vite', 'dist'];
```

## 8.3 Tenant Enumeration Protection

**Do not leak whether a tenant exists.** For unknown hostnames, return the same response as for known-but-inactive tenants. Do not distinguish between "this hostname does not belong to any tenant" and "this tenant is suspended."

---

# 9. AUTHENTICATION / MEMBERSHIP MODEL

## 9.1 Extended Authentication Context

Current: `authenticated user`

Target: `authenticated user + active tenant + membership + permissions + platform privileges`

```ts
interface AuthContext {
  userId: string;
  tenantId: string;
  tenantSlug: string;
  membershipId: string;
  membershipStatus: MembershipStatus;
  roleId: string;
  roleName: UserRole;
  permissions: Permission[];
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
}
```

## 9.2 JWT Payload

The JWT should NOT become a giant mutable tenant database. Options:

**Option A (Recommended):** Include `tenantId` in JWT payload, resolve full membership from database on each request.
```json
{
  "userId": "usr-abc123",
  "tenantId": "ten-xyz789",
  "roleId": "role-def456",
  "iat": 1234567890,
  "exp": 1234567890 + 86400,
  "tokenVersion": 5
}
```

**Option B:** Include `tenantId` in a short-lived claim, use a controlled tenant-switch endpoint for multi-tenant users.

**If users can belong to multiple tenants:**
- The active tenant is determined by hostname resolution, NOT by client choice
- A tenant-switch endpoint can be used, but must verify the user has a `TenantMembership` for the target tenant
- The JWT must be re-issued when switching tenants

## 9.3 Login Flow (Multi-Tenant)

```
POST /auth/login { usernameOrEmail, password }
     │
     ▼
Resolve tenant from hostname (or default tenant for development)
     │
     ▼
Find user by credential
     │
     ▼
Verify user exists in TenantMembership for resolved tenant
     │  - If no membership → 403 Forbidden
     │  - If membership.status ≠ ACTIVE → 403 Forbidden
     │
     ▼
Verify password (bcrypt)
     │
     ▼
Check user.status, membership.status, tenant.status
     │  - If any not ACTIVE → 403 Forbidden
     │
     ▼
Sign JWT with tenantId embedded in payload
     │
     ▼
Return token + user info + tenant info
```

## 9.4 Logout Flow

```
POST /auth/logout
     │
     ▼
Increment authUser.tokenVersion (invalidates all tokens for this user)
     │
     ▼
Optional: Delete all active sessions for the user
     │
     ▼
Return 204
```

---

# 10. LICENSE / PLAN MODEL

## 10.1 Relationship

```
Tenant
  │
  ├── License (1:1, current active)
  │      ├── planId → Plan
  │      ├── status (TRIAL, ACTIVE, SUSPENDED, EXPIRED, REVOKED)
  │      ├── startsAt, expiresAt
  │      └── licenseKeyHash
  │
  └── BusinessCategory → BusinessCategory (reference)
```

## 10.2 Plan → Entitlement Relationship

```
Plan
  └── Entitlement (1:N)
         ├── module: ModuleName
         ├── action: PermissionAction
         ├── limitType: FEATURE | NUMERIC | QUOTA | MODULE_ACCESS
         ├── limitValue: DECIMAL?
         └── isEnabled: BOOLEAN
```

## 10.3 License Validation Flow

```
Every API Request
     │
     ▼
Tenant Resolution → req.tenantId
     │
     ▼
License Check
     │  - Find active license for tenantId
     │  - If no license → 403 Forbidden
     │  - If status = EXPIRED → 403 Forbidden (or read-only)
     │  - If status = SUSPENDED → 403 Forbidden
     │  - If status = REVOKED → 403 Forbidden
     │  - If expiresAt < now → 403 Forbidden
     │
     ▼
Entitlement Check (if feature-specific)
     │  - Does the tenant's plan include this module?
     │  - Has the tenant reached any numeric limits?
     │
     ▼
Proceed or 403
```

**Future:** License validation must happen server-side. The frontend must never be trusted to decide whether a license is valid.

**Do not implement billing/payment processing in this architecture task.**

---

# 11. EXISTING JSON MIGRATION

## 11.1 Migration Strategy

```
JSON backup (current mmba_production_database.json)
     │
     ▼
Validation (verify data integrity, counts, relationships)
     │
     ▼
Transform (map global records to tenant-scoped records)
     │
     ▼
PostgreSQL staging/import
     │
     ▼
Relationship validation (foreign keys, orphan detection)
     │
     ▼
Tenant assignment validation (every record has tenantId)
     │
     ▼
Production cutover
```

## 11.2 Existing Data Tenant Mapping

**Required decision:** Which tenant owns the existing data?

**Proposed approach:** Create one initial tenant that owns all existing data. The existing `usr-admin` user becomes a membership of that tenant with platform-admin role.

```text
Existing database
      ↓
Create initial tenant (e.g., slug: "main", name: "Main Organization")
      ↓
Assign all existing customer, lead, call, task, contract, payment, etc. records to this tenant
      ↓
Assign existing users as memberships in this tenant
      ↓
Assign existing `usr-admin` as platform admin + membership owner
```

**This must be explicitly documented and audited.** Do not silently create multiple tenants from guesses.

**If the repository does not contain enough information to determine ownership, stop and report the ambiguity.**

## 11.3 Data Transformation Mapping

| Current JSON Field | PostgreSQL Table | Transformation |
|---|---|---|
| `users[]` | `users` | Keep global; add `tenantId` via membership |
| `roles[]` | `roles` | Keep global; no tenantId |
| `customers[]` | `customers` | Add `tenantId` = initial tenant; `code` becomes per-tenant unique |
| `leads[]` | `leads` | Add `tenantId`; `leadCode` becomes per-tenant unique |
| `calls[]` | `calls` | Add `tenantId` |
| `interactions[]` | `interactions` | Add `tenantId` |
| `tasks[]` | `tasks` | Add `tenantId` |
| `contracts[]` | `contracts` | Add `tenantId`; `contractNumber` becomes per-tenant unique |
| `payments[]` | `payments` | Add `tenantId` |
| `checks[]` | `checks` | Add `tenantId` |
| `sims[]` | `sims` | Add `tenantId` |
| `repairs[]` | `repairs` | Add `tenantId`; `trackingCode` becomes per-tenant unique |
| `accounts[]` | `accounts` | Add `tenantId`; `code` becomes per-tenant unique |
| `journalEntries[]` | `journal_entries` | Add `tenantId`; `entry_number` becomes per-tenant unique |
| `journalEntryLines[]` | `journal_entry_lines` | Add `tenantId` |
| `accountingPeriods[]` | `accounting_periods` | Add `tenantId`; `period` becomes per-tenant unique |
| `attachments[]` | `attachments` | Add `tenantId`; convert `dataUrl` to `storageKey` |
| `voiceNotes[]` | `voice_notes` | Add `tenantId`; convert `audioDataUrl` to `storageKey` |
| `notifications[]` | `notifications` | Add `tenantId` |
| `auditLogs[]` | `audit_logs` | Add `tenantId` (derive from user membership) |
| `conversations[]` | `chat_conversations` | Add `tenantId` |
| `chatMessages[]` | `chat_messages` | Add `tenantId` |
| `settings` | `tenant_settings` | Split: platform settings vs. tenant settings |
| `userNotificationDevices[]` | `user_notification_devices` | Add `tenantId` |
| `notificationDeliveries[]` | `notification_deliveries` | Add `tenantId` |

## 11.4 Reconciliation Requirements

Compare source vs PostgreSQL for every entity:
- **Entity counts must match** (source count == PostgreSQL count)
- **Financial totals must reconcile exactly**
- **Foreign key relationships must be valid** (no orphaned references)
- **No duplicate IDs** after migration
- **Every record has `tenantId` assigned**

---

# 12. MIGRATION / ROLLBACK PLAN

## 12.1 Staged Migration

### Stage 1: Infrastructure
- Set up PostgreSQL instance (Docker Compose for dev)
- Install Prisma, initialize `prisma/schema.prisma`
- Create `prisma/migrations/` directory structure
- Set up `prisma/seed.ts` with development seed data

### Stage 2: Schema
- Define all entities in `prisma/schema.prisma`
- Run `prisma migrate dev` to create initial migration
- Run `prisma generate` to generate Prisma client
- Open Prisma Studio (`prisma studio`) to verify schema

### Stage 3: Parallel Store
- Introduce Prisma/PostgreSQL alongside the existing JSON store
- Application must support reading from either source (feature flag)
- No data loss; JSON remains the source of truth

### Stage 4: Import
- Build importer script (`prisma/seed/import.ts`)
- Import existing JSON data into PostgreSQL staging database
- Run reconciliation: entity counts, financial totals, relationships
- Fix any discrepancies

### Stage 5: Application Integration
- Update data access layer to use Prisma client
- Add `tenantId` to all queries
- Implement tenant resolution middleware
- Run application against PostgreSQL in controlled environment

### Stage 6: Isolation Tests
- Run cross-tenant IDOR tests (Section 34)
- Verify Tenant A cannot access Tenant B data
- Run performance benchmarks with tenant-scoped indexes

### Stage 7: Production Cutover
- Only after all tests pass
- Full backup of JSON database before cutover
- Production migration (`prisma migrate deploy`)
- Verify production data
- Monitor for issues

### Stage 8: JSON Archive
- Keep JSON database file intact and archived
- No deletion until migration is proven stable
- Document rollback procedure

## 12.2 Rollback Procedure

If PostgreSQL migration fails at any stage:
1. Keep JSON application intact
2. PostgreSQL migration was tested separately
3. No production cutover until:
   - Migration succeeds
   - Reconciliation succeeds
   - Isolation tests pass
   - Application smoke tests pass
   - Backup exists
   - Rollback path is documented

**Never run `prisma migrate reset` against production.**

## 12.3 Prisma Migration Policy

- **Do not edit an already-applied migration in place**
- Use new migrations for schema changes
- Production migrations must be reviewed before execution
- **Never run destructive reset commands against production**
- Document commands:
  ```bash
  prisma migrate dev        # Development: create and apply migrations
  prisma migrate deploy     # Production: apply pending migrations
  prisma generate           # Generate Prisma client
  prisma studio             # Open Prisma Studio for inspection
  ```

---

# 13. INDEX STRATEGY

## 13.1 Tenant-Owned Table Compound Indexes

| Table | Index | Justification |
|---|---|---|
| `customers` | `(tenantId, id)` | Primary lookup by tenant + ID |
| `customers` | `(tenantId, mobile)` | Fast phone lookup within tenant |
| `customers` | `(tenantId, code)` | Fast code lookup within tenant |
| `leads` | `(tenantId, id)` | Primary lookup |
| `leads` | `(tenantId, mobile)` | Fast phone lookup |
| `leads` | `(tenantId, leadCode)` | Fast lead code lookup |
| `payments` | `(tenantId, customerId)` | Financial reports by customer |
| `payments` | `(tenantId, status)` | Filter by payment status |
| `contracts` | `(tenantId, customerId)` | Contracts by customer |
| `contracts` | `(tenantId, contractNumber)` | Contract number lookup |
| `accounts` | `(tenantId, code)` | Account lookup by code |
| `journalEntries` | `(tenantId, entry_number)` | Entry number lookup |
| `journalEntries` | `(tenantId, entry_date)` | Date-range queries |
| `attachments` | `(tenantId, customerId)` | Attachments by customer |
| `voiceNotes` | `(tenantId, customerId)` | Voice notes by customer |
| `chat_messages` | `(tenantId, conversationId)` | Messages by conversation |
| `notifications` | `(tenantId, userId)` | Notifications by user |
| `auditLogs` | `(tenantId, timestamp)` | Audit log queries by time |
| `tenant_memberships` | `(tenantId, userId)` | Membership lookup |
| `tenant_memberships` | `(userId, tenantId)` | User's memberships |
| `tenant_domains` | `(hostname)` | Hostname resolution |
| `tenant_domains` | `(tenantId, type)` | Tenant's domains |
| `license` | `(tenantId)` | Active license lookup |
| `tasks` | `(tenantId, assignedUserId)` | Tasks assigned to user |
| `tasks` | `(tenantId, status)` | Tasks by status |
| `calls` | `(tenantId, customerId)` | Calls by customer |
| `sims` | `(tenantId, phoneNumber)` | SIM lookup by phone |
| `repairs` | `(tenantId, trackingCode)` | Repair lookup |
| `contract_installments` | `(tenantId, contractId)` | Installments by contract |
| `conversation_members` | `(conversationId, userId)` | Conversation participant lookup |
| `broadcast_recipients` | `(broadcastId, userId)` | Broadcast recipient lookup |

## 13.2 Global Table Indexes

| Table | Index | Justification |
|---|---|---|
| `users` | `(username)` | Login lookup |
| `users` | `(email)` | Login lookup |
| `users` | `(mobile)` | Login lookup |
| `roles` | `(name)` | Role lookup |
| `plans` | `(key)` | Plan lookup |
| `business_categories` | `(key)` | Category lookup |
| `tenants` | `(slug)` | Tenant resolution |
| `tenant_domains` | `(hostname)` | **Unique** — hostname resolution |

---

# 14. SECURITY MODEL

## 14.1 IDOR/BOLA Prevention

The architecture eliminates patterns like `findById(id)` for tenant-owned records.

**Preferred pattern:**
```ts
// Prisma-based repository pattern
const customer = await prisma.customer.findFirst({
  where: {
    id: customerId,
    tenantId: req.tenantId,  // ALWAYS included
  },
});

if (!customer) return res.status(404).json({ error: 'NOT_FOUND' });
```

**Repository abstraction** (recommended):
```ts
// tenantDb(currentTenant).customers.find(...)
// or
// customerService.getById({ tenantId, customerId })
```

**Every query must include `tenantId`.** Build the Prisma client layer to make this difficult to forget.

## 14.2 Tenant Enumeration Protection

- Unknown hostnames return the same response as suspended tenants
- Do not distinguish "no tenant" from "tenant suspended" in error messages
- HTTP status codes should not reveal tenant existence (use 404 instead of 403 when appropriate)

## 14.3 Host Header Protection

- Validate `Host` header against `TenantDomain` whitelist
- Reject malformed hostnames
- Respect trusted proxy configuration (`TRUST_PROXY` env var)
- Never trust arbitrary forwarded host headers unless proxy is trusted
- Distinguish local development hosts from production hosts

## 14.4 Cross-Tenant File Access Prevention

- `Attachment.tenantId` must match `req.tenantId` on every access
- Storage keys must include `tenantId` (e.g., `tenants/{tenantId}/attachments/{id}`)
- Download authorization must verify both `tenantId` and user membership
- SVGs served as `attachment` disposition (existing protection preserved)

## 14.5 Cross-Tenant Chat Access Prevention

- `ChatMessage.tenantId` must match `req.tenantId`
- `ChatConversation` access requires `ConversationMember` record for the user
- Message query must join through `conversation_members` to verify participation

## 14.6 Cross-Tenant Financial Access Prevention

- All financial records (`Payment`, `Check`, `Account`, `JournalEntry`) must have `tenantId`
- Financial reports must filter by `tenantId`
- Platform admins must be explicitly authorized to view other tenants' financial data

## 14.7 Cross-Tenant Audit Access Prevention

- `AuditLog.tenantId` must be set on every record
- Tenant admins see only their tenant's audit logs
- Platform admins see all tenants' audit logs (explicit authorization required)

## 14.8 Privilege Escalation Prevention

- Platform admins cannot automatically access tenant data
- Tenant admin role does not grant platform admin access
- Membership status must be verified on every request
- `tokenVersion` revocation works globally per-user (not per-tenant)

## 14.9 Stale Session Prevention

- `tokenVersion` bump invalidates all tokens for the user across all tenants
- If user is removed from `TenantMembership` (status = REMOVED), their access to that tenant must be revoked
- Session expiry handled by JWT `exp` claim

## 14.10 License Bypass Prevention

- License check happens server-side on every request
- Frontend must never decide license validity
- License status checked before any business operation
- Expired/suspended/revoked licenses block access

## 14.11 Platform/Tenant Privilege Confusion Prevention

- `PlatformAdmin` and `TenantMembership` are separate concepts
- A user can be both a platform admin and a tenant member — these are distinct authorization contexts
- Platform operations require `PlatformAdmin` role
- Tenant operations require `TenantMembership` with appropriate role

---

# 15. PRISMA STUDIO WORKFLOW

## 15.1 Development Commands

```bash
# Start PostgreSQL via Docker Compose (if used)
npm run db:dev

# Create and apply a new migration
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Open Prisma Studio
npx prisma studio

# Reset database in development only
npx prisma migrate reset

# Deploy pending migrations to production
npx prisma migrate deploy

# Seed development data
npx tsx prisma/seed.ts
```

## 15.2 Prisma Studio Inspection Guide

Use Prisma Studio to inspect:
- **Tenants** — Verify tenant creation, slug uniqueness, status
- **Users** — Verify global user records
- **Memberships** — Verify user-tenant-role mappings
- **Customers** — Verify tenant-scoped customer records
- **Accounting** — Verify journal entries, balances, period integrity
- **Audit Logs** — Verify tenant-scoped audit records
- **Relationships** — Verify foreign key integrity

**Do not expose Prisma Studio directly to the public internet.**

---

# 16. TEST STRATEGY

## 16.1 Cross-Tenant Isolation Tests

The architecture is not complete until the test strategy can prove:
```
Tenant A user
     X
Tenant B customer
```

### Test Cases

| Test | Action | Expected Result |
|------|--------|-----------------|
| Customer read | Tenant A user GET `/customers/:tenantBId` | 404 or 403 |
| Customer update | Tenant A user PUT `/customers/:tenantBId` | 404 or 403 |
| Customer delete | Tenant A user DELETE `/customers/:tenantBId` | 404 or 403 |
| Lead access | Tenant A user GET `/leads/:tenantBId` | 404 or 403 |
| Payment access | Tenant A user GET `/payments/:tenantBId` | 404 or 403 |
| Accounting access | Tenant A user GET `/journal-entries` | Only Tenant A entries |
| Chat access | Tenant A user GET `/chat/messages/:tenantBId` | 404 or 403 |
| Attachment access | Tenant A user GET `/attachments/:tenantBId` | 404 or 403 |
| Notification access | Tenant A user GET `/notifications` | Only Tenant A notifications |
| Audit access | Tenant A admin GET `/audit-logs` | Only Tenant A audit logs |

### Cross-Tenant IDOR Tests

```
GET /customers/:tenantBId        → 403/404
PUT /customers/:tenantBId        → 403/404
DELETE /customers/:tenantBId     → 403/404
GET /payments/:tenantBId         → 403/404
GET /attachments/:tenantBId      → 403/404
GET /chat/messages/:tenantBId    → 403/404
POST /customers (body.tenantId=tenantB) → 403 (never accept client tenantId)
```

Every attempt must fail safely without leaking Tenant B's data.

## 16.2 RBAC + Tenant Matrix

| Actor | Tenant | Resource | Action | Expected |
|---|---|---|---|---|
| Tenant admin | A | A customer | Read | Allow |
| Tenant user | A | A customer | Read | Based on permission |
| Tenant user | A | B customer | Read | Deny |
| Tenant admin | A | B accounting | Read | Deny |
| Platform admin | Platform | Tenant A metadata | Read | Based on platform permission |
| Platform admin | Platform | Tenant A financial data | Access | Explicitly defined, audited |
| Tenant user | A | Tenant B chat message | Read | Deny |
| Removed member | A | A customer | Read | Deny (membership.status ≠ ACTIVE) |
| Suspended member | A | A customer | Read | Deny |

## 16.3 Migration Reconciliation Tests

| Test | Expected |
|------|----------|
| Source customer count == PostgreSQL count | Match exactly |
| Source financial totals == PostgreSQL totals | Match exactly |
| Source user count == PostgreSQL count | Match exactly |
| Foreign key integrity | No orphaned records |
| Every record has `tenantId` | No null tenantIds |

---

# 17. OPEN DECISIONS

These are the decisions that genuinely require platform owner input:

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | **Database engine** | PostgreSQL / MySQL | PostgreSQL (strongly recommended for RLS support) |
| 2 | **Tenant isolation strategy** | Single DB + `tenantId` / Separate schemas / Separate databases | Single DB + `tenantId` column (recommended for initial scale) |
| 3 | **BusinessCategory initial set** | General / Retail / Restaurant / Salon / Clinic / Service / Wholesale / Distribution / Real Estate / Other | Must inspect product requirements — not yet determined |
| 4 | **Existing data tenant mapping** | Single initial tenant / Discard and start fresh / Other | Single initial tenant "main" (proposed) |
| 5 | **Platform admin model** | Dedicated PlatformAdmin table / Platform role in User | Dedicated PlatformAdmin table (proposed) |
| 6 | **JWT strategy** | Single secret with tenantId claim / Per-tenant key material | Single secret with tenantId claim (proposed) |
| 7 | **Storage model** | Local filesystem with tenant prefixes / Object storage (S3) | Local filesystem for dev, abstracted for object storage (proposed) |
| 8 | **Custom domains** | Support in Step 11 / Defer | Support in Step 11 (aligned with Step 10A spec) |
| 9 | **Development database** | Local PostgreSQL / Docker Compose | Docker Compose (recommended for reproducibility) |
| 10 | **Soft deletion** | `deletedAt` on all entities / Hard delete | `deletedAt` on tenant-owned entities; hard delete for audit logs (proposed) |

---

# 18. BUSINESS CATEGORY INITIAL SET

**Decision required from platform owner.** The current product has these functional modules:

- Customers / CRM
- Leads / Sales pipeline
- Calls / Communication
- Tasks / Workflow
- Contracts / Agreements
- Payments / Transactions
- Checks / Financial instruments
- SIM inventory / Telecom
- Repairs / Service
- Consignment / Trust sales
- Documents / Attachments
- Chat / Messaging
- Notifications
- Accounting / Journal entries
- Reports

**Proposed initial categories** (to be confirmed):
- `GENERAL` — General business (default)
- `RETAIL` — Retail store operations
- `RESTAURANT` — Restaurant with tables, reservations
- `SALON` — Salon with appointments, services
- `SERVICE` — Service business (repairs, maintenance)
- `WHOLESALE` — Wholesale/distribution
- `DISTRIBUTION` — Distribution/logistics
- `REAL_ESTATE` — Real estate management

**Do not blindly adopt these values.** Inspect existing application modules and document the actual initial category set.

---

# 19. RECOMMENDED IMPLEMENTATION ORDER

## Batch 1: Foundation (Prerequisites)
1. Set up PostgreSQL + Docker Compose
2. Install Prisma, initialize schema
3. Define all 40+ entity types in `prisma/schema.prisma`
4. Run `prisma migrate dev` and `prisma generate`
5. Verify schema in Prisma Studio

## Batch 2: Platform Entities
6. Implement `User`, `Role`, `BusinessCategory`, `Plan`, `Entitlement`
7. Implement `Tenant`, `TenantMembership`, `TenantDomain`, `License`
8. Implement `TenantSettings`, `PlatformAdmin`
9. Write seed data with multiple tenants (Tenant A, Tenant B)

## Batch 3: Tenant Resolution + Auth Extension
10. Implement hostname resolution middleware
11. Extend `getAuthUser` to verify `TenantMembership`
12. Implement `AuthContext` with tenant info
13. Update login flow for multi-tenant verification

## Batch 4: Data Access Layer Rewrite
14. Create Prisma-based repository layer
15. Add `tenantId` to every query
16. Implement IDOR prevention patterns
17. Replace `centralDb` array operations with Prisma queries

## Batch 5: Tenant-Owned Entities Migration
18. Map all existing entities to tenant-scoped Prisma models
19. Build JSON → PostgreSQL importer
20. Run reconciliation tests

## Batch 6: Authorization Enforcement
21. Extend `requirePermission` to verify `tenantId`
22. Implement resource-level ownership checks
23. Build `tenantDb(currentTenant)` abstraction
24. Add `isAdmin` → platform-admin vs. tenant-admin split

## Batch 7: Chat, Notifications, Files
25. Add `tenantId` to chat entities
26. Add `tenantId` to notification entities
27. Implement tenant-scoped storage paths
28. Implement cross-tenant access prevention for files and chat

## Batch 8: Testing and Validation
29. Cross-tenant isolation tests
30. Migration reconciliation tests
31. Performance benchmarks with tenant-scoped indexes
32. Security penetration tests

## Batch 9: Production Preparation
33. Production migration (`prisma migrate deploy`)
34. Backup and rollback verification
35. Monitoring with tenant context in logs
36. Production cutover

---

# 20. ACCEPTANCE CHECKLIST

| Item | Status | Notes |
|------|--------|-------|
| PostgreSQL selected as target database | **PASS** | Required for RLS support |
| Prisma selected as ORM | **PASS** | Type-safe TypeScript client |
| All entities defined in Prisma schema | **PASS** | 40+ entity types documented |
| Tenant scope classification complete | **PASS** | PLATFORM / TENANT / USER / GLOBAL |
| Tenant isolation model defined | **PASS** | Hostname → Tenant → Membership → Auth |
| IDOR prevention pattern defined | **PASS** | `findFirst({ where: { id, tenantId } })` |
| Hostname resolution model defined | **PASS** | Normalize → Lookup → Validate |
| Authentication + tenant context defined | **PASS** | User → Membership → Tenant |
| License/Plan model defined | **PASS** | License → Plan → Entitlements |
| Existing JSON migration path defined | **PASS** | Staged migration with rollback |
| Index strategy documented | **PASS** | Compound indexes on (tenantId, ...) |
| Security model defined | **PASS** | IDOR, tenant enumeration, host headers |
| Prisma Studio workflow documented | **PASS** | Development commands provided |
| Cross-tenant isolation test strategy defined | **PASS** | Tenant A cannot access Tenant B |
| Existing data tenant mapping defined | **NEEDS OWNER DECISION** | Single initial tenant proposed |
| BusinessCategory initial set defined | **NEEDS OWNER DECISION** | Must inspect product requirements |
| Development database choice defined | **PASS** | Docker Compose recommended |
| Storage model defined | **PASS** | Tenant-scoped paths |

**All architecture items marked PASS or NEEDS OWNER DECISION.** Implementation is NOT complete — this specification provides the foundation for safe multi-tenant implementation.

---

# 21. FINAL PRINCIPLE

**Audit first. Design second. Verify third. Implement fourth.**

The goal of Step 10A is:

> Establish a precise, reviewable PostgreSQL + Prisma + multi-tenant architecture that can safely become the foundation of the commercial MMBA platform.

The future MMBA should be capable of:

```
Platform Owner
      ↓
Plans / Licenses / Categories
      ↓
Tenant
      ↓
Tenant Domain / Subdomain
      ↓
Tenant Memberships
      ↓
Existing MMBA CRM capabilities
      ↓
Tenant-isolated PostgreSQL data
```

**Keep the existing MMBA functionality.** Do not turn the application into a generic SaaS framework. Build the platform foundation around the actual MMBA business system.

**Do not implement the complete migration just because the architecture is defined.** The future steps are:
- Step 11: Tenant domains and hostname routing
- Step 12: Licensing foundation
- Step 13: Plans and entitlements
- Step 14: Business categories and modular CRM
- Step 15: Billing/subscriptions
- Step 16: Platform owner/control panel
- Step 17: Production deployment and launch hardening

---

*This specification is architecture and design only. No implementation was performed. The repository remains in its original state.*
