import fs from 'fs';

// Triage a single file: list lines containing Persian NOT in any bilingual form.
// Catches single/double-quoted literals, backtick template literals, and JSX text.
const file = process.argv[2];
if (!file) {
  console.error('usage: node triage.mjs <file>');
  process.exit(1);
}
const c = fs.readFileSync(file, 'utf8');
const re = /[؀-ۿ]/;
c.split('\n').forEach((ln, i) => {
  if (!re.test(ln)) return;
  const t = ln.trim();
  if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
  if (t.includes('isRtl') || t.includes("language === 'fa'")) return;
  if (t.includes("t('") || t.includes('t(`')) return;
  const mSq = /'[^'\n]*[؀-ۿ][^'\n]*'/.test(ln);
  const mDq = /"[^"\n]*[؀-ۿ][^"\n]*"/.test(ln);
  const mJsx = />[^<{]*[؀-ۿ]/.test(ln) || /[؀-ۿ][^<{]*</.test(ln);
  // crude backtick presence (multi-line template)
  const mTickOpen = /`[^`]*$/.test(ln.trim()) && re.test(ln);
  if (mSq || mDq || mJsx || mTickOpen) {
    console.log(i + 1 + '|' + t.substring(0, 100));
  }
});