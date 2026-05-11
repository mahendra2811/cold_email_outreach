# Cold Outreach CLI

## What it does

A Node.js CLI that reads HR/recruiter rows from an Excel file (`Active_Queue` tab), fills email templates with per-row variables, and sends throttled, plain-text emails from your personal Gmail account. Resumable, dry-run by default, and safe enough that you have to explicitly opt in (`--live`) to actually send.

## Prerequisites

- **Node.js 20+** (tested on Node 24)
- **2-Factor Authentication enabled** on the Google account you'll send from
- A **Gmail App Password** — generate at https://myaccount.google.com/security → "2-Step Verification" → "App passwords" (Google docs: https://support.google.com/accounts/answer/185833)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env and fill in your Gmail address + App Password
# Place your Excel file at the project root as `email_outreach_list.xlsx`
# (or pass --file <path> to commands)
```

Required Excel tabs:
- `Active_Queue` — must contain columns: `email`, `template_id`, `template_variables` (JSON), `suggested_subject`, plus optional `manual_skip`, `person_full_name`, `company_guess`
- `Templates` — column A is `template_id`, column B is the body starting with `SUBJECT: <subject>\n\n<body>`. Required template IDs: `T1_NAMED_PERSON` and `T2_ROLE_INBOX`.

## First run (safety)

`npm run send` defaults to **dry-run**. Nothing is sent unless you explicitly pass `--live`.

```bash
npm run send
# → prints a warning, renders the first 10 emails to your terminal, exits without sending
```

Example dry-run output:
```
No --live flag passed → defaulting to DRY-RUN. Pass --live to actually send.

Cold Outreach — DRY-RUN  •  cap=10  •  delay=45s (+0..15s jitter)
Queue: 702 rows  |  ready: 702  |  skipped → manual_skip=0, already-sent=0, ...

[1/10] (dry) ajay.tiwari@in.abb.com         →  T1 — "Frontend Engineer (...)" — waiting 51s
        body: Hi Ajay, I'm Mahendra Singh Puniya, a frontend engineer ...
```

To inspect rendered emails in full, use `preview`:

```bash
npm run preview                       # first 5 emails with full body
npm run preview -- --count 10         # more
npm run preview -- --template T2_ROLE_INBOX
```

## Live sending

```bash
npm run send -- --live --cap 10
```

- `--live` is the **only** way to actually send. There is no env flag override.
- `--cap N` limits how many emails will be sent in this run (in addition to end-of-queue).
- Default delay is 45s base + random 0–15s jitter between sends. Override with `--delay` / `--jitter`.

### Recommended warm-up schedule (personal Gmail)

| Day | Cap | Notes |
|-----|-----|-------|
| 1   | 10  | Start small. Check for bounces. |
| 2   | 15  | If day 1 had no bounces or spam complaints. |
| 3   | 20  | |
| 4   | 25  | |
| 5   | 30  | |
| 6   | 35  | |
| 7+  | 40  | Cap here. Personal Gmail >50/hour is spam-flag territory. |

Spread sends across the day — don't blast 40 in 30 minutes.

## Resuming

Every successful send is appended to `sent.log` **before** the inter-send sleep. So if the process crashes or you Ctrl+C, just re-run — already-sent recipients are skipped automatically.

```bash
# sent.log format (one email per line, ISO timestamp prefix):
2026-05-11T08:30:14.221Z,ajay.tiwari@in.abb.com
2026-05-11T08:31:02.554Z,careers@accenture.com
```

To start over, delete `sent.log`. To re-send a specific recipient, remove its line.

Ctrl+C is handled gracefully: it finishes the current row, prints a summary, and exits cleanly.

## Filtering by template

Send all your named-person (high-value) emails first, then role inboxes:

```bash
npm run send -- --live --cap 10 --template T1_NAMED_PERSON
# next day…
npm run send -- --live --cap 10 --template T1_NAMED_PERSON
# once T1 queue is exhausted…
npm run send -- --live --cap 10 --template T2_ROLE_INBOX
```

## Stats

```bash
npm run stats
```

Shows:
- Total queue rows
- How many are already in `sent.log`
- How many are `manual_skip`
- How many are ready, broken down by `T1_NAMED_PERSON` vs `T2_ROLE_INBOX`

## Scheduled batched sending (cron)

For automated daily sending in fixed batches (e.g., 9:30 AM / 1 PM / 5 PM):

```bash
cat crontab.example          # see recommended schedules for 20/30/40 emails per day
bash scripts/send-batch.sh --cap 2 --daily-cap 30 --delay 0 --jitter 0  # dry-run test
crontab -e                   # install the steady-state schedule
```

The wrapper at `scripts/send-batch.sh` handles cron's minimal PATH, skips weekends, writes logs to `logs/cron-YYYY-MM-DD.log`. The `--daily-cap` flag enforces a hard ceiling across all batches in a day, counting today's sends from `sent.log` — even if cron mis-fires you can't exceed the limit.

See **section 12 of `LEARNINGS.md`** for complete cron setup steps, monitoring commands, and emergency stop procedures.

## All CLI options

```
cold-outreach send
  --file <path>            default: ./email_outreach_list.xlsx
  --cap <number>           default: 10  (max emails this run)
  --daily-cap <number>     default: 0   (hard daily ceiling across batches; 0=disabled)
  --delay <seconds>        default: 45
  --jitter <seconds>       default: 15
  --dry-run                explicit dry-run (mutually exclusive with --live)
  --live                   actually send via Gmail SMTP
  --template <id>          T1_NAMED_PERSON or T2_ROLE_INBOX
  --sent-log <path>        default: ./sent.log

cold-outreach preview
  --file <path>            default: ./email_outreach_list.xlsx
  --sent-log <path>        default: ./sent.log
  --template <id>          optional filter
  --count <n>              default: 5

cold-outreach stats
  --file <path>
  --sent-log <path>
```

## Troubleshooting

**`Invalid login: 535-5.7.8 Username and Password not accepted`**
You're using your normal Google password, not an App Password. Enable 2FA, then generate an App Password and paste the 16-character value (with or without spaces) into `.env`.

**`Sheet "Active_Queue" not found`** / **`Sheet "Templates" not found`**
Tab names are case-sensitive and must match exactly. If your Excel uses different names, rename the tabs in Excel.

**`ERROR: invalid JSON` on a row**
The `template_variables` cell for that row isn't valid JSON. The row is skipped, others continue. Fix the cell, save the Excel, and re-run — already-sent rows will not be retried.

**`Templates sheet missing required template(s)`**
The `Templates` tab must contain rows where column A is exactly `T1_NAMED_PERSON` and `T2_ROLE_INBOX`. Each body in column B must start with `SUBJECT: <line>` followed by a blank line, then the body.

**Gmail rate-limit errors mid-run**
Reduce `--cap`, increase `--delay`. The script sleeps 10s on any send error and continues — it does not retry the failed row.

## Limits to know

- **Gmail hard daily cap:** 500 emails/day for personal accounts (Workspace is 2000)
- **Spam-flag risk:** >50/hour from personal Gmail is risky; >100/hour likely triggers suspension
- **Recommended max:** 40/day from a personal Gmail, spread out, plain text only

## What this tool deliberately does NOT do

- No HTML emails — plain text only, for deliverability
- No tracking pixels — looks like marketing automation, gets flagged
- No follow-up logic — single-purpose tool, v1
- No database — `sent.log` is the source of truth
- No OAuth — SMTP + App Password is intentional (zero infra)
- No writing back to Excel — the queue is read-only
