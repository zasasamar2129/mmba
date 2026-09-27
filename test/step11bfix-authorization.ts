// ---------------------------------------------------------------------------
// Step 11B-FIX — Generic tenant route authorization regression tests
//
// Verifies the server-owned table → module map in server/tenantTableModules.ts
// and the permission derivation used by the /v2/tenants/:table handlers.
//
// Run: npx tsx test/step11bfix-authorization.ts
// Needs: no database (pure authorization logic; repository/tenant scoping is
// covered separately by test/step12-isolation.ts and test/step12-verticals.ts).
// ---------------------------------------------------------------------------
import assert from 'assert';
import { ModuleName, PermissionAction, UserRole, User, Role } from '../src/types';
import { hasPermission } from '../src/lib/permissions';
import {
  getTenantTableModule,
  TENANT_TABLE_MODULES,
  protectedStatusesFor,
  PROTECTED_PAYMENT_STATUSES,
  PROTECTED_CHECK_STATUSES,
  APPEND_ONLY_TABLES,
} from '../server/tenantTableModules';
import { tenantTables } from '../server/tenantVerticals';

let pass = 0;
let fail = 0;

function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log(`  PASS  ${name}`);
  } else {
    fail++;
    console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`);
  }
}

/** Build a user holding a CUSTOMERS-only role (no financial/chat/other access). */
function customerOnlyUser(): User {
  const role: Role = {
    id: 'role-test-customer-only',
    name: 'TEST_CUSTOMER_ONLY' as unknown as UserRole,
    titleFa: 'Test',
    titleEn: 'Test',
    descriptionFa: '',
    descriptionEn: '',
    permissions: [
      { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE] },
    ],
  };
  return {
    id: 'u-cust-only',
    name: 'Customer Only',
    username: 'cust_only',
    password: 'x',
    role: 'TEST_CUSTOMER_ONLY' as unknown as UserRole,
    status: 'ACTIVE',
    permissions: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as User;
}

/** Same, but with an explicit role injected into the role list. */
function rolesWith(role: Role): Role[] {
  return [role];
}

function roleWithPermissions(name: string, perms: Role['permissions']): Role {
  return {
    id: `role-test-${name}`,
    name: name as unknown as UserRole,
    titleFa: 'Test',
    titleEn: 'Test',
    descriptionFa: '',
    descriptionEn: '',
    permissions: perms,
  };
}

console.log('\n=== 1. TABLE → MODULE MAP INTEGRITY ===');
{
  // Every table registered in the vertical registry must have a module.
  const missing = tenantTables.filter((t) => getTenantTableModule(t) === null);
  check('every tenantVerticals table has a module mapping', missing.length === 0, `missing: ${missing.join(', ')}`);

  // Nothing in the map may be unreachable via a registered table, with one
  // deliberate exception: `customer` is served by a dedicated route registered
  // ahead of the generic one, so it never reaches /v2/tenants/:table. It stays
  // in the map so the mapping remains correct if that route is ever removed.
  const DEDICATED_ROUTE_TABLES = new Set(['customer']);
  const orphan = Object.keys(TENANT_TABLE_MODULES).filter(
    (t) => !tenantTables.includes(t) && !DEDICATED_ROUTE_TABLES.has(t),
  );
  check(
    'no mapping entry is missing from the vertical registry (except dedicated-route tables)',
    orphan.length === 0,
    `orphans: ${orphan.join(', ')}`,
  );
  check('customer is not exposed through the generic vertical registry', !tenantTables.includes('customer'));

  // Prototype keys must never resolve to a module.
  check('"constructor" does not resolve', getTenantTableModule('constructor') === null);
  check('"__proto__" does not resolve', getTenantTableModule('__proto__') === null);
  check('"toString" does not resolve', getTenantTableModule('toString') === null);
  check('empty string does not resolve', getTenantTableModule('') === null);
  check('undefined-ish does not resolve', getTenantTableModule(undefined as unknown as string) === null);

  // Unknown / near-miss tables fail closed.
  for (const t of ['notARealTable', 'paymentsSomething', 'customerBackup', 'customers2', 'Payment', 'PAYMENT']) {
    check(`unknown table "${t}" fails closed`, getTenantTableModule(t) === null);
  }

  // Known tables map to the expected module.
  check('customer → CUSTOMERS', getTenantTableModule('customer') === ModuleName.CUSTOMERS);
  check('lead → LEADS', getTenantTableModule('lead') === ModuleName.LEADS);
  check('payment → PAYMENTS', getTenantTableModule('payment') === ModuleName.PAYMENTS);
  check('checkRecord → CHECKS', getTenantTableModule('checkRecord') === ModuleName.CHECKS);
  check('account → PAYMENTS (no ACCOUNTING module exists)', getTenantTableModule('account') === ModuleName.PAYMENTS);
  check('journalEntry → PAYMENTS', getTenantTableModule('journalEntry') === ModuleName.PAYMENTS);
  check('chatMessage → CHAT', getTenantTableModule('chatMessage') === ModuleName.CHAT);
  check('repair → REPAIRS', getTenantTableModule('repair') === ModuleName.REPAIRS);
  check('simCard → SIM_INVENTORY', getTenantTableModule('simCard') === ModuleName.SIM_INVENTORY);
  check('task → TASKS', getTenantTableModule('task') === ModuleName.TASKS);
  check('contract → CONTRACTS', getTenantTableModule('contract') === ModuleName.CONTRACTS);
  check('attachment → DOCUMENTS', getTenantTableModule('attachment') === ModuleName.DOCUMENTS);
  check('notification → INBOX', getTenantTableModule('notification') === ModuleName.INBOX);
}

console.log('\n=== 2. CUSTOMER-ONLY USER: CORRECT VERTICAL ALLOWED ===');
{
  const role = roleWithPermissions('TEST_CUSTOMER_ONLY', [
    { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE] },
  ]);
  const user = customerOnlyUser();
  const roles = rolesWith(role);

  check(
    'customer:VIEW allowed',
    hasPermission(user, getTenantTableModule('customer')!, PermissionAction.VIEW, roles),
  );
  check(
    'customer:CREATE allowed',
    hasPermission(user, getTenantTableModule('customer')!, PermissionAction.CREATE, roles),
  );
  check(
    'customer:EDIT allowed',
    hasPermission(user, getTenantTableModule('customer')!, PermissionAction.EDIT, roles),
  );
  check(
    'customer:ARCHIVE allowed',
    hasPermission(user, getTenantTableModule('customer')!, PermissionAction.ARCHIVE, roles),
  );
}

console.log('\n=== 3. CUSTOMER-ONLY USER: ALL OTHER VERTICALS DENIED ===');
{
  const role = roleWithPermissions('TEST_CUSTOMER_ONLY', [
    { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE] },
  ]);
  const user = customerOnlyUser();
  const roles = rolesWith(role);

  // Every table whose module is not CUSTOMERS must be denied for a customer-only
  // user. This is the core regression: before the fix every one of these routes
  // authorized with ModuleName.CUSTOMERS.
  const leaks: string[] = [];
  for (const table of tenantTables) {
    const module = getTenantTableModule(table)!;
    if (module === ModuleName.CUSTOMERS) continue; // registeredHolder is CUSTOMERS by design
    for (const action of [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE]) {
      if (hasPermission(user, module, action, roles)) {
        leaks.push(`${table}(${module},${action})`);
      }
    }
  }
  check('customer-only user denied on every non-CUSTOMERS table', leaks.length === 0, `LEAKED: ${leaks.join(', ')}`);

  // Spot-check the explicitly named financial/chat verticals.
  for (const [table, action, label] of [
    ['payment', PermissionAction.VIEW, 'GET payments'],
    ['payment', PermissionAction.CREATE, 'POST payments'],
    ['payment', PermissionAction.EDIT, 'PUT payments'],
    ['payment', PermissionAction.ARCHIVE, 'DELETE payments'],
    ['checkRecord', PermissionAction.VIEW, 'GET checks'],
    ['checkRecord', PermissionAction.CREATE, 'POST checks'],
    ['checkRecord', PermissionAction.EDIT, 'PUT checks'],
    ['checkRecord', PermissionAction.ARCHIVE, 'DELETE checks'],
    ['account', PermissionAction.VIEW, 'GET accounting(account)'],
    ['journalEntry', PermissionAction.VIEW, 'GET accounting(journalEntry)'],
    ['journalEntryLine', PermissionAction.VIEW, 'GET accounting(journalEntryLine)'],
    ['chatMessage', PermissionAction.VIEW, 'GET chat'],
    ['repair', PermissionAction.VIEW, 'GET repairs'],
    ['simCard', PermissionAction.VIEW, 'GET sims'],
    ['lead', PermissionAction.VIEW, 'GET leads'],
    ['contract', PermissionAction.VIEW, 'GET contracts'],
    ['notification', PermissionAction.VIEW, 'GET notifications'],
    ['attachment', PermissionAction.VIEW, 'GET attachments'],
  ] as const) {
    const module = getTenantTableModule(table)!;
    check(
      `customer-only denied: ${label}`,
      !hasPermission(user, module, action, roles),
      `module ${module} granted ${action}`,
    );
  }
}

console.log('\n=== 4. CORRECT VERTICAL PERMISSION STILL WORKS ===');
{
  const role = roleWithPermissions('TEST_FINANCE', [
    { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW, PermissionAction.CREATE, PermissionAction.EDIT, PermissionAction.ARCHIVE] },
    { module: ModuleName.CHECKS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    { module: ModuleName.CHAT, actions: [PermissionAction.VIEW] },
    { module: ModuleName.REPAIRS, actions: [PermissionAction.VIEW, PermissionAction.CREATE] },
    { module: ModuleName.SIM_INVENTORY, actions: [PermissionAction.VIEW] },
  ]);
  const user = { ...customerOnlyUser(), id: 'u-fin', role: 'TEST_FINANCE' as unknown as UserRole } as unknown as User;
  const roles = rolesWith(role);

  check('finance user → GET payments allowed', hasPermission(user, getTenantTableModule('payment')!, PermissionAction.VIEW, roles));
  check('finance user → POST payments allowed', hasPermission(user, getTenantTableModule('payment')!, PermissionAction.CREATE, roles));
  check('finance user → GET checks allowed', hasPermission(user, getTenantTableModule('checkRecord')!, PermissionAction.VIEW, roles));
  check('finance user → POST checks allowed', hasPermission(user, getTenantTableModule('checkRecord')!, PermissionAction.CREATE, roles));
  check('finance user → DELETE checks denied (no ARCHIVE)', !hasPermission(user, getTenantTableModule('checkRecord')!, PermissionAction.ARCHIVE, roles));
  check('finance user → GET chat allowed', hasPermission(user, getTenantTableModule('chatMessage')!, PermissionAction.VIEW, roles));
  check('finance user → GET repairs allowed', hasPermission(user, getTenantTableModule('repair')!, PermissionAction.VIEW, roles));
  check('finance user → GET sims allowed', hasPermission(user, getTenantTableModule('simCard')!, PermissionAction.VIEW, roles));
  // Still denied on a module it does not hold.
  check('finance user → GET customers denied', !hasPermission(user, getTenantTableModule('customer')!, PermissionAction.VIEW, roles));
  check('finance user → GET leads denied', !hasPermission(user, getTenantTableModule('lead')!, PermissionAction.VIEW, roles));
}

console.log('\n=== 5. PERMISSION MATRIX (table-driven) ===');
{
  // rolePermissions: what the synthetic user holds. Then assert the expected
  // outcome per (table, action) using the server-owned mapping.
  const matRole = roleWithPermissions('TEST_MATRIX', [
    { module: ModuleName.CUSTOMERS, actions: [PermissionAction.VIEW] },
    { module: ModuleName.PAYMENTS, actions: [PermissionAction.VIEW] },
  ]);
  const matUser = { ...customerOnlyUser(), id: 'u-mat', role: 'TEST_MATRIX' as unknown as UserRole } as unknown as User;
  const matRoles = rolesWith(matRole);

  const matrix: Array<[string, PermissionAction, boolean, string]> = [
    ['customer', PermissionAction.VIEW, true, 'customers + CUSTOMERS:view → allowed'],
    ['payment', PermissionAction.VIEW, true, 'payments + PAYMENTS:view → allowed'],
    ['checkRecord', PermissionAction.VIEW, false, 'checks without CHECKS:view → denied'],
    ['account', PermissionAction.VIEW, true, 'accounting maps to PAYMENTS:view → allowed'],
    ['chatMessage', PermissionAction.VIEW, false, 'chat without CHAT:view → denied'],
    ['repair', PermissionAction.VIEW, false, 'repairs without REPAIRS:view → denied'],
    ['simCard', PermissionAction.VIEW, false, 'sims without SIM_INVENTORY:view → denied'],
    ['lead', PermissionAction.VIEW, false, 'leads without LEADS:view → denied'],
    ['contract', PermissionAction.VIEW, false, 'contracts without CONTRACTS:view → denied'],
    ['notification', PermissionAction.VIEW, false, 'notifications without INBOX:view → denied'],
    ['attachment', PermissionAction.VIEW, false, 'attachments without DOCUMENTS:view → denied'],
    ['task', PermissionAction.VIEW, false, 'tasks without TASKS:view → denied'],
  ];
  for (const [table, action, expected, label] of matrix) {
    const module = getTenantTableModule(table)!;
    const actual = hasPermission(matUser, module, action, matRoles);
    check(label, actual === expected, `expected ${expected}, got ${actual}`);
  }
}

console.log('\n=== 6. ADMIN ROLES STILL BYPASS (no regression) ===');
{
  for (const r of [UserRole.GOD, UserRole.OWNER, UserRole.SUPER_ADMIN]) {
    const u = { ...customerOnlyUser(), role: r } as unknown as User;
    let allAllowed = true;
    for (const table of tenantTables) {
      if (!hasPermission(u, getTenantTableModule(table)!, PermissionAction.VIEW)) { allAllowed = false; break; }
    }
    check(`${r} retains full access to all generic tables`, allAllowed);
  }
}

console.log('\n=== 7. FINANCIAL DELETE GUARDS (Step 5 preserved on PG path) ===');
{
  check('payment is financial', protectedStatusesFor('payment') === PROTECTED_PAYMENT_STATUSES);
  check('checkRecord is financial', protectedStatusesFor('checkRecord') === PROTECTED_CHECK_STATUSES);
  check('customer is not financial', protectedStatusesFor('customer') === null);
  check('auditLog is not financial but is append-only', protectedStatusesFor('auditLog') === null && APPEND_ONLY_TABLES.has('auditLog'));

  // The protected status sets must match the Step 5 rules in server/db.ts.
  check('COMPLETED payment is protected', PROTECTED_PAYMENT_STATUSES.has('COMPLETED'));
  check('VERIFIED payment is protected', PROTECTED_PAYMENT_STATUSES.has('VERIFIED'));
  check('PENDING payment is not protected', !PROTECTED_PAYMENT_STATUSES.has('PENDING'));
  check('DEPOSITED check is protected', PROTECTED_CHECK_STATUSES.has('DEPOSITED'));
  check('CLEARED check is protected', PROTECTED_CHECK_STATUSES.has('CLEARED'));
  check('RECEIVED check is not protected', !PROTECTED_CHECK_STATUSES.has('RECEIVED'));
}

console.log('\n=== 8. MAP IS IMMUTABLE ===');
{
  let mutated = false;
  try {
    (TENANT_TABLE_MODULES as Record<string, ModuleName>).payment = ModuleName.CUSTOMERS;
    mutated = true;
  } catch { /* frozen in strict mode — expected */ }
  check('TENANT_TABLE_MODULES is frozen (assignment rejected or no-op)', !mutated || getTenantTableModule('payment') === ModuleName.PAYMENTS);
}

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
assert.strictEqual(fail, 0, `${fail} authorization regression check(s) failed`);
process.exit(0);
