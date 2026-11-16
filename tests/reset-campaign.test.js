import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script = path.resolve('scripts/reset-campaign.js');

test('campaign reset requires explicit flag and preserves backups, review flags, and original content', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-campaign-'));
  try {
    fs.mkdirSync(path.join(dir, 'data/email_json'), { recursive: true });
    const file = path.join(dir, 'data/email_json/emails.json');
    const queue = { emails: [{ email: 'person@example.com', sent: true, sent_at: '2026-01-01', sent_account: 0, manual_skip: true }] };
    fs.writeFileSync(file, JSON.stringify(queue));
    fs.writeFileSync(path.join(dir, 'sent.log'), '2026-01-01T00:00:00Z,person@example.com\n');
    fs.writeFileSync(path.join(dir, 'sent.1.log'), '2026-01-01T00:00:00Z,other@example.com\n');
    const run = (...args) => spawnSync(process.execPath, [script, ...args], { cwd: dir, encoding: 'utf8' });
    assert.equal(run().status, 0);
    assert.equal(JSON.parse(fs.readFileSync(file)).emails[0].sent, true);
    assert.equal(run('--confirm-reset').status, 0);
    const item = JSON.parse(fs.readFileSync(file)).emails[0];
    assert.equal(item.sent, undefined);
    assert.equal(item.manual_skip, true);
    assert.equal(fs.existsSync(path.join(dir, 'sent.log')), false);
    assert.equal(fs.existsSync(path.join(dir, 'sent.1.log')), false);
    const backup = path.join(dir, 'archive/campaign-resets', fs.readdirSync(path.join(dir, 'archive/campaign-resets'))[0]);
    assert.equal(JSON.parse(fs.readFileSync(path.join(backup, 'email_json/emails.json'))).emails[0].sent, true);
    assert.ok(fs.existsSync(path.join(backup, 'sent.1.log')));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('invalid queue prevents a reset and leaves logs unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'reset-invalid-'));
  try {
    fs.mkdirSync(path.join(dir, 'data/email_json'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'data/email_json/broken.json'), '{}');
    fs.writeFileSync(path.join(dir, 'sent.log'), 'original');
    const result = spawnSync(process.execPath, [script, '--confirm-reset'], { cwd: dir, encoding: 'utf8' });
    assert.notEqual(result.status, 0);
    assert.equal(fs.readFileSync(path.join(dir, 'sent.log'), 'utf8'), 'original');
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
