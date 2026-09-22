import fs from 'fs';

const c = fs.readFileSync('src/components/finance/AccountingDashboard.tsx', 'utf8');
const re = /[؀-ۿ]/;
let hard = 0;
c.split('\n').forEach((ln, i) => {
  if (!re.test(ln)) return;
  const t = ln.trim();
  if (!t || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) return;
  if (t.includes('isRtl') || t.includes("language === 'fa'")) return;
  if (t.includes("t('") || t.includes('t(`')) return;
  const mSq = /'[^'\n]*[؀-ۿ][^'\n]*'/.test(ln);
  const mDq = /"[^"\n]*[؀-ۿ][^"\n]*"/.test(ln);
  const mTick = /`[^`\n]*[؀-ۿ][^`\n]*`/.test(ln);
  const mJsx = />[^<{]*[؀-ۿ]/.test(ln) || /[؀-ۿ][^<{]*</.test(ln);
  if (mSq || mDq || mTick || mJsx) {
    hard++;
    console.log(i + 1 + '|' + t.substring(0, 110));
  }
});
console.log('AccountingDashboard hardcoded remaining:', hard);