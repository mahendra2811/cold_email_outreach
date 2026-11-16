import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATE_T1 } from './config.js';

// Relative resume paths in JSON are rooted at the project directory.
export function loadJsonQueue(inputPath) {
  const absolute = path.resolve(inputPath);
  const files = fs.statSync(absolute).isDirectory()
    ? fs.readdirSync(absolute).filter(name => name.toLowerCase().endsWith('.json')).sort().map(name => path.join(absolute, name))
    : [absolute];
  const rows = [];
  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!data || !Array.isArray(data.emails)) throw new Error(`${file}: expected an emails array`);
    data.emails.forEach((entry, i) => {
      if (!entry || typeof entry !== 'object' || !Array.isArray(entry.message) || entry.message.some(part => typeof part !== 'string')) {
        throw new Error(`${file}, email ${i + 1}: message must be an array of strings`);
      }
      const str = value => typeof value === 'string' ? value.trim() : '';
      const resume = str(entry.resume);
      rows.push({
        sourceFile: file, sourceIndex: i, sent: entry.sent === true,
        email: str(entry.email), person_full_name: str(entry.name), company_guess: str(entry.company),
        category: str(entry.category), suggested_subject: str(entry.subject), reply_to: str(entry.reply_to),
        attachment: resume ? path.resolve(process.cwd(), resume) : '',
        messageParts: entry.message.map(str).filter(Boolean), body: '', template_variables: '',
        template_id: TEMPLATE_T1, manual_skip: entry.manual_skip ? 'yes' : '', rowIndex: `${path.basename(file)} #${i + 1}`,
      });
    });
  }
  return rows;
}

/** Atomically record an SMTP-accepted recipient in its originating queue file. */
export function markJsonSent(row, account, sentAt = new Date().toISOString()) {
  if (!row.sourceFile) return;
  const data = JSON.parse(fs.readFileSync(row.sourceFile, 'utf8'));
  const entry = data.emails?.[row.sourceIndex];
  if (!entry || String(entry.email || '').trim().toLowerCase() !== row.email.toLowerCase()) {
    throw new Error('JSON queue changed during sending; cannot safely mark recipient');
  }
  entry.sent = true;
  entry.sent_at = sentAt;
  entry.sent_account = account;
  const temp = `${row.sourceFile}.${process.pid}.tmp`;
  try {
    fs.writeFileSync(temp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
    fs.renameSync(temp, row.sourceFile);
  } finally {
    if (fs.existsSync(temp)) fs.unlinkSync(temp);
  }
}
