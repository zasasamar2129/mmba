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

const suspiciousKeys = ['a', '.', 'canvas', '2d', 'today', 'tomorrow', 'nextWeek', 'nextMonth', ':', '0'];

getFiles('src').forEach(f => {
  const content = fs.readFileSync(f, 'utf8');
  suspiciousKeys.forEach(k => {
    const regex = new RegExp(`\\bt\\(['"]${k}['"]\\)`);
    if (regex.test(content)) {
      console.log(`Suspicious key '${k}' found in ${f}`);
    }
  });
});
