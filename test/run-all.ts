// ---------------------------------------------------------------------------
// Canonical aggregate test runner — `npm test`
//
// Runs every supported suite in dependency order and reports one summary.
// Exists so that "npm test passed" is a statement about the whole suite
// rather than about whichever script someone remembered to run.
//
//   npm test                      every suite
//   npm test -- --only=db         only suites that need a database
//   npm test -- --only=unit       only pure-logic suites
//   npm test -- --only=http       only the HTTP integration suites
//   npm test -- --skip=legacy     skip the slow scratch-database suite
//
// Every suite that touches data uses REAL PostgreSQL. None of them are mocked:
// a mock cannot demonstrate that a UNIQUE constraint actually serialises ten
// concurrent inserts, and that is the property being tested.
// ---------------------------------------------------------------------------
import 'dotenv/config';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM has no __dirname; derive it from this module's own URL.
const HERE = path.dirname(fileURLToPath(import.meta.url));

type Tier = 'unit' | 'db' | 'http';

interface Suite {
  name: string;
  file: string;
  tier: Tier;
  /** Suites that create/destroy scratch databases are slow and stateful. */
  slow?: boolean;
}

const SUITES: readonly Suite[] = [
  // Pure logic — no database.
  { name: 'step11bfix authorization (logic)', file: 'step11bfix-authorization.ts', tier: 'unit' },
  { name: 'step12fix legacy JSON tenant gate', file: 'step12fix-legacy-json-guard.ts', tier: 'unit' },

  // Database-backed.
  { name: 'step12 tenant context', file: 'step12-tenant-context.ts', tier: 'db' },
  { name: 'step12 isolation', file: 'step12-isolation.ts', tier: 'db' },
  { name: 'step12 verticals', file: 'step12-verticals.ts', tier: 'db' },
  { name: 'step12 provisioning', file: 'step12-provisioning.ts', tier: 'db' },
  { name: 'step12fix concurrency + domain + identity', file: 'step12fix-concurrency-domain.ts', tier: 'db' },
  { name: 'step12fix legacy migration', file: 'step12fix-legacy-migration.ts', tier: 'db', slow: true },
  { name: 'step12fix fresh database', file: 'step12fix-fresh-db.ts', tier: 'db', slow: true },

  // HTTP integration — each boots a real server.
  { name: 'step11bfix generic routes (http)', file: 'step11bfix-generic-routes-http.ts', tier: 'http' },
  { name: 'step12 platform (http)', file: 'step12-platform-http.ts', tier: 'http' },
];

function parseArgs(argv: string[]): { only?: Tier; skipSlow: boolean; includeSlow: boolean } {
  const onlyArg = argv.find((a) => a.startsWith('--only='));
  const skipArg = argv.find((a) => a.startsWith('--skip='));
  const skipNames = skipArg ? skipArg.slice('--skip='.length).split(',') : [];
  return {
    only: onlyArg ? (onlyArg.slice('--only='.length).trim() as Tier) : undefined,
    skipSlow: skipNames.includes('legacy') || skipNames.includes('slow'),
    includeSlow: !skipNames.includes('legacy') && !skipNames.includes('slow'),
  };
}

function runSuite(suite: Suite): { ok: boolean; code: number; output: string } {
  const file = path.join(HERE, suite.file);
  if (!fs.existsSync(file)) {
    return { ok: false, code: 127, output: `suite file missing: ${file}` };
  }
  const isWindows = process.platform === 'win32';
  const tsx = path.join(process.cwd(), 'node_modules', '.bin', isWindows ? 'tsx.cmd' : 'tsx');
  const opts: SpawnSyncOptions = {
    encoding: 'utf-8',
    env: { ...process.env, FORCE_COLOR: '0' },
    shell: isWindows,
    maxBuffer: 32 * 1024 * 1024,
  };
  const r = spawnSync(tsx, [`"${file}"`], opts);
  return {
    ok: r.status === 0,
    code: r.status ?? -1,
    output: `${r.stdout || ''}${r.stderr || ''}`,
  };
}

function main(): void {
  const { only, skipSlow, includeSlow } = parseArgs(process.argv.slice(2));

  if (!process.env.DATABASE_URL) {
    console.log('\nDATABASE_URL is not set. Copy .env.example to .env first.');
  }

  const selected = SUITES.filter((s) => {
    if (only && s.tier !== only && !(only === 'db' && s.tier === 'http')) return false;
    if (s.slow && !includeSlow && !only) return false;
    if (s.slow && skipSlow) return false;
    return true;
  });

  console.log('='.repeat(72));
  console.log('MMBA — canonical test suite');
  console.log('='.repeat(72));
  console.log(`Suites: ${selected.length} of ${SUITES.length}`);
  if (only) console.log(`Filter: --only=${only}`);
  if (!process.env.DATABASE_URL) {
    console.log('\nDATABASE_URL is not set. Database suites will fail.');
    console.log('Copy .env.example to .env and set a reachable PostgreSQL URL.');
  }
  console.log('='.repeat(72));

  const results: Array<{ suite: string; ok: boolean; code: number; output: string }> = [];

  for (const suite of selected) {
    console.log(`\n${'▶'.repeat(3)} ${suite.name}  [${suite.tier}]`);
    console.log('-'.repeat(72));
    const started = Date.now();
    const result = runSuite(suite);
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    // Echo the suite output so a failure is diagnosable from the npm log alone.
    process.stdout.write(result.output.endsWith('\n') ? result.output : result.output + '\n');
    console.log('-'.repeat(72));
    console.log(`${result.ok ? '✓ PASS' : '✗ FAIL'} (${suite.name}) — ${seconds}s`);
    results.push({ suite: suite.name, ok: result.ok, code: result.code, output: result.output });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${'='.repeat(72)}`);
  console.log('SUMMARY');
  console.log('='.repeat(72));
  for (const r of results) {
    console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.suite}${r.ok ? '' : `  (exit ${r.code})`}`);
  }
  console.log('='.repeat(72));
  console.log(`${results.length - failed.length}/${results.length} suites passed`);

  if (failed.length > 0) {
    console.log('\nFailing suites:');
    failed.forEach((f) => console.log(`  - ${f.suite}`));
    process.exit(1);
  }
  console.log('\nALL SUITES PASSED');
  process.exit(0);
}

main();
