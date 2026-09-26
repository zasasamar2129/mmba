// Step 12: tenant context resolution smoke test
import { resolveTenantContext } from '../server/tenantContext';
import { pool } from '../server/pg';

async function main() {
  const req = { headers: { host: 'tenant-a.mmba.example:3000' } } as any;
  const { ctx, status } = await resolveTenantContext(req, 'usr-seed-a');
  console.log('1 subdomain tenant-a ->', ctx ? `${ctx.tenantSlug}/${ctx.tenantId} role=${ctx.membershipRole}` : `FAIL status=${status}`);

  const reqB = { headers: { host: 'tenant-b.mmba.example' } } as any;
  const r2 = await resolveTenantContext(reqB, 'usr-seed-a');
  console.log('2 tenant-b + userA(member of A):', r2.ctx ? 'LEAK!' : `403 blocked status=${r2.status}`);

  const reqU = { headers: { host: 'nope.mmba.example' } } as any;
  const r3 = await resolveTenantContext(reqU, 'usr-seed-a');
  console.log('3 unknown host:', r3.ctx ? 'LEAK!' : `404 no-enum status=${r3.status}`);

  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});