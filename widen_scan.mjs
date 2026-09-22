import fs from 'fs';
import path from 'path';

// Widened scan: catches hardcoded Persian in template literals (backticks),
// toast/error/success calls, and object title:/subtitle: props built from
// template literals — the blind spot the prior classifier missed.

function getFiles(dir) {
  const r = [];
  for (const f of fs.readdirSync(dir)) {
    const fp = path.join(dir, f);
    const s = fs.statSync(fp);
    if (s.isDirectory()) {
      if (f !== 'node_modules' && f !== 'dist') r.push(...getFiles(fp));
    } else if (f.endsWith('.tsx')) r.push(fp);
  }
  return r;
}

const files = getFiles('src/components');
const re = /[؀-ۿ]/;
const BILING = /isRtl|language ===|t\(['`]|labelFa|titleFa|useTranslation/;

let total = 0;
const byFile = {};

for (const f of files) {
  const c = fs.readFileSync(f, 'utf8');
  const lines = c.split('\n');
  let count = 0;

  lines.forEach((l) => {
    if (!re.test(l)) return;
    const t = l.trim();
    if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
    if (BILING.test(t)) return;

    // single-quoted Persian literal
    const mSq = /'[^'\n]*[؀-ۿ][^'\n]*'/.test(l);
    // double-quoted Persian literal
    const mDq = /"[^"\n]*[؀-ۿ][^"\n]*"/.test(l);
    // single-line backtick template literal containing Persian
    const mTick = /`[^`\n]*[؀-ۿ][^`\n]*`/.test(l);
    // Persian inside backticks that SPAN lines: line begins inside a template and ends inside one
    const mTickCont = /`[^`]*$/.test(l.trim()) && /[؀-ۿ]/.test(l);

    if (mSq || mDq || mTick || mTickCont) {
      count++;
    }
  });

  if (count > 0) {
    byFile[f] = count;
    total += count;
  }
}

console.log('WIDENED REMAINING:', total, 'in', Object.keys(byFile).length, 'files');
Object.entries(byFile)
  .sort((a, b) => b[1] - a[1])
  .forEach(([f, c]) => console.log(String(c).padStart(3), ' ', f));