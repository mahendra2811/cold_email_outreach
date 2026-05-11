# Production-Ready Prompt for Claude Code CLI

Copy this entire block into a file called `BUILD_PROMPT.md` in an empty directory, then run `claude` in that directory and paste it (or use `claude < BUILD_PROMPT.md`).

---

```markdown
# Build: Cold Email Outreach Automation Tool

You are building a production-ready Node.js CLI tool for sending personalized cold emails from a personal Gmail account, reading from a structured Excel file. This is a real job-hunt outreach system for me (Mahendra Singh Puniya, Senior Frontend Developer). It must be reliable, safe, and resumable.

## Critical Context

- **Input file:** `email_outreach_list.xlsx` (will be placed in project root by user)
- **Source tab:** `Active_Queue` — 700 rows of validated HR/recruiter emails ready to send
- **Templates tab:** `Templates` — contains two email body templates with placeholders
- **Sender:** Personal Gmail account using App Password + Nodemailer SMTP
- **Stakes:** Personal Gmail can be suspended for spam. Throttling, dry-run, and resume support are non-negotiable.

## Active_Queue Schema (read these columns)

| Column | Type | Required | Notes |
|---|---|---|---|
| `email` | string | yes | Recipient address |
| `template_id` | string | yes | Either `T1_NAMED_PERSON` or `T2_ROLE_INBOX` |
| `template_variables` | string (JSON) | yes | e.g. `{"company": "ABB India", "first_name": "Ajay", "full_name": "Ajay Tiwari"}` — T2 rows only have `company` |
| `suggested_subject` | string | yes | Pre-written subject, may contain `{company}` placeholders |
| `person_full_name` | string | optional | Display only |
| `company_guess` | string | optional | Display only |

Other columns exist (`confidence_score`, `inbox_category`, `priority_tier`, `current_owner`, `manual_skip`, `notes`) — read-only, ignore for sending logic. **Respect `manual_skip`:** if cell has any non-empty value, skip that row.

## Templates Tab Schema

- Column A: `template_id` (e.g. `T1_NAMED_PERSON`)
- Column B: full template body, starts with `SUBJECT: <subject line>\n\n<body>...`
- Two templates to load: `T1_NAMED_PERSON` (uses `{first_name}`, `{company}`) and `T2_ROLE_INBOX` (uses `{company}` only)
- Strip the `SUBJECT: ...\n\n` prefix from the body — we use `suggested_subject` from each row instead.

## Tech Stack (use exactly these, no alternatives)

- **Node.js 20+** with ES modules (`"type": "module"` in package.json)
- **nodemailer** for SMTP sending via Gmail
- **xlsx** (SheetJS) for reading the Excel file directly — do not require CSV conversion
- **dotenv** for credential loading
- **commander** for the CLI interface
- **chalk** for colored terminal output
- **No TypeScript** — plain modern JS with JSDoc type hints where useful
- **No database** — use a flat `sent.log` file for resume state

Do NOT add: React, frameworks, ORMs, build tools, bundlers, TypeScript, AI/LLM SDKs.

## File Structure to Create

```
cold-outreach/
├── .env.example          # template with placeholder values
├── .gitignore            # ignores .env, node_modules, sent.log, *.xlsx, *.log
├── package.json          # type: module, npm scripts
├── README.md             # setup + usage docs
├── src/
│   ├── index.js          # CLI entrypoint with commander
│   ├── config.js         # loads .env, validates required vars
│   ├── excel.js          # reads Active_Queue + Templates tabs
│   ├── template.js       # placeholder filling + fallback logic
│   ├── sender.js         # nodemailer transport + sendMail wrapper
│   ├── throttle.js       # delay with jitter helper
│   ├── sentLog.js        # append/check sent.log
│   └── logger.js         # chalk-wrapped console for ok/warn/err/info
└── tests/
    └── template.test.js  # unit test for template filling + fallbacks (node:test)
```

## CLI Interface (commander)

```
cold-outreach send          # main command
  --file <path>             # default: ./email_outreach_list.xlsx
  --cap <number>            # default: 10 — daily send limit
  --delay <seconds>         # default: 45 — base delay between sends
  --jitter <seconds>        # default: 15 — random additional delay (0 to N)
  --dry-run                 # default: true on first run (SAFETY)
  --live                    # explicit flag required to actually send
  --template <id>           # optional filter: only send T1_NAMED_PERSON or T2_ROLE_INBOX
  --sent-log <path>         # default: ./sent.log

