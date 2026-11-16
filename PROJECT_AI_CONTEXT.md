# Cold Outreach CLI (ColdOutrichAutoEmail) — AI Project Context

> **Purpose of this file**: Give any AI (Claude, ChatGPT, Gemini) or human reader a complete understanding of this project in one read. Also serves as my personal interview-prep cheat sheet.

---

## 1. Quick Snapshot (TL;DR)

- **Project ID**: `cold-outreach-cli`
- **Title**: Cold Outreach CLI — Throttled Gmail Sender for HR/Recruiter Outreach
- **Category**: CLI · Automation · Job-hunt
- **Status**: Live (production tool used personally)
- **Year**: 2025–2026
- **Role**: Solo Developer (Self)
- **Local path**: `ColdOutrichAutoEmail/`
- **Key files**: `sent.log`, `email_outreach_list.xlsx`, `LEARNINGS.md`

## 2. One-Sentence Description
A Node.js CLI that reads HR/recruiter rows from an Excel sheet, fills templated emails with per-row variables, and sends throttled (45s base + 0–15s jitter) plain-text emails from a personal Gmail via SMTP App Password — dry-run by default, `--live` required to actually send, resumable via `sent.log`.

## 3. Long Description
Built for my own job-hunt outreach. Reads `email_outreach_list.xlsx` → `Active_Queue` tab (one row per recruiter), fills `Templates` tab body with per-row variables (`{first_name}`, `{full_name}`, `{company}`), and sends via Gmail SMTP using a Google App Password. Safety-first design: defaults to dry-run, requires explicit `--live` flag, supports `--cap` (per-run) + `--daily-cap` (total per day from `sent.log`), 45s base delay + 0–15s jitter between sends (mimics human pace, avoids spam flags). Resumable: every successful send appended to `sent.log` with timestamp + recipient + template, so re-running skips already-sent rows. Two templates supported by default: `T1_NAMED_PERSON` (for known recruiters) and `T2_ROLE_INBOX` (for HR generic inboxes). My personal CLAUDE.md guidance enforces strict safety rules (always `--live`, always specific template, expected duration warning, never run without confirmation).

## 4. Tech Stack
- **Runtime**: Node.js 20+ (tested on 24)
- **Mail**: Gmail SMTP via App Password (nodemailer-style)
- **Excel**: SheetJS/xlsx (read `Active_Queue` and `Templates` tabs)
- **CLI**: Argument parsing (likely commander/yargs) + chalk-style output
- **Logging**: append-only `sent.log`, structured `logs/` directory
- **Config**: `.env` for `FROM_EMAIL`, `APP_PASSWORD`, `FROM_NAME`

## 5. Key Highlights
- **Dry-run by default** — must pass `--live` to actually send
- **Two-cap safety** — `--cap N` (this run) AND `--daily-cap N` (enforced via `sent.log` count today)
- **Throttling**: 45s base + 0–15s jitter between sends (humanlike pace)
- **Resumable**: `sent.log` is the source of truth; re-run skips already-sent
- **Template variable expansion**: `{first_name}`, `{full_name}`, `{company}` per row
- **Excel-driven**: `Active_Queue` (data) + `Templates` (body+subject) + `manual_skip` flag
- **Multi-template support**: `T1_NAMED_PERSON` vs `T2_ROLE_INBOX`
- **Pre-send `preview` command**: render N emails to terminal before live
- **`stats` command**: total ever-sent, today's count, T1/T2 ready remaining
- **Ctrl+C clean shutdown**: handles SIGINT, finishes current send, prints summary, exits

## 6. Problem → Solution
- **Problem**: Job hunt requires sending 30–50 personalized cold emails to recruiters per day. Doing it manually = mind-numbing + error-prone (sending duplicates, missing personalization). Mass-mail tools (Mailchimp, Lemlist) are designed for marketing, not 1:1 outreach from a personal Gmail.
- **Solution**: A minimal CLI that uses *your* Gmail (not a sender service), reads from Excel (recruiter-by-recruiter editable), and throttles to mimic human pace — deliverability stays high because Gmail sees humanlike behavior.

