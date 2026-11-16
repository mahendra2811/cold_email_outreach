#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DEFAULTS,
  TEMPLATE_T1,
  TEMPLATE_T2,
  VALID_TEMPLATE_IDS,
  loadAccountCredentials,
} from './config.js';
import { loadQueue, loadTemplates } from './excel.js';
import { loadJsonQueue } from './jsonQueue.js';
import {
  applyFallbacks,
  fillSubject,
  fillTemplate,
  parseTemplateVariables,
} from './template.js';
import { createSender } from './sender.js';
import { appendSent, countSent, countSentToday, loadSentSet } from './sentLog.js';
import { computeDelaySeconds, sleep } from './throttle.js';
import * as log from './logger.js';

/**
 * @typedef {import('./excel.js').QueueRow} QueueRow
 */

const PROGRAM = new Command();

PROGRAM.name('cold-outreach').description(
  'Personalized cold email outreach CLI — reads Excel, sends throttled via Gmail SMTP, resumable.',
);

PROGRAM.command('send')
  .description('Send emails from Active_Queue (defaults to dry-run; pass --live to actually send)')
  .option('--file <path>', 'Excel file path', DEFAULTS.file)
  .option('--json <path>', 'JSON file or folder containing JSON queues')
  .option('--cap <number>', 'Max emails this run', String(DEFAULTS.cap))
  .option('--daily-cap <number>', 'Hard daily limit per account per day', String(DEFAULTS.dailyCap))
  .option('--delay <seconds>', 'Base delay between sends', String(DEFAULTS.delay))
  .option('--jitter <seconds>', 'Random additional delay (0..N)', String(DEFAULTS.jitter))
  .option('--dry-run', 'Render but do not send (default if neither flag given)')
  .option('--live', 'Actually send via SMTP — explicit opt-in')
  .option('--proof-only', 'Send only the first ready email as a proof to the owner')
  .option('--template <id>', `Filter by template id (${TEMPLATE_T1} or ${TEMPLATE_T2})`)
  .option('--sent-log <path>', 'Sent log base path (account 0)', DEFAULTS.sentLog)
  .option('--account <n>', 'Account index to use: 0 (default) or 1', '0')
  .option('--rotate', 'Auto-rotate to next account when daily cap is hit')
  .action(async (opts) => {
    await runSend(opts);
  });

PROGRAM.command('preview')
  .description('Render the first 5 emails without sending (ignores --live)')
  .option('--file <path>', 'Excel file path', DEFAULTS.file)
  .option('--json <path>', 'JSON file or folder containing JSON queues')
  .option('--sent-log <path>', 'Sent log file path', DEFAULTS.sentLog)
  .option('--template <id>', `Filter by template id (${TEMPLATE_T1} or ${TEMPLATE_T2})`)
  .option('--count <n>', 'Number of emails to preview', '5')
  .action(async (opts) => {
    await runPreview(opts);
  });

PROGRAM.command('stats')
  .description('Show remaining queue, sent count, breakdown by template')
  .option('--file <path>', 'Excel file path', DEFAULTS.file)
  .option('--json <path>', 'JSON file or folder containing JSON queues')
  .option('--sent-log <path>', 'Sent log file path', DEFAULTS.sentLog)
  .action(async (opts) => {
    await runStats(opts);
  });

/* ------------------------- helpers ------------------------- */

/**
 * Determine effective dry-run mode and validate mutual exclusion of --dry-run/--live.
 * @param {{ dryRun?: boolean, live?: boolean }} opts
 * @returns {boolean} true if dry-run
 */
function resolveDryRun(opts) {
  if (opts.dryRun && opts.live) {
    throw new Error('--dry-run and --live are mutually exclusive');
  }
  if (opts.live) return false;
  if (opts.dryRun) return true;
  log.warn(
    'No --live flag passed → defaulting to DRY-RUN. Pass --live to actually send.',
  );
  return true;
}

/**
 * Validate optional --template filter value.
 * @param {string | undefined} value
 */
function validateTemplateFilter(value) {
  if (!value) return undefined;
  if (!VALID_TEMPLATE_IDS.has(value)) {
    throw new Error(
      `Invalid --template: ${value}. Must be one of: ${[...VALID_TEMPLATE_IDS].join(', ')}`,
    );
  }
  return value;
}

