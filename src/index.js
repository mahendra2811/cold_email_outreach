#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';

import {
  DEFAULTS,
  TEMPLATE_T1,
  TEMPLATE_T2,
  VALID_TEMPLATE_IDS,
  loadCredentials,
} from './config.js';
import { loadQueue, loadTemplates } from './excel.js';
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
  .option('--cap <number>', 'Max emails this run', String(DEFAULTS.cap))
  .option('--daily-cap <number>', 'Hard daily limit across all batches today (0 = disabled)', '0')
  .option('--delay <seconds>', 'Base delay between sends', String(DEFAULTS.delay))
  .option('--jitter <seconds>', 'Random additional delay (0..N)', String(DEFAULTS.jitter))
  .option('--dry-run', 'Render but do not send (default if neither flag given)')
  .option('--live', 'Actually send via SMTP — explicit opt-in')
  .option('--template <id>', `Filter by template id (${TEMPLATE_T1} or ${TEMPLATE_T2})`)
  .option('--sent-log <path>', 'Sent log file path', DEFAULTS.sentLog)
  .action(async (opts) => {
    await runSend(opts);
  });

PROGRAM.command('preview')
  .description('Render the first 5 emails without sending (ignores --live)')
  .option('--file <path>', 'Excel file path', DEFAULTS.file)
  .option('--sent-log <path>', 'Sent log file path', DEFAULTS.sentLog)
  .option('--template <id>', `Filter by template id (${TEMPLATE_T1} or ${TEMPLATE_T2})`)
  .option('--count <n>', 'Number of emails to preview', '5')
  .action(async (opts) => {
    await runPreview(opts);
  });

PROGRAM.command('stats')
  .description('Show remaining queue, sent count, breakdown by template')
  .option('--file <path>', 'Excel file path', DEFAULTS.file)
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
    ready.push(row);
  }

  return { ready, skipped };
}

/**
 * Render one row into a sendable {subject, text} pair, or throw on JSON / template lookup error.
 * @param {QueueRow} row
 * @param {Record<string,string>} templates
 */
