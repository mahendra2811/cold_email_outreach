/** Build the proof body using the actual runtime account and batch settings. */
export function buildProofBody({ row, rendered, credentials, account, readyCount, plannedCount, sentToday, dailyCap, runCap, delay, jitter, proofOnly }) {
  const pauses = Math.max(0, plannedCount - 1);
  const minMinutes = pauses * delay / 60;
  const maxMinutes = pauses * (delay + jitter) / 60;
  const attachments = rendered.attachments.map(item => item.path).join('; ') || 'none';
  return [
    '--- PROOF COPY AND BATCH PLAN ---',
    `Mode: ${proofOnly ? 'Proof only (no recipients will be emailed in this run)' : 'Live batch (starts after this proof)'}`,
    `Sender: ${credentials.fromName} <${credentials.gmailUser}> (account ${account})`,
    `Ready in queue for this and remaining accounts: ${readyCount}`,
    `Planned for this account: up to ${plannedCount} recipient emails`,
    `Run cap: ${runCap}; daily cap per account: ${dailyCap || 'unlimited'}; already sent today: ${sentToday}`,
    `Delay between emails: ${delay}–${delay + jitter} seconds`,
    `Estimated waiting time: ${minMinutes.toFixed(1)}–${maxMinutes.toFixed(1)} minutes, plus proof, sending and error time`,
    'Actual count and time can vary due to errors, invalid entries, interruption or account rotation.',
    '',
    `First recipient: ${row.person_full_name || '(name not provided)'} <${row.email}>`,
    `Company: ${row.company_guess || '(not provided)'}`,
    `Subject: ${rendered.subject}`,
    `Reply-To: ${rendered.replyTo || '(sender)'}`,
    `Attachments: ${attachments}`,
    '',
    '--- FIRST RECIPIENT MESSAGE ---',
    rendered.text,
  ].join('\n');
}
