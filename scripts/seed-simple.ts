import 'dotenv/config';
import { query, pool } from '../server/pg';
import crypto from 'crypto';

const now = () => new Date().toISOString();
const pid = (s: string) => 'pg-' + crypto.createHash('sha256').update(s).digest('hex').slice(0, 24);
const TENANT_ID = 'ten-initial';

async function main() {
  await query(
    `INSERT INTO "businessCategory" (id, key, name, description, "isActive", "sortOrder", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (key) DO NOTHING`,
    [pid('bc:GENERAL'), 'GENERAL', 'عمومی', 'GENERAL', true, 0]
  );
  await query(
    `INSERT INTO plan (id, key, name, description, "isActive", "sortOrder", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (key) DO NOTHING`,
    [pid('plan:PRO'), 'PRO', 'Pro', 'PRO', true, 1]
  );
  const rows = await query<{ id: string }>('SELECT id FROM plan WHERE key = $1', ['PRO']);
  const planId = rows[0]?.id;
  await query(
    `INSERT INTO entitlement (id, "planId", module, action, "limitType", "isEnabled", "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT ("planId", module, action) DO NOTHING`,
    [pid('ent:'+planId+':CUSTOMERS:VIEW'), planId, 'CUSTOMERS', 'VIEW', 'FEATURE', true]
  );
  await query('UPDATE tenant SET "planId" = $1 WHERE id = $2', [planId, TENANT_ID]);
  await query(
    `INSERT INTO license (id, "tenantId", "planId", status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT ("tenantId") DO NOTHING`,
    [pid('license:'+TENANT_ID), TENANT_ID, planId, 'ACTIVE']
  );
  await query(
    `INSERT INTO "tenantDomain" (id, "tenantId", hostname, type, "isPrimary", status, "createdAt", "updatedAt")
     VALUES ($1,$2,$3,$4,$5,$6,$7,$7) ON CONFLICT (hostname) DO NOTHING`,
    [pid('domain:'+TENANT_ID), TENANT_ID, 'initial.mmba.example', 'SUBDOMAIN', true, 'ACTIVE']
  );
  console.log('seed done');
  const t = await query('SELECT slug, status FROM tenant');
  const d = await query('SELECT hostname, type, status FROM "tenantDomain"');
  const l = await query('SELECT "tenantId", status FROM license');
  console.log(JSON.stringify({ tenants: t, domains: d, licenses: l }, null, 2));
  await pool.end();
  process.exit(0);
}
main().catch((e: any) => { console.error(e); process.exit(1); });