/**
 * Filter the queue: drop rows that are empty/manual_skip/already-sent/template-mismatch.
 * @param {QueueRow[]} queue
 * @param {Set<string>} sentSet
 * @param {string | undefined} templateFilter
 * @returns {{ ready: QueueRow[], skipped: { manualSkip: number, alreadySent: number, noEmail: number, templateMismatch: number, invalidTemplateId: number } }}
 */
function filterQueue(queue, sentSet, templateFilter) {
  const ready = [];
  const skipped = {
    manualSkip: 0,
    alreadySent: 0,
    noEmail: 0,
    templateMismatch: 0,
    invalidTemplateId: 0,
  };

  const seen = new Set();
  for (const row of queue) {
    if (!row.email) {
      skipped.noEmail++;
      continue;
    }
    if (row.manual_skip) {
      skipped.manualSkip++;
      continue;
    }
    if (sentSet.has(row.email.toLowerCase())) {
      skipped.alreadySent++;
      continue;
    }
    if (!VALID_TEMPLATE_IDS.has(row.template_id)) {
      skipped.invalidTemplateId++;
      continue;
    }
    if (templateFilter && row.template_id !== templateFilter) {
      skipped.templateMismatch++;
      continue;
    }
    if (seen.has(row.email.toLowerCase())) {
      skipped.alreadySent++;
      continue;
    }
    seen.add(row.email.toLowerCase());
    ready.push(row);
  }

  return { ready, skipped };
}

/**
 * Render one row into a sendable {subject, text} pair, or throw on JSON / template lookup error.
 * @param {QueueRow} row
 * @param {Record<string,string>} templates
 */
function renderRow(row, templates, workbookPath) {
  const rawVars = row.template_variables ? parseTemplateVariables(row.template_variables) : { full_name: row.person_full_name, first_name: row.person_full_name.split(/\s+/)[0], company: row.company_guess };
  const vars = applyFallbacks(rawVars);

  if (row.body && row.messageParts.length) {
    throw new Error('fill either body or the greeting, paragraph and closing fields, not both');
  }
  const body = row.body || row.messageParts.join('\n\n') || templates[row.template_id];
  if (!body) {
    throw new Error(`no body provided and template is missing: ${row.template_id}`);
  }

  const subject = fillSubject(row.suggested_subject, vars);
  const text = fillTemplate(body, vars);
  if (!subject) throw new Error('subject is empty');
  if (!/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(row.email)) throw new Error('invalid recipient address');
  const replyTo = row.reply_to || DEFAULTS.proofEmail;
  if (replyTo && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(replyTo)) throw new Error('invalid reply_to address');
  let attachmentValue = row.attachment;
  let attachmentBase = path.dirname(path.resolve(workbookPath));
  if (!attachmentValue && row.category) {
    const configPath = fileURLToPath(new URL('../attachment-categories.json', import.meta.url));
    let categories;
    try { categories = JSON.parse(fs.readFileSync(configPath, 'utf8')); }
    catch (error) { throw new Error(`cannot read attachment categories: ${error.message}`); }
    const categoryKey = Object.keys(categories).find(key => key.trim().toLowerCase() === row.category.toLowerCase());
    if (!categoryKey) throw new Error(`unknown attachment category: ${row.category}`);
    attachmentValue = categories[categoryKey];
    if (typeof attachmentValue !== 'string' || !attachmentValue.trim()) throw new Error(`no attachment configured for category: ${row.category}`);
    attachmentBase = path.dirname(configPath);
  }
  const attachments = attachmentValue ? attachmentValue.split(';').map(value => {
    const filename = value.trim();
    if (!filename) throw new Error('empty attachment path');
    const attachmentPath = path.resolve(attachmentBase, filename);
    if (!fs.existsSync(attachmentPath) || !fs.statSync(attachmentPath).isFile()) throw new Error(`attachment not found: ${filename}`);
    return { path: attachmentPath };
  }) : [];
  return { subject, text, vars, replyTo, attachments };
}

const SHORT_TEMPLATE = {
  [TEMPLATE_T1]: 'T1',
  [TEMPLATE_T2]: 'T2',
};

