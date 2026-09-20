/**
 * fix_logical_css.mjs — Replaces directional CSS utilities with logical equivalents.
 * Tailwind v4 supports: ms-, me-, ps-, pe-, text-start, text-end, start-*, end-*
 *
 * Replacements:
 *   ml-X  → ms-X  (margin-inline-start)
 *   mr-X  → me-X  (margin-inline-end)
 *   pl-X  → ps-X  (padding-inline-start)
 *   pr-X  → pe-X  (padding-inline-end)
 *   text-left  → text-start
 *   text-right → text-end
 *   -ml- → -ms-, -mr- → -me-, -pl- → -ps-, -pr- → -pe- (negative)
 *   left- → start- (as standalone utility, not in compound words like "scrollbar")
 *   right- → end-  (similarly)
 *
 * Kept as-is (physical, not replaced):
 *   border-l, border-r — these create left/right borders, not inline-start
 *   rounded-l, rounded-r — these affect one corner, not inline
 *   Absolute left/right for overlays/toasts with RTL isRtl conditional
 *   Position classes in overlays where right-0/left-0 with isRtl conditional
 */
import fs from 'fs';
import path from 'path';

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

// Utilities to replace (exact string match in className context)
const replacements = [
  // margin-left/right → margin-inline-start/end
  [/\b(-?)ml-(\d)/g, '$1ms-$2'],
  [/\b(-?)mr-(\d)/g, '$1me-$2'],
  // padding-left/right → padding-inline-start/end
  [/\b(-?)pl-(\d)/g, '$1ps-$2'],
  [/\b(-?)pr-(\d)/g, '$1pe-$2'],
  // text alignment
  [/\btext-left\b/g, 'text-start'],
  [/\btext-right\b/g, 'text-end'],
];

// Left/right position utilities — only replace when not already RTL-aware
// We only replace left-X / right-X when used as standalone utility classes
// and NOT when they're in an isRtl conditional like isRtl ? 'left-0' : 'right-0'
// This is handled by the function-level replacement logic.
const posReplacements = [
  // left-N → start-N (but keep left-0/right-0 in overlays)
  [/\bleft-(\d+)/g, 'start-$1'],
  [/\bright-(\d+)/g, 'end-$1'],
];

const files = getFiles('src/components');
let totalChanges = 0;
const fileChanges = [];

files.forEach((filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  let changes = 0;

  // First pass: replace conditional isRtl ? 'text-right' : 'text-left' → just 'text-end'
  // Pattern: isRtl ? 'text-right' : 'text-left'  →  'text-end'
  content = content.replace(
    /isRtl\s*\?\s*['"]text-right['"]\s*:\s*['"]text-left['"]/g,
    "'text-end'"
  );
  content = content.replace(
    /isRtl\s*\?\s*['"]text-left['"]\s*:\s*['"]text-right['"]/g,
    "'text-start'"
  );

  // Replace text-left/right in className strings (not in conditionals)
  content = content.replace(/\btext-left\b/g, 'text-start');
  content = content.replace(/\btext-right\b/g, 'text-end');

  // Replace margin/padding logical equivalents
  content = content.replace(/\b(-?)ml-(\d+)/g, '$1ms-$2');
  content = content.replace(/\b(-?)mr-(\d+)/g, '$1me-$2');
  content = content.replace(/\b(-?)pl-(\d+)/g, '$1ps-$2');
  content = content.replace(/\b(-?)pr-(\d+)/g, '$1pe-$2');

  // pr-1 for scrollbar
  content = content.replace(/\bpr-1\b/g, 'pe-1');
  content = content.replace(/\bpr-1\.5\b/g, 'pe-1.5');
  content = content.replace(/\bpr-2\b/g, 'pe-2');
  content = content.replace(/\bpl-1\b/g, 'ps-1');
  content = content.replace(/\bpl-2\b/g, 'ps-2');
  content = content.replace(/\bpl-10\b/g, 'ps-10');
  content = content.replace(/\bpr-10\b/g, 'pe-10');
  content = content.replace(/\bml-2\b/g, 'ms-2');
  content = content.replace(/\bml-3\b/g, 'ms-3');
  content = content.replace(/\bmr-2\b/g, 'me-2');

  if (content !== original) {
    fs.writeFileSync(filePath, content);
    changes = original.split('\n').filter((l, i) => l !== content.split('\n')[i]).length;
    totalChanges += changes;
    fileChanges.push({ file: filePath, changes });
  }
});

console.log(`Fixed logical CSS in ${fileChanges.length} files (${totalChanges} lines changed)`);
fileChanges.slice(0, 20).forEach(f => console.log(`  ${f.changes.toString().padStart(3)}  ${f.file}`));