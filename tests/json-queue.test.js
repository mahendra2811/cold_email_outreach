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

test('shared history skips addresses sent by any account and JSON markers', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-history-'));
  try {
    const file = path.join(dir, 'queue.json');
    const mk = email => ({ email, subject: 'Hi', message: ['Hello'] });
    fs.writeFileSync(file, JSON.stringify({ emails: [mk('account0@example.com'), mk('account1@example.com'), { ...mk('marked@example.com'), sent: true }, mk('ready@example.com')] }));
    fs.writeFileSync(path.join(dir, 'sent.log'), '2026-01-01T00:00:00Z,account0@example.com\n');
    fs.writeFileSync(path.join(dir, 'sent.1.log'), '2026-01-01T00:00:00Z,account1@example.com\n');
    const result = spawnSync(process.execPath, ['src/index.js', 'stats', '--json', file, '--sent-log', path.join(dir, 'sent.1.log')], { encoding: 'utf8' });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Already sent:\s+3/);
    assert.match(result.stdout, /Ready to send:\s+1/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('successful-send marker preserves other JSON entries and refuses changed recipients', async () => {
  const { markJsonSent } = await import('../src/jsonQueue.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mark-sent-'));
  try {
    const file = path.join(dir, 'queue.json');
    fs.writeFileSync(file, JSON.stringify({ emails: [{ email: 'one@example.com' }, { email: 'two@example.com', manual_skip: true }] }));
    markJsonSent({ sourceFile: file, sourceIndex: 0, email: 'one@example.com' }, 1, '2026-01-01T00:00:00Z');
    const data = JSON.parse(fs.readFileSync(file));
    assert.equal(data.emails[0].sent, true);
    assert.equal(data.emails[0].sent_account, 1);
    assert.equal(data.emails[0].sent_at, '2026-01-01T00:00:00Z');
    assert.equal(data.emails[1].manual_skip, true);
    assert.throws(() => markJsonSent({ sourceFile: file, sourceIndex: 0, email: 'other@example.com' }, 0), /changed during sending/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
