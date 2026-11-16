import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

test('JSON preview combines paragraphs, resolves a resume, skips disabled and duplicate contacts', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-mail-'));
  try {
    const file = path.join(dir, 'queue.json');
    const email = { name: 'Asha', email: 'asha@example.com', subject: 'Hello', message: ['Hello Asha,', 'First paragraph', 'Best regards'], resume: 'resume/mahendra_resumeA.pdf' };
    fs.writeFileSync(file, JSON.stringify({ emails: [email, email, { ...email, email: 'skip@example.com', manual_skip: true }] }));
    const result = spawnSync(process.execPath, ['src/index.js', 'preview', '--json', file, '--sent-log', path.join(dir, 'sent.log'), '--count', '10'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /1 of 1 ready rows/);
    assert.match(result.stdout, /Hello Asha,[\s\S]*First paragraph[\s\S]*Best regards/);
    assert.ok(result.stdout.includes(path.resolve('resume/mahendra_resumeA.pdf')));
    assert.doesNotMatch(result.stdout, /skip@example.com/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('proof-only dry run renders the proof without processing recipients', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'json-proof-'));
  try {
    const file = path.join(dir, 'queue.json');
    const email = { email: 'ready@example.com', subject: 'Proof example', message: ['Hello'] };
    fs.writeFileSync(file, JSON.stringify({ emails: [email] }));
    const result = spawnSync(process.execPath, ['src/index.js', 'send', '--json', file, '--sent-log', path.join(dir, 'sent.log'), '--proof-only', '--dry-run', '--delay', '0', '--jitter', '0'], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /proof copy rendered \(dry-run\)/);
    assert.doesNotMatch(result.stdout, /\[1\/1\]/);
    assert.equal(fs.existsSync(path.join(dir, 'sent.log')), false);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