/** Pad a string to a given width. */
function pad(s, w) {
  const str = String(s);
  return str.length >= w ? str : str + ' '.repeat(w - str.length);
}

/* ------------------------- commands ------------------------- */

/** Derive per-account sent log path from the base path (account 0's log). */
function sentLogForAccount(basePath, n) {
  return n === 0 ? basePath : basePath.replace(/\.log$/, `.${n}.log`);
}

/**
 * @param {Record<string, any>} opts
 */
async function runSend(opts) {
  const dryRun = resolveDryRun(opts);
  const templateFilter = validateTemplateFilter(opts.template);
  const cap = Number(opts.cap);
  const dailyCap = Number(opts.dailyCap) || 0;
  const baseDelay = Number(opts.delay);
  const jitter = Number(opts.jitter);
  const useRotate = Boolean(opts.rotate);
  const singleAccount = Number(opts.account) || 0;
  const accountList = useRotate ? [0, 1] : [singleAccount];

  if (!Number.isFinite(cap) || cap <= 0) throw new Error('--cap must be a positive number');
  if (dailyCap < 0 || !Number.isFinite(dailyCap)) throw new Error('--daily-cap must be >= 0');
  if (!Number.isFinite(baseDelay) || baseDelay < 0) throw new Error('--delay must be >= 0');
  if (!Number.isFinite(jitter) || jitter < 0) throw new Error('--jitter must be >= 0');

  // Build combined sent set from all active accounts (dedup across accounts)
  const combinedSentSet = new Set();
  for (const n of accountList) {
    for (const e of loadSentSet(sentLogForAccount(opts.sentLog, n))) combinedSentSet.add(e);
  }

  const templates = opts.json ? {} : loadTemplates(opts.file);
  const queue = opts.json ? loadJsonQueue(opts.json) : loadQueue(opts.file);
  const { ready, skipped } = filterQueue(queue, combinedSentSet, templateFilter);

  log.heading(
    `\nCold Outreach — ${dryRun ? chalk.yellow('DRY-RUN') : chalk.red.bold('LIVE')}  •  cap=${cap}${dailyCap > 0 ? `  •  daily-cap=${dailyCap}/account` : ''}  •  delay=${baseDelay}s (+0..${jitter}s jitter)${useRotate ? '  •  rotate=[0→1]' : `  •  account=${singleAccount}`}`,
  );
  log.dim(
    `Queue: ${queue.length} rows  |  ready: ${ready.length}  |  skipped → manual_skip=${skipped.manualSkip}, already-sent=${skipped.alreadySent}, no-email=${skipped.noEmail}, invalid-template=${skipped.invalidTemplateId}, template-mismatch=${skipped.templateMismatch}`,
  );
  if (templateFilter) log.dim(`Template filter: ${templateFilter}`);
  log.raw('');

  if (ready.length === 0) {
    log.warn('Nothing to send. Queue is empty after filtering.');
    return;
  }

  const stopped = { value: false };
  const onSigint = () => {
    stopped.value = true;
    log.warn('\n[SIGINT] Stopping after current row…');
  };
  process.on('SIGINT', onSigint);

  const startedAt = Date.now();
  let totalSent = 0;
  let totalErrors = 0;
  let readyPointer = 0; // position across account switches

  for (const acctIdx of accountList) {
    if (stopped.value || totalSent >= cap || readyPointer >= ready.length) break;

    const creds = loadAccountCredentials(acctIdx, { requireCreds: !dryRun });
    const acctSentLog = sentLogForAccount(opts.sentLog, acctIdx);

    // Per-account daily cap
    const sentTodayAcct = dailyCap > 0 ? countSentToday(acctSentLog) : 0;
    const remainingTodayAcct = dailyCap > 0 ? Math.max(0, dailyCap - sentTodayAcct) : Infinity;
    const acctCap = Math.min(cap - totalSent, remainingTodayAcct);

    if (acctCap === 0) {
      log.warn(`Account ${acctIdx} (${creds.gmailUser}): daily cap reached (${sentTodayAcct}/${dailyCap} sent today).${useRotate ? ' Trying next account…' : ''}`);
      continue;
    }

    log.heading(`Account ${acctIdx}: ${chalk.cyan(creds.gmailUser)}  •  can send up to ${acctCap === Infinity ? '∞' : acctCap} now`);
    if (dailyCap > 0) log.dim(`  sent today from this account: ${sentTodayAcct}/${dailyCap}`);
    log.dim(`  sent log: ${acctSentLog}`);
    log.raw('');

    const send = createSender(creds, { dryRun });

    // Send a proof copy to owner before the real batch so they can verify content.
    const proofRow = ready[readyPointer];
    if (proofRow && DEFAULTS.proofEmail) {
      let proofRendered;
      try {
        proofRendered = renderRow(proofRow, templates, opts.file);
        const proofSubject = `[PROOF] ${proofRendered.subject}`;
        const proofBody = `--- PROOF COPY (first recipient: ${proofRow.email}) ---\n\n${proofRendered.text}`;
        await send({ to: DEFAULTS.proofEmail, subject: proofSubject, text: proofBody, replyTo: proofRendered.replyTo, attachments: proofRendered.attachments });
        log.ok(`[PROOF] ${chalk.cyan(DEFAULTS.proofEmail)} — ${dryRun ? 'proof copy rendered (dry-run)' : 'proof copy sent before batch starts'}`);
      } catch (e) {
        log.warn(`[PROOF] failed to send proof copy: ${e.message}${opts.proofOnly ? '' : ' — continuing anyway'}`);
        if (opts.proofOnly) process.exitCode = 1;
      }
      log.raw('');
    }
    if (opts.proofOnly) {
      process.off('SIGINT', onSigint);
      return;
    }

    let sentThisAcct = 0;
    const targetCount = Math.min(acctCap, ready.length - readyPointer);

    for (let i = readyPointer; i < ready.length; i++) {
      if (stopped.value || sentThisAcct >= acctCap) break;

      const row = ready[i];
      const idx = `[${sentThisAcct + 1}/${targetCount}]`;
      const short = SHORT_TEMPLATE[row.template_id] || row.template_id;

      let rendered;
      try {
        rendered = renderRow(row, templates, opts.file);
      } catch (e) {
        totalErrors++;
        log.err(`[—]     ${chalk.red('✗')} ${pad(row.email, 36)} →  ERROR: ${e.message} — skipped (row ${row.rowIndex})`);
        readyPointer = i + 1;
        continue;
      }

      const subjShort = rendered.subject.length > 60 ? rendered.subject.slice(0, 57) + '…' : rendered.subject;
      const nextDelay = computeDelaySeconds(baseDelay, jitter);
      const willSleep = sentThisAcct + 1 < acctCap && i + 1 < ready.length;
      const waitNote = willSleep ? ` — waiting ${Math.round(nextDelay)}s` : '';

      try {
        await send({ to: row.email, subject: rendered.subject, text: rendered.text, replyTo: rendered.replyTo, attachments: rendered.attachments });
      } catch (e) {
        totalErrors++;
        log.err(`${idx} ${chalk.red('✗')} ${pad(row.email, 36)} →  SEND ERROR: ${e.message} — sleeping ${DEFAULTS.errorSleepSeconds}s, continuing`);
        await sleep(DEFAULTS.errorSleepSeconds);
        readyPointer = i + 1;
        continue;
      }

      if (!dryRun) {
        try { appendSent(acctSentLog, row.email); } catch (e) {
          log.warn(`  (warning) failed to append to sent log for ${row.email}: ${e.message}`);
        }
      }
      sentThisAcct++;
      totalSent++;
      readyPointer = i + 1;

      if (dryRun) {
        log.raw(`${idx} ${chalk.yellow('(dry)')} ${pad(row.email, 36)} →  ${short} — "${subjShort}"${waitNote}`);
        log.dim(`        body: ${rendered.text.replace(/\s+/g, ' ').slice(0, 100)}…`);
      } else {
        log.ok(`${idx} ${chalk.green('✓')} ${pad(row.email, 36)} →  ${short} — "${subjShort}"${waitNote}`);
      }

      if (willSleep && !stopped.value) await sleep(nextDelay);
    }

    log.dim(`  Account ${acctIdx} done: sent ${sentThisAcct} emails this run.\n`);
  }

  process.off('SIGINT', onSigint);

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalEverAcross = accountList.reduce((sum, n) => sum + countSent(sentLogForAccount(opts.sentLog, n)), 0);
  log.raw('');
  log.heading('Summary');
  log.raw(`  sent this run:  ${totalSent}${dryRun ? chalk.yellow(' (dry-run, nothing actually sent)') : ''}`);
  log.raw(`  total ever:     ${totalEverAcross}`);
  log.raw(`  errors:         ${totalErrors}`);
  log.raw(`  elapsed:        ${elapsedS}s`);
  if (dryRun) log.warn('\nThis was a DRY-RUN. To actually send, pass --live explicitly.');
}

