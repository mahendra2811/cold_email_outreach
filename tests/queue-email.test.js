import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import XLSX from 'xlsx';

function fixture(attachment) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'outreach-test-'));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ email: 'person@example.com', person_full_name: 'Asha Rao', company_guess: 'Example', subject: 'Hello {first_name}', body: 'Dear {full_name} at {company}', attachment, reply_to: 'replies@example.com' }]), 'Active_Queue');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['T1_NAMED_PERSON', 'old body'], ['T2_ROLE_INBOX', 'other body']]), 'Templates');
  const file = path.join(dir, 'queue.xlsx');
  XLSX.writeFile(wb, file);
  return { dir, file };
}
function preview(file, dir) {
  return spawnSync(process.execPath, ['src/index.js', 'preview', '--file', file, '--sent-log', path.join(dir, 'sent.log')], { encoding: 'utf8' });
}
test('preview renders row content, reply address, and workbook-relative attachment', () => {
  const { dir, file } = fixture('resume.pdf');
  try {
    fs.writeFileSync(path.join(dir, 'resume.pdf'), 'pdf');
    const result = preview(file, dir);
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Hello Asha/);
    assert.match(result.stdout, /Dear Asha Rao at Example/);
    assert.match(result.stdout, /replies@example.com/);
    assert.ok(result.stdout.includes(path.join(dir, 'resume.pdf')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('preview reports a missing attachment instead of rendering a sendable email', () => {
  const { dir, file } = fixture('missing.pdf');
  try {
    const result = preview(file, dir);
    assert.match(result.stdout + result.stderr, /attachment not found: missing.pdf/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('category selects a shared resume and a row attachment overrides it', () => {
  const { dir, file } = fixture('');
  try {
    const project = path.join(dir, 'app');
    fs.mkdirSync(project);
    fs.cpSync('src', path.join(project, 'src'), { recursive: true });
    fs.writeFileSync(path.join(project, 'package.json'), '{"type":"module"}');
    fs.symlinkSync(path.resolve('node_modules'), path.join(project, 'node_modules'));
    fs.writeFileSync(path.join(project, 'attachment-categories.json'), JSON.stringify({ 'frontend development': '../shared.pdf' }));
    fs.writeFileSync(path.join(dir, 'shared.pdf'), 'pdf');
    fs.writeFileSync(path.join(dir, 'special.pdf'), 'pdf');
    const wb = XLSX.readFile(file);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Active_Queue);
    rows[0].category = 'Frontend Development';
    wb.Sheets.Active_Queue = XLSX.utils.json_to_sheet(rows);
    XLSX.writeFile(wb, file);
    const run = () => spawnSync(process.execPath, [path.join(project, 'src/index.js'), 'preview', '--file', file, '--sent-log', path.join(dir, 'sent.log')], { encoding: 'utf8' });
    assert.ok(run().stdout.includes(path.join(dir, 'shared.pdf')));
    rows[0].attachment = 'special.pdf';
    wb.Sheets.Active_Queue = XLSX.utils.json_to_sheet(rows);
    XLSX.writeFile(wb, file);
    assert.ok(run().stdout.includes(path.join(dir, 'special.pdf')));
    rows[0].attachment = '';
    rows[0].category = 'unknown';
    wb.Sheets.Active_Queue = XLSX.utils.json_to_sheet(rows);
    XLSX.writeFile(wb, file);
    const result = run();
    assert.match(result.stdout + result.stderr, /unknown attachment category/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('separate message paragraphs are sent in order and reject an ambiguous body', () => {
  const { dir, file } = fixture('');
  try {
    const wb = XLSX.readFile(file);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Active_Queue);
    rows[0].body = '';
    rows[0].greeting = 'Hello {first_name},';
    rows[0].paragraph_1 = 'First paragraph.';
    rows[0].paragraph_3 = 'Third paragraph.';
    rows[0].closing = 'Regards, Mahendra';
    wb.Sheets.Active_Queue = XLSX.utils.json_to_sheet(rows);
    XLSX.writeFile(wb, file);
    let result = preview(file, dir);
    assert.match(result.stdout, /Hello Asha,[\s\S]*First paragraph\.[\s\S]*Third paragraph\.[\s\S]*Regards, Mahendra/);
    rows[0].body = 'Whole message';
    wb.Sheets.Active_Queue = XLSX.utils.json_to_sheet(rows);
    XLSX.writeFile(wb, file);
    result = preview(file, dir);
    assert.match(result.stdout + result.stderr, /fill either body or the greeting/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