## 7. Architecture
```
ColdOutrichAutoEmail/
├── src/
│   ├── index.ts (or .js)         # CLI entry, arg parsing
│   ├── excel.ts                   # read Active_Queue + Templates
│   ├── template.ts                # fill {placeholders}
│   ├── sender.ts                  # SMTP send + retry
│   ├── sent-log.ts                # append + dedupe
│   └── commands/                  # send / preview / stats
├── scripts/                       # one-off helpers
├── tests/
├── email_outreach_list.xlsx       # the inbox queue (you edit this)
├── sent.log                       # append-only proof-of-send
├── logs/                          # per-run logs
├── crontab.example                # schedule examples
├── LEARNINGS.md                   # ops playbook + deliverability
├── BuildPrompt.md                 # how this was built with Claude
└── .env                           # FROM_EMAIL + APP_PASSWORD + FROM_NAME
```

Send loop (rough):
```
for row of queue:
  if row.manual_skip or sent.has(row.email + template): continue
  body = expand(template, row)
  await sleep(45s + random(0,15s))
  await smtp.send(body)
  sent.append({ts, email, template})
  if count >= cap or count >= dailyCap: stop
```

## 8. Critical Safety Rules (from my CLAUDE.md)
1. **No hard cap on N** — user controls volume; warn above ~40 but don't clamp.
2. **Set `--daily-cap` equal to `N`** to keep ceiling consistent.
3. **Always include `--live`** — without it, nothing sends.
4. **Always include `--template T1_NAMED_PERSON`** by default unless user says T2 or all.
5. **Show user the command and ask for confirmation BEFORE running** — sending emails is hard-to-reverse.
6. **Never run `npm run send` without all safety flags above.**
7. **If user asks for >40 in a single command**: note deliverability risk once, then proceed.

Standard command:
```bash
cd /home/primathon/Documents/p_projet/ColdOutrichAutoEmail
npm run send -- --live --cap <N> --daily-cap <N> --template T1_NAMED_PERSON
```

## 9. Important File Paths
- README: `ColdOutrichAutoEmail/README.md`
- Operational playbook: `LEARNINGS.md` (esp §3 warm-up, §4 sent-log, §9 deliverability, §12 cron)
- Build context: `BuildPrompt.md`
- Cron examples: `crontab.example`
- Excel queue: `email_outreach_list.xlsx`

## 10. Tags
`nodejs`, `cli`, `gmail-smtp`, `cold-email`, `job-hunt`, `automation`, `xlsx`, `throttled`, `personal-gmail`, `app-password`

---

## 11. Interview Questions I Should Be Ready For

### Cold Outreach / Deliverability
1. Why send from personal Gmail vs SendGrid / Mailgun / Resend?
2. How do you stay below Gmail's anti-spam thresholds? (45s+jitter, warm-up, <50/hr, plain text, no tracking pixels)
3. What's an App Password and why not OAuth?
4. How would you handle bounces? Soft vs hard.
5. How do you avoid being flagged as spam by recipient gmail/outlook?
6. What's the warm-up schedule and why does it matter for a new outreach pattern?

### Architecture
7. Why Excel as the source-of-truth instead of a database?
8. Why append-only `sent.log` instead of a state DB?
9. How would you migrate this to a multi-user SaaS? (sender accounts, OAuth, queue, worker)
10. How would you add retry on transient SMTP failures?
11. How would you A/B test subject lines?