cold-outreach preview       # show first 5 rendered emails without sending, regardless of --live
cold-outreach stats         # count remaining queue, sent count, breakdown by template
```

`--dry-run` and `--live` are mutually exclusive. If neither is passed, default to dry-run with a warning. **Sending is only allowed when `--live` is explicitly passed.** This is a hard safety rail — do not let the user accidentally send.

## Core Logic Requirements

1. **Load templates first.** Parse Templates tab, build `{ T1_NAMED_PERSON: body, T2_ROLE_INBOX: body }` map with SUBJECT prefix stripped. Error and exit if either is missing.

2. **Load queue.** Read `Active_Queue` tab. Filter out rows where: `email` is empty, `manual_skip` is non-empty, or `email` is already in `sent.log`.

3. **Optional template filter.** If `--template T1_NAMED_PERSON` passed, filter to that template only. Useful for prioritizing high-value named-person sends first.

4. **For each row, in order:**
   - Parse `template_variables` JSON. On parse fail, log error + skip + continue (do not crash).
   - Apply fallbacks: `first_name → "team"`, `full_name → ""`, `company → "your company"`.
   - Fill `suggested_subject` placeholders.
   - Fill template body placeholders.
   - If `--live`: send via nodemailer. On success, append email to `sent.log` immediately (before sleeping — crash-safe).
   - On send error: log clearly, sleep 10 seconds, do NOT increment count, continue to next row. Do not retry the same row in this run.
   - Sleep `delay + random(0, jitter)` seconds between sends.

5. **Stop conditions (any one):**
   - Hit `--cap`
   - End of queue
   - User Ctrl+C (handle SIGINT gracefully — print summary before exit)

6. **Print summary at end:** sent count this run, total ever sent (sent.log line count), errors count, time elapsed.

## Email Send Details

```javascript
{
  from: `"Mahendra Singh Puniya" <${GMAIL_USER}>`,
  to: row.email,
  subject: <filled subject>,
  text: <filled body>,
  // No HTML, no tracking pixels, no attachments — plain text only for deliverability
}
```

Transport config:
```javascript
nodemailer.createTransport({
  service: 'gmail',
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD }
})
```

## .env.example

```
# Generate App Password at: https://myaccount.google.com/security → 2-Step Verification → App passwords
# Requires 2FA enabled on your Google account
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
```

## Logging Output Format

Use chalk for colors. Each send line must be one line, scannable:

```
[12/40] ✓ ajay.tiwari@in.abb.com  →  T1 — "Frontend Engineer (1+ yr...)" — waiting 51s
[13/40] ✓ careers@accenture.com   →  T2 — "Application — Frontend / Full-Stack..." — waiting 47s
[—]     ✗ malformed@invalid.xx    →  ERROR: invalid recipient — skipped
[—]     ⊘ jobs@oldcompany.com     →  SKIP: in sent.log
```

For dry-run, replace `✓` with `(dry)` and show body preview (first 100 chars) on next line.

Use `logger.info`, `logger.ok`, `logger.warn`, `logger.err` consistently. No `console.log` directly in business logic.

## Tests (tests/template.test.js)

Using node's built-in `node:test`:

- `fillTemplate` replaces `{first_name}`, `{full_name}`, `{company}` correctly
- Missing `first_name` falls back to `"team"`
- Missing `company` falls back to `"your company"`
- Empty string fields use fallback (not the empty string)
- Multiple occurrences of same placeholder all get replaced
- `fillSubject` works for `{company}` and `{first_name}` only
- Unknown placeholders left alone (don't crash)

Run with: `npm test` → `node --test tests/`

## README.md Contents

Sections in this order:
1. **What it does** — 2-line summary
2. **Prerequisites** — Node 20+, 2FA enabled on Gmail, App Password generated (link to Google's docs)
3. **Setup** — `npm install`, copy `.env.example` → `.env`, fill in creds, place Excel file
4. **First run (safety)** — `npm run send` defaults to dry-run; example output
5. **Live sending** — `npm run send -- --live --cap 10` for day 1, warm-up schedule table (10 → 20 → 40 over a week)
6. **Resuming** — explain `sent.log`, how it survives crashes
7. **Filtering by template** — `--template T1_NAMED_PERSON` to send named-person rows first
8. **Troubleshooting** — common errors: invalid login (App Password not generated), Excel tab name mismatch, JSON parse errors in template_variables
9. **Limits to know** — Gmail's 500/day cap; spam-flag risk at >50/hour; recommended max 40/day for personal Gmail

## package.json scripts

```json
{
  "scripts": {
    "send": "node src/index.js send",
    "preview": "node src/index.js preview",
    "stats": "node src/index.js stats",
    "test": "node --test tests/"
  }
}
```

## Code Quality Bar

- **No callbacks** — async/await everywhere
- **Top-level error handling** — main function in try/catch, exit code 1 on fatal error
- **SIGINT handler** — Ctrl+C prints partial summary and exits cleanly
- **No magic strings** — sheet names, template IDs as named constants in `config.js` or top of relevant module
- **JSDoc** on exported functions in each module (`@param`, `@returns`)
- **One responsibility per module** — `excel.js` only reads, `sender.js` only sends, `template.js` only fills strings
- **No silent failures** — every catch block logs context (which email, which row, what failed)

## Execution Order — Build in This Sequence

1. `package.json` + `.gitignore` + `.env.example` + install deps
2. `src/config.js` — env loading with validation, fail fast if creds missing
3. `src/logger.js` — chalk wrappers
4. `src/excel.js` — read Active_Queue and Templates, return clean objects
5. `tests/template.test.js` + `src/template.js` — TDD this module
6. `src/sentLog.js` + `src/throttle.js` — small utilities
7. `src/sender.js` — nodemailer wrapper, accepts dry-run flag
8. `src/index.js` — commander CLI tying it all together
9. `README.md` — written last, reflecting the actual built behavior

After each module, run `npm test` if tests apply and verify no regressions. Don't move on if tests fail.

## Final Verification Before Marking Done

Run these checks and report results:

1. `npm install` succeeds with no warnings about deprecated packages
2. `npm test` — all template tests pass
3. `npm run preview` (with a sample Excel) — renders 5 emails correctly with both T1 and T2 examples
4. `npm run stats` — shows queue counts and template breakdown
5. `npm run send` (no flags) — refuses to send, shows dry-run output, prints clear instruction that `--live` is required
6. Show me the output of `npm run preview` so I can verify rendering is correct

## What NOT to Do

- ❌ Don't add HTML email support — plain text only (better deliverability, harder to mark as spam)
- ❌ Don't add tracking pixels — looks like marketing automation, gets flagged
- ❌ Don't add follow-up logic in v1 — keep this single-purpose, follow-ups come later
- ❌ Don't add a web UI or dashboard — CLI only
- ❌ Don't write the Excel file back — sent.log is the source of truth for sent state
- ❌ Don't use synchronous nodemailer APIs — async/await only
- ❌ Don't bundle the Excel file in the repo — `.gitignore` it
- ❌ Don't add OAuth/Gmail API support — App Password + SMTP is intentional choice
- ❌ Don't auto-generate test data — assume user provides real Excel

## When You Hit Ambiguity

Make a sensible decision, leave a `// NOTE:` comment explaining the choice, and continue. Do not ask me clarifying questions during the build — finish first, then list any decisions you made at the end in a short "Decisions made" section so I can review.

