const fs = require('fs');
let c = fs.readFileSync('routes.ts', 'utf8');
const lines = c.split('\n');

// Add isAdmin and hasPermission imports
c = c.replace(
  "import { isAdmin } from '../src/lib/permissions';",
  "import { isAdmin, hasPermission } from '../src/lib/permissions';\nimport { PermissionAction } from '../src/types';"
);

// Insert ALLOWLIST_PATHS + requireAuth + requirePermission + apiRouter.use(requireAuth) after getAuthUser function
const getAuthUserEnd = c.indexOf('  return undefined;\n}\n\n// Helper: strip the password');
const authMiddleware = `
const ALLOWLIST_PATHS = new Set<string>([
  '/auth/login', '/auth/biometric-challenge', '/auth/biometric-login',
  '/health', '/notifications/vapid-public-key',
]);

function requireAuth(req: Request, res: Response, next: any) {
  const path = req.path.startsWith('/api/v1') ? req.path.slice(5) : req.path.startsWith('/api') ? req.path.slice(4) : req.path;
  if (ALLOWLIST_PATHS.has(path)) { return next(); }
  const fullPath = req.originalUrl?.split('?')[0] || '';
  const isAllowlisted = Array.from(ALLOWLIST_PATHS).some(p =>
    fullPath === \`/api\${p}\` || fullPath === \`/api/v1\${p}\` || fullPath === p
  );
  if (isAllowlisted) { return next(); }
  getAuthUser(req).then((user) => {
    if (!user) { return res.status(401).json({ success: false, message: 'احراز هویت الزامی است.' }); }
    (req as any).authUser = user; next();
  }).catch(() => { return res.status(401).json({ success: false, message: 'احراز هویت نامعتبر است.' }); });
}

// Apply authentication middleware to ALL routes
apiRouter.use(requireAuth);

function sanitizeUser(user: User): Omit<User, 'password'> {
  const { password: _pw, ...safe } = user;
  return safe;
}
function sanitizeUsers(users: User[]): Omit<User, 'password'>[] {
  return users.map(sanitizeUser);
}

function requirePermission(module: ModuleName, action: PermissionAction) {
  return (req: Request, res: Response, next: any) => {
    const user = (req as any).authUser as User;
    if (!hasPermission(user, module, action)) {
      return res.status(403).json({ success: false, message: 'دسترسی غیرمجاز: نقش شما مجوز این عملیات را ندارد.' });
    }
    next();
  };
}
`;

// Remove the old sanitizeUser/sanitizeUsers helpers (they're duplicated)
const oldHelperStart = c.indexOf('\n// Helper: strip the password field');
const oldHelperEnd = c.indexOf('// ----------------------------------------------------\n// Health Check');
c = c.slice(0, oldHelperStart) + '\n' + authMiddleware + c.slice(oldHelperEnd);

