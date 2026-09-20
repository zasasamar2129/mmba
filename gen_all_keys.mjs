import fs from 'fs';

// Reads all unique Persian strings from ui_scan_report.json.
// For each, generates a translation key + both fa and en values.
// Writes the additions as a JSON file that can be merged into i18n.ts.

const report = JSON.parse(fs.readFileSync('ui_scan_report.json', 'utf8'));
const i18n = fs.readFileSync('src/lib/i18n.ts', 'utf8');

function deriveNamespace(file) {
  const rel = file.replace(/\\/g, '/').replace('src/components/', '').replace(/\.tsx?$/, '');
  const parts = rel.split('/');
  return parts[0];
}

function makeKey(fa, ns, idx) {
  const slug = fa.replace(/[،؛؍؟؎!.,?:;()\[\]{}<>\/\\'"`~@#$%^&*+=|]/g, '').trim().substring(0, 45).replace(/\s+/g, '.');
  return `${ns}.${slug}.${idx}`;
}

const seen = new Set();
const additions = {};

report.forEach((r, idx) => {
  const ns = deriveNamespace(r.file);
  const fa = r.text.replace(/^.*?(['"`])(.+?)\1.*$/, '$2').trim();
  if (!fa || fa.length < 2) return;
  const clean = fa.replace(/[،؛؍؟؎!.,?:;()\[\]{}<>\/\\'"`~@#$%^&*+=|]/g, '').trim().replace(/\s+/g, '.').substring(0, 45);
  const key = `${ns}.${clean}`;
  if (seen.has(key)) return;
  seen.add(key);
  additions[key] = { fa, en: `[REVIEW]` };
});

console.log(`Unique keys to add: ${Object.keys(additions).length}`);
fs.writeFileSync('all_keys_to_add.json', JSON.stringify(additions, null, 2));
console.log('Wrote all_keys_to_add.json');
