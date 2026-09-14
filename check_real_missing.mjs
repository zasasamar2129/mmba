import fs from 'fs';
import path from 'path';

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      results.push(fullPath);
    }
  });
  return results;
}

const allFiles = getFiles('src/components');
const allTKeys = new Set();

allFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.matchAll(/\bt\(['"]([^'"]+)['"]\)/g);
  for (const m of matches) {
    allTKeys.add(m[1]);
  }
});

const i18n = fs.readFileSync('src/lib/i18n.ts', 'utf8');
const faMatch = i18n.match(/export const faTranslations: Translations = {([\s\S]*?)};/);
const faKeys = new Set();
if (faMatch) {
  faMatch[1].split('\n').forEach(l => {
    const m = l.match(/'([^']+)':/);
    if (m) faKeys.add(m[1]);
  });
}

const missing = [];
for (const k of allTKeys) {
  if (!faKeys.has(k)) missing.push(k);
}

console.log('ACTUAL MISSING KEYS IN i18n.ts:', missing.length);
console.log(JSON.stringify(missing, null, 2));
