import fs from 'fs';
import path from 'path';

// Collect all files in src/components/
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
console.log(`Found ${allFiles.length} files in src/components`);

const allTKeys = new Set();

allFiles.forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  const matches = content.matchAll(/t\(['"]([^'"]+)['"]\)/g);
  for (const m of matches) {
    allTKeys.add(m[1]);
  }
});

console.log(`Total unique t() keys used across components: ${allTKeys.size}`);

// Read i18n.ts
const i18n = fs.readFileSync('src/lib/i18n.ts', 'utf8');

const faMatch = i18n.match(/export const faTranslations: Translations = {([\s\S]*?)};/);
const enMatch = i18n.match(/export const enTranslations: Translations = {([\s\S]*?)};/);

const faKeys = new Set();
const enKeys = new Set();

if (faMatch) {
  faMatch[1].split('\n').forEach(l => {
    const m = l.match(/'([^']+)':/);
    if (m) faKeys.add(m[1]);
  });
}

if (enMatch) {
  enMatch[1].split('\n').forEach(l => {
    const m = l.match(/'([^']+)':/);
    if (m) enKeys.add(m[1]);
  });
}

console.log(`faKeys: ${faKeys.size}, enKeys: ${enKeys.size}`);

const missingInFa = [];
const missingInEn = [];

for (const k of allTKeys) {
  if (!faKeys.has(k)) missingInFa.push(k);
  if (!enKeys.has(k)) missingInEn.push(k);
}

console.log(`Missing in faTranslations (${missingInFa.length}):`, missingInFa);
console.log(`Missing in enTranslations (${missingInEn.length}):`, missingInEn);
