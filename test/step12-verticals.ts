// Step 12: generic vertical isolation test across multiple tables
import { getTenantRepo } from '../server/tenantVerticals';
import { pool } from '../server/pg';

async function main() {
  for (const table of ['lead', 'payment', 'task', 'chatMessage', 'interaction', 'simCard']) {
    const repo = getTenantRepo(table)!;
    if (!repo) { console.log(table, 'MISSING REPO'); continue; }
    // create in tenant A
    const data: any = table === 'lead' ? { leadCode: `L-${Date.now()}`, mobile: `09${Date.now()}`.slice(0, 11), name: 'Lead A' }
      : table === 'payment' ? { customerId: 'c-a', amount: 100 }
      : table === 'task' ? { title: 'Task A', status: 'PENDING' }
      : table === 'chatMessage' ? { conversationId: 'cv-a', senderId: 'u-a', content: 'hi' }
      : table === 'interaction' ? { interactionType: 'incoming_call', startedAt: new Date().toISOString() }
      : { phoneNumber: `09${Date.now()}`.slice(0, 11), operator: 'MCI', status: 'AVAILABLE' };
    const created = await repo.create('ten-seed-a', data);
    const cb: any = created;
    const id = cb?.id ?? cb?.id;
    if (!id) { console.log(table, 'create FAILED', JSON.stringify(created).slice(0, 120)); continue; }
    // cross-tenant read blocked
    const leak = await repo.getById('ten-seed-b', id);
    const own = await repo.getById('ten-seed-a', id);
    // cross-tenant update blocked
    const updLeak = await repo.update('ten-seed-b', id, { status: 'HACKED' });
    // cross-tenant delete blocked
    const delLeak = await repo.remove('ten-seed-b', id);
    console.log(`${table}: create=${id? 'ok':'FAIL'} crossRead=${leak? 'LEAK':'blocked'} own=${own? 'ok':'FAIL'} crossUpd=${updLeak? 'LEAK':'blocked'} crossDel=${delLeak}`);
  }
  await pool.end();
  process.exit(0);
}

main().catch((e) => { console.error('ERR', e.message); process.exit(1); });