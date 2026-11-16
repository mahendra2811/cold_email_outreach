import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProofBody } from '../src/proof.js';

test('proof shows real batch settings and first recipient message', () => {
  const body = buildProofBody({ row: { person_full_name: 'Asha', email: 'asha@example.com', company_guess: 'Example' }, rendered: { subject: 'Hello', text: 'Actual message', replyTo: 'reply@example.com', attachments: [{ path: '/resume.pdf' }] }, credentials: { fromName: 'Mahendra', gmailUser: 'sender@example.com' }, account: 1, readyCount: 80, plannedCount: 50, sentToday: 0, dailyCap: 50, runCap: 50, delay: 45, jitter: 15, proofOnly: false });
  for (const part of ['Mahendra <sender@example.com> (account 1)', 'up to 50 recipient emails', '45–60 seconds', '36.8–49.0 minutes', 'Asha <asha@example.com>', 'Subject: Hello', '/resume.pdf', 'Actual message']) assert.ok(body.includes(part), part);
});
test('proof-only clearly states that no batch will be sent', () => {
  const body = buildProofBody({ row: { email: 'a@example.com' }, rendered: { subject: 'Hi', text: 'Message', attachments: [] }, credentials: { fromName: 'M', gmailUser: 's@example.com' }, account: 0, readyCount: 1, plannedCount: 1, sentToday: 0, dailyCap: 10, runCap: 10, delay: 45, jitter: 15, proofOnly: true });
  assert.match(body, /Proof only \(no recipients will be emailed in this run\)/);
});
