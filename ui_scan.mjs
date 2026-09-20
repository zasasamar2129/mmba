import fs from 'fs';
import path from 'path';

// Detects hardcoded Persian in UI string contexts:
//   "persian text" as double-quoted string literal
//   label: 'persian', title: 'persian', etc.
//   { 'persian' } state strings
//   JSX: > persian text <
function getFiles(dir) {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const s = fs.statSync(fp);
    if (s.isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') results.push(...getFiles(fp));
    } else if (f.endsWith('.tsx')) results.push(fp);
  }
  return results;
}

const files = getFiles('src/components');
const re = /[؀-ۿ]/;
const banned = /node_modules|\.d\.ts$/;
const report = [];

for (const f of files) {
  if (banned.test(f)) continue;
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (!re.test(l)) return;
    const t = l.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
    // skip lines that purely reference t() dict lookups
    if (t.includes("t('") || t.includes('t(`') || t.includes('useT')) return;
    // A string literal containing Persian
    const matchesDq = /"[^"\n]*[؀-ۿ][^"\n]*"/.test(l);
    const matchesSq = /'[^'\n]*[؀-ۿ][^'\n]*'/.test(l);
    const matchesJsx = />\s*[؀-ۿ]/.test(l) || /[؀-ۿ]\s*</.test(l);
    if (matchesDq || matchesSq || matchesJsx) {
      report.push({ file: f, line: i + 1, text: t, kind: matchesDq ? 'dq' : matchesSq ? 'sq' : 'jsx' });
    }
  });
}

const byFile = {};
report.forEach((r) => { byFile[r.file] = (byFile[r.file] || 0) + 1; });
console.log(`Total UI-string Persian: ${report.length}`);
console.log('By file:');
Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 50)
  .forEach(([f, c]) => console.log('  ' + String(c).padStart(3) + '  ' + f));

fs.writeFileSync('ui_scan_report.json', JSON.stringify(report, null, 2));
console.log('\nWrote ui_scan_report.json');