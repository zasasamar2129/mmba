import fs from 'fs';

const i18n = fs.readFileSync('src/lib/i18n.ts', 'utf8');

const faMatch = i18n.match(/export const faTranslations: Translations = {([\s\S]*?)};/);
const keys = new Set();
if (faMatch) {
  faMatch[1].split('\n').forEach(l => {
    const m = l.match(/'([^']+)':/);
    if (m) keys.add(m[1]);
  });
}

console.log('Total keys in i18n:', keys.size);

const components = [
  'src/components/sims/SimList.tsx',
  'src/components/sims/SimFormModal.tsx',
  'src/components/repairs/RepairList.tsx',
  'src/components/repairs/RepairFormModal.tsx',
  'src/components/attachments/AttachmentList.tsx',
  'src/components/finances/PaymentList.tsx',
  'src/components/finances/PaymentFormModal.tsx',
  'src/components/finances/CheckList.tsx',
  'src/components/finances/CheckFormModal.tsx',
  'src/components/contracts/ContractList.tsx',
  'src/components/contracts/ContractFormModal.tsx',
  'src/components/reports/ReportsDashboard.tsx',
  'src/components/admin/AdminUserMatrix.tsx',
  'src/components/admin/AuditLogViewer.tsx',
  'src/components/admin/BackupManager.tsx',
  'src/components/admin/SettingsBackup.tsx',
  'src/components/calls/CallList.tsx',
  'src/components/tasks/TaskList.tsx',
  'src/components/customers/CustomerList.tsx'
];

const missingKeys = {};

components.forEach(file => {
  if (!fs.existsSync(file)) {
    console.log('File not found:', file);
    return;
  }
  const content = fs.readFileSync(file, 'utf8');
  const tMatches = content.matchAll(/t\(['"]([^'"]+)['"]\)/g);
  for (const match of tMatches) {
    const k = match[1];
    if (!keys.has(k)) {
      if (!missingKeys[file]) missingKeys[file] = [];
      if (!missingKeys[file].includes(k)) missingKeys[file].push(k);
    }
  }
});

console.log('MISSING KEYS BY FILE:');
console.log(JSON.stringify(missingKeys, null, 2));