## Start Now

Begin by creating the directory structure and `package.json`. Run `npm install` to verify deps install cleanly. Then proceed module-by-module per the execution order above.
```

---

## How to use this with Claude Code

```bash
mkdir cold-outreach && cd cold-outreach
# Save the prompt above as BUILD_PROMPT.md
claude
# Then in the Claude Code session, paste:
# "Read BUILD_PROMPT.md and build it end-to-end."
```

Or in one shot:

```bash
claude "$(cat BUILD_PROMPT.md)"
```

Or if you want it fully autonomous:

```bash
claude --dangerously-skip-permissions "$(cat BUILD_PROMPT.md)"
```

(That last flag lets it run `npm install` and create files without per-command approval — fine in an empty new directory.)

## A few tips so Claude Code doesn't go off-rails

1. **Keep the prompt in `BUILD_PROMPT.md` in the project root** — Claude Code can re-read it during the build if it loses context on a long run
2. **After the build finishes**, ask it to commit: `git init && git add . && git commit -m "Initial build per BUILD_PROMPT.md"` — gives you a clean rollback point
3. **Don't drop the real Excel file in until after the build is verified** — let it test with mock data first
4. **If it goes off-script**, the "What NOT to Do" section is your enforcement tool — point at it: "you added HTML — see line X of BUILD_PROMPT.md, remove it"