/**
 * @param {Record<string, any>} opts
 */
async function runPreview(opts) {
  const templateFilter = validateTemplateFilter(opts.template);
  const count = Math.max(1, Number(opts.count) || 5);

  const templates = opts.json ? {} : loadTemplates(opts.file);
  const queue = opts.json ? loadJsonQueue(opts.json) : loadQueue(opts.file);
  const sentSet = loadSentSet(opts.sentLog);
  const { ready } = filterQueue(queue, sentSet, templateFilter);

  log.heading(`\nPreview — first ${Math.min(count, ready.length)} of ${ready.length} ready rows`);
  log.raw('');

  for (let i = 0; i < Math.min(count, ready.length); i++) {
    const row = ready[i];
    let rendered;
    try {
      rendered = renderRow(row, templates, opts.file);
    } catch (e) {
      log.err(`${i + 1}. ${row.email} — ERROR: ${e.message}`);
      log.raw('');
      continue;
    }
    const short = SHORT_TEMPLATE[row.template_id] || row.template_id;
    log.heading(`${i + 1}. ${row.email}  [${short}]`);
    log.dim(`   row=${row.rowIndex}  person=${row.person_full_name || '—'}  company=${row.company_guess || '—'}  category=${row.category || '—'}`);
    log.raw(`   ${chalk.bold('Reply-To:')} ${rendered.replyTo || 'sender'}  |  ${chalk.bold('Attachments:')} ${rendered.attachments.map(a => a.path).join('; ') || 'none'}`);
    log.raw(`   ${chalk.bold('Subject:')} ${rendered.subject}`);
    log.raw('   ' + chalk.bold('Body:'));
    for (const line of rendered.text.split('\n')) {
      log.raw('     ' + line);
    }
    log.raw('');
  }
}

