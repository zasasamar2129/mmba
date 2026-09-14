import fs from 'fs';

const files = [
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
];

const persianRegex = /[\u0600-\u06FF]/;

const report = {};

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  const persianLines = [];
  lines.forEach((line, idx) => {
    // ignore comments
    if (line.trim().startsWith('//') || line.trim().startsWith('/*')) return;
    if (persianRegex.test(line)) {
      persianLines.push({ line: idx + 1, text: line.trim() });
    }
  });
  report[f] = {
    totalPersianLines: persianLines.length,
    sampleLines: persianLines.slice(0, 10)
  };
});

console.log(JSON.stringify(report, null, 2));