### Safety / Idempotency
12. How does dry-run mode work? What can go wrong if it's disabled by accident?
13. Why both `--cap` AND `--daily-cap`?
14. How do you handle race conditions on `sent.log` if two runs overlap? (Don't run two at once; lock file)
15. How does Ctrl+C handle cleanup? Race condition during in-flight send?
16. What happens if Gmail SMTP times out mid-send? Is the row marked sent or not?

### Templating
17. How are `{first_name}` / `{company}` extracted from row data?
18. How would you support conditional template logic (if/else by company size)?
19. How would you support attachments? (Resume PDF per role)

### Throttling / Pacing
20. Why 45s base + 0–15s jitter? What's the intuition?
21. What's the right warm-up curve from 10 → 40?
22. How would you parallelize sends across multiple accounts safely?

### Production / Ops
23. How would you schedule this via cron? What are the failure modes?
24. How do you monitor whether your sends actually landed in inbox vs spam?
25. How do you handle a recipient replying — do you stop further sends to that thread?
26. How would you integrate this with a CRM (HubSpot / Notion) for tracked outreach?

### Personal CLAUDE.md Workflow
27. Walk me through how the CLAUDE.md safety rules enforce safe sending in Claude Code sessions.
28. Why pre-send confirmation? Why `npm run stats` first?

---

## 12. Extra Talking Points (Bring Up Voluntarily)

- **Why I built this**: Job hunt = ~50 emails/day. Mailchimp/Lemlist are designed for 1000s of marketing emails; they look spammy. Personal Gmail + slow throttle = high deliverability.
- **The 45s+jitter is everything**: My emails consistently land in inbox (not spam), and Gmail hasn't flagged my account in 1000+ sends.
- **Why Excel as queue**: I edit it on my phone, on desktop, via OneDrive/Drive sync. Database = friction.
- **The CLAUDE.md safety contract**: I've embedded strict rules in my user-level CLAUDE.md so even Claude Code can't accidentally fire 100 emails. Every send requires explicit confirmation with the exact command shown.
- **Lessons from real ops**: (a) Warm up slowly: 10 → 15 → 20 over a week. (b) Never send weekends — recruiters ignore. (c) T1 (named person) gets 3-5x reply rate vs T2 (role inbox). (d) Subject line matters more than body for open rate.
- **Failure modes I've hit**: Gmail "less secure apps" was deprecated mid-2024 — had to migrate to App Passwords (which require 2FA). Documented in LEARNINGS.md.
- **Why not OAuth**: OAuth requires hosting a redirect URL + token storage. App Password = one secret in `.env`. For a personal CLI, OAuth is overkill.
- **Future enhancements**: IMAP listener to detect replies + auto-pause that thread; template A/B testing; sentiment analysis of replies via Claude; integration with j_hunter (my self-hosted job-hunting agent which uses this pattern).

---

## 13. If I Need to Revisit This Project Later
Read in this order:
1. `README.md` — setup + commands
2. `LEARNINGS.md` — ops playbook (warm-up, sent-log, deliverability, cron)
3. `BuildPrompt.md` — how it was built (originally Claude-driven)
4. `.env` (don't commit) — `FROM_EMAIL`, `APP_PASSWORD`, `FROM_NAME`
5. `email_outreach_list.xlsx` — current queue + templates
6. `sent.log` — proof-of-send + dedupe source
7. `src/` — actual CLI code

Setup from scratch:
```bash
cd ColdOutrichAutoEmail
npm install
cp .env.example .env
# Edit .env: FROM_EMAIL, APP_PASSWORD (Google account → 2FA → App Passwords), FROM_NAME
# Place email_outreach_list.xlsx at project root
```

Day-to-day workflow:
```bash
npm run stats                       # see today's count + queue
npm run preview                     # render first 5 emails to terminal
npm run send                        # DRY RUN (no actual send)
npm run send -- --live --cap 20 --daily-cap 20 --template T1_NAMED_PERSON
```

To stop a running send: **Ctrl+C once** — handles SIGINT cleanly.

To edit email body: Excel → `Templates` tab → row 4 (T1) col B. Keep `{first_name}`, `{full_name}`, `{company}` placeholders.

To edit per-row subject: Excel → `Active_Queue` tab → `suggested_subject` column.

Cron scheduling: see `crontab.example`.
