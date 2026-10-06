import 'dotenv/config';
import { bootstrap } from './harness';
import { LicensingService, LicenseStateService } from '../server/licensingService';
import { query } from '../server/pg';

bootstrap();

async function runTests() {
  console.log('Running Step 13 Licensing Tests...');

  // 1. Create a tenant and a plan for testing
  const slug = 'test-tenant-' + Date.now();
  const tenantResult = await query('INSERT INTO tenant (id, name, slug, "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id', ['Test Tenant', slug]);
  const tenantId = tenantResult[0].id;

  const planResult = await query('INSERT INTO plan (id, key, name, "updatedAt") VALUES (gen_random_uuid(), $1, $2, NOW()) RETURNING id', ['TEST_PLAN_' + Date.now(), 'Test Plan']);
  const planId = planResult[0].id;

  // 2. License creation
  await query(
    'INSERT INTO license (id, "tenantId", "planId", status, "updatedAt") VALUES (gen_random_uuid(), $1, $2, $3, NOW())',
    [tenantId, planId, 'TRIAL']
  );

  // 3. LicensingService Tests
  const license = await LicensingService.getTenantLicense(tenantId);
  if (!license || license.status !== 'TRIAL') throw new Error('License creation failed');
  console.log('Test 1: License creation passed');

  // 4. State Machine Tests
  await LicenseStateService.transition(tenantId, 'ACTIVE', 'Upgrade to active', 'admin-id');
  const activeLicense = await LicensingService.getTenantLicense(tenantId);
  if (activeLicense?.status !== 'ACTIVE') throw new Error('License activation failed');
  console.log('Test 2: License activation passed');

  // 5. Invalid transition
  try {
      await LicenseStateService.transition(tenantId, 'TRIAL', 'Revert to trial', 'admin-id');
      throw new Error('Should have failed transition');
  } catch (e) {
      console.log('Test 3: Invalid transition rejected');
  }

  console.log('All Step 13 Licensing tests passed!');
  process.exit(0);
}

runTests().catch(e => {
  console.error(e);
  process.exit(1);
});