function renderRow(row, templates) {
  const rawVars = parseTemplateVariables(row.template_variables);
  const vars = applyFallbacks(rawVars);

  const body = templates[row.template_id];
  if (!body) {
    throw new Error(`unknown template_id: ${row.template_id}`);
  }

  const subject = fillSubject(row.suggested_subject, vars);
  const text = fillTemplate(body, vars);
  return { subject, text, vars };
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
  const sentLogPath = opts.sentLog;

  if (!Number.isFinite(cap) || cap <= 0) throw new Error('--cap must be a positive number');
  if (dailyCap < 0 || !Number.isFinite(dailyCap)) throw new Error('--daily-cap must be >= 0');
  if (!Number.isFinite(baseDelay) || baseDelay < 0) throw new Error('--delay must be >= 0');
  if (!Number.isFinite(jitter) || jitter < 0) throw new Error('--jitter must be >= 0');

  const creds = loadCredentials({ requireCreds: !dryRun });
  const templates = loadTemplates(opts.file);
  const queue = loadQueue(opts.file);
  const sentSet = loadSentSet(sentLogPath);
  const { ready, skipped } = filterQueue(queue, sentSet, templateFilter);

  // Apply --daily-cap: count today's sends (local TZ) and limit this run accordingly.
  const sentToday = dailyCap > 0 ? countSentToday(sentLogPath) : 0;
  const remainingToday = dailyCap > 0 ? Math.max(0, dailyCap - sentToday) : Infinity;
  const effectiveCap = Math.min(cap, remainingToday);

  log.heading(
    `\nCold Outreach — ${dryRun ? chalk.yellow('DRY-RUN') : chalk.red.bold('LIVE')}  •  cap=${cap}${dailyCap > 0 ? `  •  daily-cap=${dailyCap}` : ''}  •  delay=${baseDelay}s (+0..${jitter}s jitter)`,
  );
  if (dailyCap > 0) {
    log.dim(`Already sent today: ${sentToday}/${dailyCap}  |  remaining today: ${remainingToday}  |  effective cap this run: ${effectiveCap}`);
  }
  log.dim(
    `Queue: ${queue.length} rows  |  ready: ${ready.length}  |  skipped → manual_skip=${skipped.manualSkip}, already-sent=${skipped.alreadySent}, no-email=${skipped.noEmail}, invalid-template=${skipped.invalidTemplateId}, template-mismatch=${skipped.templateMismatch}`,
  );
  if (templateFilter) log.dim(`Template filter: ${templateFilter}`);
  log.dim(`Sent log: ${sentLogPath}`);
  log.raw('');

  if (effectiveCap === 0) {
    log.warn(`Daily cap reached (${sentToday}/${dailyCap} sent today). Nothing to do.`);
    return;
  }

  if (ready.length === 0) {
    log.warn('Nothing to send. Queue is empty after filtering.');
    return;
  }

  const send = createSender(creds, { dryRun });

  const stopped = { value: false };
  const onSigint = () => {
    stopped.value = true;
    log.warn('\n[SIGINT] Stopping after current row…');
  };
  process.on('SIGINT', onSigint);

  const startedAt = Date.now();
  let sentThisRun = 0;
  let errorCount = 0;
  const targetCount = Math.min(effectiveCap, ready.length);

  for (let i = 0; i < ready.length; i++) {
    if (stopped.value) break;
    if (sentThisRun >= effectiveCap) {
      log.dim(`Cap reached (${effectiveCap}${effectiveCap < cap ? ` — limited by --daily-cap ${dailyCap}` : ''}). Stopping.`);
      break;
    }

    const row = ready[i];
    const idx = `[${sentThisRun + 1}/${targetCount}]`;
    const short = SHORT_TEMPLATE[row.template_id] || row.template_id;

    let rendered;
    try {
      rendered = renderRow(row, templates);
    } catch (e) {
      errorCount++;
      log.err(
        `[—]     ${chalk.red('✗')} ${pad(row.email, 36)} →  ERROR: ${e.message} — skipped (row ${row.rowIndex})`,
      );
      continue;
    }

    const subjShort = rendered.subject.length > 60
      ? rendered.subject.slice(0, 57) + '…'
      : rendered.subject;

    const nextDelay = computeDelaySeconds(baseDelay, jitter);
    const willSleep = sentThisRun + 1 < effectiveCap && i + 1 < ready.length;
    const waitNote = willSleep ? ` — waiting ${Math.round(nextDelay)}s` : '';

    try {
      await send({ to: row.email, subject: rendered.subject, text: rendered.text });
    } catch (e) {
      errorCount++;
      log.err(
        `${idx} ${chalk.red('✗')} ${pad(row.email, 36)} →  SEND ERROR: ${e.message} — sleeping ${DEFAULTS.errorSleepSeconds}s, continuing`,
      );
      await sleep(DEFAULTS.errorSleepSeconds);
      continue;
    }

    // Success: write sent.log BEFORE sleeping so a Ctrl+C is crash-safe.
    if (!dryRun) {
      try {
        appendSent(sentLogPath, row.email);
      } catch (e) {
        log.warn(
          `  (warning) failed to append to sent.log for ${row.email}: ${e.message}`,
        );
      }
    }
    sentThisRun++;

    if (dryRun) {
      log.raw(
        `${idx} ${chalk.yellow('(dry)')} ${pad(row.email, 36)} →  ${short} — "${subjShort}"${waitNote}`,
      );
      log.dim(`        body: ${rendered.text.replace(/\s+/g, ' ').slice(0, 100)}…`);
    } else {
      log.ok(
        `${idx} ${chalk.green('✓')} ${pad(row.email, 36)} →  ${short} — "${subjShort}"${waitNote}`,
      );
    }

    if (willSleep && !stopped.value) {
      await sleep(nextDelay);
    }
  }

  process.off('SIGINT', onSigint);

  const elapsedS = ((Date.now() - startedAt) / 1000).toFixed(1);
  const totalEver = dryRun ? sentSet.size : countSent(sentLogPath);
  log.raw('');
  log.heading('Summary');
  log.raw(`  sent this run:  ${sentThisRun}${dryRun ? chalk.yellow(' (dry-run, nothing actually sent)') : ''}`);
  log.raw(`  total ever:     ${totalEver}`);
  log.raw(`  errors:         ${errorCount}`);
  log.raw(`  elapsed:        ${elapsedS}s`);
  if (dryRun) {
    log.warn('\nThis was a DRY-RUN. To actually send, pass --live explicitly.');
  }
}

/**
 * @param {Record<string, any>} opts
 */
async function runPreview(opts) {
  const templateFilter = validateTemplateFilter(opts.template);
  const count = Math.max(1, Number(opts.count) || 5);

  const templates = loadTemplates(opts.file);
  const queue = loadQueue(opts.file);
  const sentSet = loadSentSet(opts.sentLog);
  const { ready } = filterQueue(queue, sentSet, templateFilter);

  log.heading(`\nPreview — first ${Math.min(count, ready.length)} of ${ready.length} ready rows`);
  log.raw('');

  for (let i = 0; i < Math.min(count, ready.length); i++) {
    const row = ready[i];
    let rendered;
    try {
      rendered = renderRow(row, templates);
    } catch (e) {
      log.err(`${i + 1}. ${row.email} — ERROR: ${e.message}`);
      log.raw('');
      continue;
    }
    const short = SHORT_TEMPLATE[row.template_id] || row.template_id;
    log.heading(`${i + 1}. ${row.email}  [${short}]`);
    log.dim(`   row=${row.rowIndex}  person=${row.person_full_name || '—'}  company=${row.company_guess || '—'}`);
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
  const templates = loadTemplates(opts.file);
  const queue = loadQueue(opts.file);
  const sentSet = loadSentSet(opts.sentLog);
  const { ready, skipped } = filterQueue(queue, sentSet, undefined);

  const byTemplate = { [TEMPLATE_T1]: 0, [TEMPLATE_T2]: 0 };
  for (const r of ready) {
    if (byTemplate[r.template_id] !== undefined) byTemplate[r.template_id]++;
  }

  log.heading('\nStats');
  log.raw(`  Excel file:           ${opts.file}`);
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