// Now add requirePermission to routes that don't have it
// Use string replacements for each route group
const routes = [
  // sims
  ["apiRouter.get('/sims',", "apiRouter.get('/sims', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.VIEW),"],
  ["apiRouter.post('/sims',", "apiRouter.post('/sims', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.CREATE),"],
  ["apiRouter.put('/sims/:id',", "apiRouter.put('/sims/:id', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.EDIT),"],
  ["apiRouter.delete('/sims/:id',", "apiRouter.delete('/sims/:id', requirePermission(ModuleName.SIM_INVENTORY, PermissionAction.ARCHIVE),"],
  // repairs
  ["apiRouter.get('/repairs',", "apiRouter.get('/repairs', requirePermission(ModuleName.REPAIRS, PermissionAction.VIEW),"],
  ["apiRouter.post('/repairs',", "apiRouter.post('/repairs', requirePermission(ModuleName.REPAIRS, PermissionAction.CREATE),"],
  ["apiRouter.put('/repairs/:id',", "apiRouter.put('/repairs/:id', requirePermission(ModuleName.REPAIRS, PermissionAction.EDIT),"],
  ["apiRouter.delete('/repairs/:id',", "apiRouter.delete('/repairs/:id', requirePermission(ModuleName.REPAIRS, PermissionAction.ARCHIVE),"],
  // voice-notes
  ["apiRouter.get('/voice-notes',", "apiRouter.get('/voice-notes', requirePermission(ModuleName.NOTES, PermissionAction.VIEW),"],
  ["apiRouter.post('/voice-notes',", "apiRouter.post('/voice-notes', requirePermission(ModuleName.NOTES, PermissionAction.CREATE),"],
  ["apiRouter.delete('/voice-notes/:id',", "apiRouter.delete('/voice-notes/:id', requirePermission(ModuleName.NOTES, PermissionAction.ARCHIVE),"],
  ["apiRouter.put('/voice-notes/:id',", "apiRouter.put('/voice-notes/:id', requirePermission(ModuleName.NOTES, PermissionAction.EDIT),"],
  ["apiRouter.get('/voice-notes/:id/audio',", "apiRouter.get('/voice-notes/:id/audio', requirePermission(ModuleName.NOTES, PermissionAction.VIEW),"],
  // tasks
  ["apiRouter.get('/tasks',", "apiRouter.get('/tasks', requirePermission(ModuleName.TASKS, PermissionAction.VIEW),"],
  ["apiRouter.post('/tasks',", "apiRouter.post('/tasks', requirePermission(ModuleName.TASKS, PermissionAction.CREATE),"],
  ["apiRouter.put('/tasks/:id',", "apiRouter.put('/tasks/:id', requirePermission(ModuleName.TASKS, PermissionAction.EDIT),"],
  ["apiRouter.delete('/tasks/:id',", "apiRouter.delete('/tasks/:id', requirePermission(ModuleName.TASKS, PermissionAction.ARCHIVE),"],
  // contracts
  ["apiRouter.get('/contracts',", "apiRouter.get('/contracts', requirePermission(ModuleName.CONTRACTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/contracts',", "apiRouter.post('/contracts', requirePermission(ModuleName.CONTRACTS, PermissionAction.CREATE),"],
  ["apiRouter.put('/contracts/:id',", "apiRouter.put('/contracts/:id', requirePermission(ModuleName.CONTRACTS, PermissionAction.EDIT),"],
  ["apiRouter.delete('/contracts/:id',", "apiRouter.delete('/contracts/:id', requirePermission(ModuleName.CONTRACTS, PermissionAction.ARCHIVE),"],
  // payments
  ["apiRouter.get('/payments',", "apiRouter.get('/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/payments',", "apiRouter.post('/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE),"],
  ["apiRouter.put('/payments/:id',", "apiRouter.put('/payments/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.EDIT),"],
  ["apiRouter.delete('/payments/:id',", "apiRouter.delete('/payments/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.ARCHIVE),"],
  // checks
  ["apiRouter.get('/checks',", "apiRouter.get('/checks', requirePermission(ModuleName.CHECKS, PermissionAction.VIEW),"],
  ["apiRouter.post('/checks',", "apiRouter.post('/checks', requirePermission(ModuleName.CHECKS, PermissionAction.CREATE),"],
  ["apiRouter.put('/checks/:id',", "apiRouter.put('/checks/:id', requirePermission(ModuleName.CHECKS, PermissionAction.EDIT),"],
  ["apiRouter.delete('/checks/:id',", "apiRouter.delete('/checks/:id', requirePermission(ModuleName.CHECKS, PermissionAction.ARCHIVE),"],
  // users
  ["apiRouter.get('/users',", "apiRouter.get('/users', requirePermission(ModuleName.USERS, PermissionAction.VIEW),"],
  ["apiRouter.post('/users',", "apiRouter.post('/users', requirePermission(ModuleName.USERS, PermissionAction.EDIT),"],
  ["apiRouter.put('/users/:id',", "apiRouter.put('/users/:id', requirePermission(ModuleName.USERS, PermissionAction.MANAGE),"],
  ["apiRouter.post('/users/:id/reset-password',", "apiRouter.post('/users/:id/reset-password', requirePermission(ModuleName.USERS, PermissionAction.MANAGE),"],
  ["apiRouter.delete('/users/:id',", "apiRouter.delete('/users/:id', requirePermission(ModuleName.USERS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/roles',", "apiRouter.get('/roles', requirePermission(ModuleName.USERS, PermissionAction.VIEW),"],
  ["apiRouter.put('/roles/:id',", "apiRouter.put('/roles/:id', requirePermission(ModuleName.USERS, PermissionAction.MANAGE),"],
  // settings
  ["apiRouter.get('/settings',", "apiRouter.get('/settings', requirePermission(ModuleName.SETTINGS, PermissionAction.VIEW),"],
  ["apiRouter.put('/settings',", "apiRouter.put('/settings', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  // audit-logs
  ["apiRouter.get('/audit-logs',", "apiRouter.get('/audit-logs', requirePermission(ModuleName.AUDIT_LOGS, PermissionAction.VIEW),"],
  // backups (admin only)
  ["apiRouter.get('/backups',", "apiRouter.get('/backups', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/backups/health',", "apiRouter.get('/backups/health', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/backups/schedule',", "apiRouter.get('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.put('/backups/schedule',", "apiRouter.put('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.post('/backups/create',", "apiRouter.post('/backups/create', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/backups/:id/verify',", "apiRouter.get('/backups/:id/verify', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/backups/:id/download',", "apiRouter.get('/backups/:id/download', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.delete('/backups/:id',", "apiRouter.delete('/backups/:id', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.post('/backups/:id/restore',", "apiRouter.post('/backups/:id/restore', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.post('/backups/upload',", "apiRouter.post('/backups/upload', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.get('/backup/export',", "apiRouter.get('/backup/export', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  ["apiRouter.post('/backup/import',", "apiRouter.post('/backup/import', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE),"],
  // accounts/journal-entries/accounting-periods (PAYMENTS module)
  ["apiRouter.get('/accounts',", "apiRouter.get('/accounts', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/accounts',", "apiRouter.post('/accounts', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE),"],
  ["apiRouter.delete('/accounts/:id',", "apiRouter.delete('/accounts/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.ARCHIVE),"],
  ["apiRouter.get('/journal-entries',", "apiRouter.get('/journal-entries', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW),"],
  ["apiRouter.get('/journal-entries/:id',", "apiRouter.get('/journal-entries/:id', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/journal-entries',", "apiRouter.post('/journal-entries', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE),"],
  ["apiRouter.get('/accounting-periods',", "apiRouter.get('/accounting-periods', requirePermission(ModuleName.PAYMENTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/accounting-periods',", "apiRouter.post('/accounting-periods', requirePermission(ModuleName.PAYMENTS, PermissionAction.CREATE),"],
  // notifications
  ["apiRouter.get('/notifications',", "apiRouter.get('/notifications', requirePermission(ModuleName.NOTES, PermissionAction.VIEW),"],
  ["apiRouter.post('/notifications',", "apiRouter.post('/notifications', requirePermission(ModuleName.NOTES, PermissionAction.CREATE),"],
  // document-shares
  ["apiRouter.get('/document-shares',", "apiRouter.get('/document-shares', requirePermission(ModuleName.CUSTOMERS, PermissionAction.VIEW),"],
  ["apiRouter.post('/document-shares',", "apiRouter.post('/document-shares', requirePermission(ModuleName.CUSTOMERS, PermissionAction.CREATE),"],
  ["apiRouter.put('/document-shares/:id/read',", "apiRouter.put('/document-shares/:id/read', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT),"],
  ["apiRouter.put('/document-shares/:id/archive',", "apiRouter.put('/document-shares/:id/archive', requirePermission(ModuleName.CUSTOMERS, PermissionAction.EDIT),"],
  // contract-installments
  ["apiRouter.get('/contract-installments',", "apiRouter.get('/contract-installments', requirePermission(ModuleName.CONTRACTS, PermissionAction.VIEW),"],
  ["apiRouter.post('/contract-installments',", "apiRouter.post('/contract-installments', requirePermission(ModuleName.CONTRACTS, PermissionAction.CREATE),"],
  ["apiRouter.post('/contract-installments/:id/payments',", "apiRouter.post('/contract-installments/:id/payments', requirePermission(ModuleName.PAYMENTS, PermissionAction.VERIFY),"],
  // finance-review
  ["apiRouter.post('/payments/:id/finance-review',", "apiRouter.post('/payments/:id/finance-review', requirePermission(ModuleName.PAYMENTS, PermissionAction.VERIFY),"],
];

let applied = 0;
for (const [old, newStr] of routes) {
  if (c.includes(old)) {
    c = c.replace(old, newStr);
    applied++;
  }
}
console.log('Applied', applied, 'RBAC gates');

// Now handle the inline isAdmin checks in users/roles/backups routes to use requirePermission
// Replace inline isAdmin checks in users/:id PUT with requirePermission
const putUsersStart = c.indexOf("apiRouter.put('/users/:id'");
if (putUsersStart >= 0) {
  const blockEnd = c.indexOf('apiRouter.post(\'/users/:id/reset-password\'', putUsersStart);
  if (blockEnd >= 0) {
    // Already replaced above, but need to fix the body
    // The old body has inline isAdmin checks - replace them with just the authUser cast
    const block = c.slice(putUsersStart, blockEnd);
    const fixed = block
      .replace(/const authUser = await getAuthUser\(\) \|\| centralDb\.findUserById\('usr-admin'\);\n\s*if \(!isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}\n/, '')
      .replace(/const authUser = await getAuthUser\(\) \|\| centralDb\.findUserById\('usr-admin'\);/g, 'const authUser = (req as any).authUser as User;');
    c = c.slice(0, putUsersStart) + fixed + c.slice(blockEnd);
  }
}

// Handle /backups/:id/download which had inline isAdmin
c = c.replace(
  /apiRouter\.get\('\/backups\/:id\/download', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.get('/backups/:id/download', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/:id/restore
c = c.replace(
  /apiRouter\.post\('\/backups\/:id\/restore', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\) \|\| centralDb\.findUserById\('usr-admin'\);\n\s*if \(!authUser \|\| !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.post('/backups/:id/restore', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/upload
c = c.replace(
  /apiRouter\.post\('\/backups\/upload', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\) \|\| centralDb\.findUserById\('usr-admin'\);\n\s*if \(!isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.post('/backups/upload', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/:id/verify
c = c.replace(
  /apiRouter\.get\('\/backups\/:id\/verify', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.get('/backups/:id/verify', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/:id (delete)
c = c.replace(
  /apiRouter\.delete\('\/backups\/:id', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.delete('/backups/:id', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/schedule PUT
c = c.replace(
  /apiRouter\.put\('\/backups\/schedule', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.put('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/health
c = c.replace(
  /apiRouter\.get\('\/backups\/health', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.get('/backups/health', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

// Handle /backups/schedule GET
c = c.replace(
  /apiRouter\.get\('\/backups\/schedule', async \(req: Request, res: Response\) => \{\n\s*try \{\n\s*const authUser = await getAuthUser\(req\);\n\s*if \(authUser && !isAdmin\(authUser\)\) \{\n\s*return res\.status\(403\)\.json\(\{ success: false, message: '[^']+'\);\n\s*\}/g,
  "apiRouter.get('/backups/schedule', requirePermission(ModuleName.SETTINGS, PermissionAction.MANAGE), (req: Request, res: Response) => {\n  try {"
);

fs.writeFileSync('routes.ts', c);
console.log('Done. Final lines:', c.split('\n').length);
console.log('requirePermission count:', c.match(/requirePermission/g)?.length || 0);
console.log('apiRouter.use(requireAuth):', c.includes('apiRouter.use(requireAuth)'));
console.log('ALLOWLIST_PATHS:', c.includes('ALLOWLIST_PATHS'));
