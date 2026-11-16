#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const project = process.cwd();
const queueDir = path.join(project, 'data', 'email_json');
const queueFiles = fs.existsSync(queueDir)
  ? fs.readdirSync(queueDir).filter(name => name.toLowerCase().endsWith('.json')).sort()
  : [];
const logs = fs.readdirSync(project).filter(name => /^sent(?:\.\d+)?\.log$/.test(name)).sort();

if (!process.argv.includes('--confirm-reset')) {
  console.log('Reset preview:');
  console.log(`  JSON files: ${queueFiles.length}; account logs: ${logs.length}`);
  console.log('  Sent markers and campaign account logs will be cleared after backups.');
  console.log('  Daily counts will also reset because they are stored in those logs.');
  console.log('To perform the reset, stop all send processes and run: npm run mail:reset -- --confirm-reset');
  process.exit(0);
}

if (!queueFiles.length) throw new Error(`No JSON queue files found in ${queueDir}; nothing was reset`);
const queues = queueFiles.map(name => {
  const data = JSON.parse(fs.readFileSync(path.join(queueDir, name), 'utf8'));
  if (!data || !Array.isArray(data.emails) || data.emails.some(entry => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    throw new Error(`${name}: expected an emails array of objects; nothing was reset`);
  }
  return { name, data };
});

const archiveRoot = path.join(project, 'archive', 'campaign-resets');
fs.mkdirSync(archiveRoot, { recursive: true });
const backup = fs.mkdtempSync(path.join(archiveRoot, 'reset-'));
fs.mkdirSync(path.join(backup, 'email_json'));
for (const { name } of queues) fs.copyFileSync(path.join(queueDir, name), path.join(backup, 'email_json', name));
for (const name of logs) fs.copyFileSync(path.join(project, name), path.join(backup, name));

let marked = 0;
try {
  for (const { name, data } of queues) {
    for (const entry of data.emails) {
      if (entry.sent === true) marked++;
      delete entry.sent;
      delete entry.sent_at;
      delete entry.sent_account;
    }
    const target = path.join(queueDir, name);
    const temp = `${target}.reset-${process.pid}.tmp`;
    try {
      fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
      fs.renameSync(temp, target);
    } finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
  }
  for (const name of logs) fs.unlinkSync(path.join(project, name));
} catch (error) {
  try {
    for (const { name } of queues) fs.copyFileSync(path.join(backup, 'email_json', name), path.join(queueDir, name));
    for (const name of logs) fs.copyFileSync(path.join(backup, name), path.join(project, name));
  } catch (restoreError) {
    console.error(`Automatic restore failed: ${restoreError.message}. Restore files from ${backup}`);
  }
  throw error;
}
console.log(`Reset complete: cleared ${marked} sent markers in ${queues.length} JSON file(s); archived ${logs.length} account log(s).`);
console.log(`Backups: ${backup}`);
console.log('Daily counts have reset too. Previously contacted addresses are eligible again.');
