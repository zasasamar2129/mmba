import fs from 'fs';
import path from 'path';

// Step 7 translation audit tool.
// 1. Scans all src files for hardcoded Persian (Unicode 0600-06FF) outside the i18n dictionary.
// 2. Ignores translation dict files, comment lines, and known user-data/example contexts.
// 3. Reports file:line so regressions are caught.
// Usage: node audit_hardcoded.mjs

function getFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (file === 'node_modules' || file === 'dist' || file === '.git') return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results.push(...getFiles(fullPath));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.tsx') || fullPath.endsWith('.html') || fullPath.endsWith('.css')) {
      results.push(fullPath);
    }
  });
  return results;
}

const persianRegex = /[؀-ۿ]/;
const IGNORE_DIRS = ['src/lib/i18n.ts', 'new_keys.json'];

// Lines that are comments, imports, or pure ASCII tokens are skipped.
function isCommentOrNoise(line) {
  const t = line.trim();
  if (!t) return true;
  if (t.startsWith('//') || t.startsWith('/*') || t.startsWith('*') || t.startsWith('<!--')) return true;
  if (t.startsWith('import ') || t.startsWith('export ') || t.startsWith('const ')) return false;
  return false;
}

// Sample data placeholder values (example/seed/user data) - these get reported but flagged.
const files = getFiles('src');
const report = [];
const sampleOnly = [];

files.forEach((f) => {
  if (IGNORE_DIRS.some((ig) => f.includes(ig))) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (isCommentOrNoise(line)) return;
    if (!persianRegex.test(line)) return;
    const lineNo = idx + 1;

    // Heuristic: lines inside a t('...') call are fine — the key references dict.
    if (line.includes(`t('`) || line.includes(`t(\``)) return;

    // Lines that are just dictionary value accesses are fine.
    if (/faTranslations\[|enTranslations\[/.test(line)) return;

    const isProbablyData = /name.*["']|title.*["']|example|sample|seed|demo|mohammad|ali|test|لورم|متن نمونه/i.test(line);
    report.push({ file: f, line: lineNo, text: line.trim(), data: isProbablyData });
  });
});

console.log(`=== Hardcoded Persian audit (${files.length} files) ===`);
console.log(`Total Persian lines: ${report.length}`);
console.log(`Data/example flagged (low priority): ${report.filter((r) => r.data).length}`);

// Group by file
const byFile = {};
report.forEach((r) => {
  byFile[r.file] = (byFile[r.file] || 0) + 1;
});

console.log('\n--- By file (non-data lines) ---');
Object.entries(byFile)
  .filter(([f]) => !report.find((r) => r.file === f && r.data))
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([f, c]) => console.log(`  ${c.toString().padStart(3)}  ${f}`));

if (process.argv.includes('--json')) {
  fs.writeFileSync('hardcoded_audit_report.json', JSON.stringify(report, null, 2));
  console.log('\nWrote hardcoded_audit_report.json');
}