/**
 * @param {Record<string, any>} opts
 */
async function runStats(opts) {
  const templates = opts.json ? {} : loadTemplates(opts.file);
  const queue = opts.json ? loadJsonQueue(opts.json) : loadQueue(opts.file);
  const sentSet = loadSentSet(opts.sentLog);
  const { ready, skipped } = filterQueue(queue, sentSet, undefined);

  const byTemplate = { [TEMPLATE_T1]: 0, [TEMPLATE_T2]: 0 };
  for (const r of ready) {
    if (byTemplate[r.template_id] !== undefined) byTemplate[r.template_id]++;
  }

  log.heading('\nStats');
  log.raw(`  Queue source:         ${opts.json || opts.file}`);
  log.raw(`  Templates loaded:     ${Object.keys(templates).join(', ')}`);
  log.raw(`  Total queue rows:     ${queue.length}`);
  log.raw(`  Already sent:         ${skipped.alreadySent}`);
  log.raw(`  Manual-skip:          ${skipped.manualSkip}`);
  log.raw(`  No-email:             ${skipped.noEmail}`);
  log.raw(`  Invalid template_id:  ${skipped.invalidTemplateId}`);
  log.raw(`  Ready to send:        ${ready.length}`);
  log.dim(`    ↳ ${TEMPLATE_T1}: ${byTemplate[TEMPLATE_T1]}`);
  log.dim(`    ↳ ${TEMPLATE_T2}: ${byTemplate[TEMPLATE_T2]}`);
  log.raw(`  sent.log entries:     ${sentSet.size}  (file: ${opts.sentLog})`);
}

/* ------------------------- main ------------------------- */

async function main() {
  await PROGRAM.parseAsync(process.argv);
}

main().catch((e) => {
  log.err(`\nFATAL: ${e.message}`);
  if (process.env.DEBUG) log.dim(String(e.stack || ''));
  process.exit(1);
});
