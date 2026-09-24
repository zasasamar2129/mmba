// Step 12: cross-tenant isolation smoke test (run: npx tsx test/step12-isolation.ts)
import { customerRepository } from '../server/customerRepository';
import { pool } from '../server/pg';

async function main() {
  const c = await customerRepository.create('ten-seed-a', { name: 'Ali A', mobile: '09120000001', code: 'CUST-A-1' });
  console.log('1 create:', c.id, c.name, 'tenant:', c.tenantId);

  const leak = await customerRepository.getById('ten-seed-b', c.id);
  console.log('2 cross-tenant read:', leak ? 'LEAK!' : 'null (isolated)');

  const own = await customerRepository.getById('ten-seed-a', c.id);
  console.log('3 same-tenant read:', own ? own.name : 'FAIL');

  const updLeak = await customerRepository.update('ten-seed-b', c.id, { name: 'Hacked' });
  console.log('4 cross-tenant update:', updLeak ? 'LEAK!' : 'null (blocked)');

  const listA = await customerRepository.list('ten-seed-a', {});
  const listB = await customerRepository.list('ten-seed-b', {});
  console.log('5 listA:', listA.total, 'rows | listB:', listB.total, 'rows (B should be 0)');

  console.log('6 cross-tenant delete affected:', await customerRepository.remove('ten-seed-b', c.id), '(should be 0)');
  console.log('7 same-tenant delete affected:', await customerRepository.remove('ten-seed-a', c.id), '(should be 1)');
  console.log('8 getById after delete:', (await customerRepository.getById('ten-seed-a', c.id)) ? 'still present' : 'null (soft-deleted)');
  console.log('9 listA after delete:', (await customerRepository.list('ten-seed-a', {})).total, 'rows');
  await pool.end();
  process.exit(0);
}

main().catch((e) => {
  console.error('TEST ERR:', e.message);
  process.exit(1);
});