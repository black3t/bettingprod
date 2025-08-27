// scripts/print-failures.mjs
import fs from 'fs';

const stripAnsi = s => s.replace(
  // eslint-disable-next-line no-control-regex
  /\u001b\[.*?m/g, ''
);
const reportPath = process.argv[2] || 'tmp/jest-report.json';
const out = [];

const data = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
for (const file of data.testResults || []) {
  const failed = file.assertionResults?.filter(r => r.status === 'failed') || [];
  if (!failed.length) continue;
  out.push(`--- ${file.name} ---`);
  for (const t of failed) {
    out.push(`• ${t.fullName}`);
    for (const msg of t.failureMessages || []) {
      out.push(stripAnsi(msg));
    }
    out.push(''); // blank line
  }
  out.push(`--- end ${file.name} ---\n`);
}

const text = out.join('\n');
console.log(text);

// Extra: estrai sintomi DB
const dbFind = text.match(/(SQLITE_BUSY|database is locked|SQLITE_CORRUPT)/g);
if (dbFind) {
  console.error(`\n[DB-SYMPTOMS] Matches: ${dbFind.length}`);
}