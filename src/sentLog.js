import fs from 'node:fs';
import path from 'node:path';

/**
 * Load sent emails from disk into a Set for O(1) lookup.
 * Returns an empty Set if the file does not exist.
 * @param {string} logPath
 * @returns {Set<string>}
 */
export function loadSentSet(logPath) {
  const abs = path.resolve(logPath);
  if (!fs.existsSync(abs)) return new Set();
  const text = fs.readFileSync(abs, 'utf8');
  const set = new Set();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    // Lines may be either `email` or `iso,email`. Take the email portion (last comma-separated).
    const parts = trimmed.split(',');
    const email = parts[parts.length - 1].trim().toLowerCase();
    if (email) set.add(email);
  }
  return set;
}

/**
 * Append a single sent email to the log, crash-safe (sync, fsync via flag 'a').
 * Format: `<ISO timestamp>,<email>\n`
 * @param {string} logPath
 * @param {string} email
 */
export function appendSent(logPath, email) {
  const abs = path.resolve(logPath);
  const line = `${new Date().toISOString()},${email.trim().toLowerCase()}\n`;
  fs.appendFileSync(abs, line);
}

/**
 * Count lines (sent emails) in sent.log. Returns 0 if missing.
 * @param {string} logPath
 * @returns {number}
 */
export function countSent(logPath) {
  const abs = path.resolve(logPath);
  if (!fs.existsSync(abs)) return 0;
  return loadSentSet(abs).size;
}

/**
 * Format a Date as a YYYY-MM-DD string in the machine's local timezone.
 * @param {Date} d
 * @returns {string}
 */
function formatLocalDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Count sends that occurred on the local calendar date of `now`.
 * Only counts lines with a parseable ISO timestamp prefix
 * (legacy email-only lines are ignored — they have no date).
 * @param {string} logPath
 * @param {Date} [now]
 * @returns {number}
 */
export function countSentToday(logPath, now = new Date()) {
  const abs = path.resolve(logPath);
  if (!fs.existsSync(abs)) return 0;
  const text = fs.readFileSync(abs, 'utf8');
  const todayLocal = formatLocalDate(now);
  let count = 0;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',');
    if (parts.length < 2) continue;
    const date = new Date(parts[0]);
    if (Number.isNaN(date.getTime())) continue;
    if (formatLocalDate(date) === todayLocal) count++;
  }
  return count;
}

/** Load all numbered account logs for a campaign, including the base log. */
export function loadCampaignSentSet(basePath) {
  const absolute = path.resolve(basePath);
  const directory = path.dirname(absolute);
  const baseName = path.basename(absolute);
  const extension = path.extname(baseName);
  const stem = baseName.slice(0, baseName.length - extension.length).replace(/\.\d+$/, '');
  const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapeRegex(stem)}\\.\\d+${escapeRegex(extension)}$`);
  const result = loadSentSet(path.join(directory, stem + extension));
  if (!fs.existsSync(directory)) return result;
  for (const name of fs.readdirSync(directory)) {
    if (pattern.test(name)) for (const email of loadSentSet(path.join(directory, name))) result.add(email);
  }
  return result;
}
