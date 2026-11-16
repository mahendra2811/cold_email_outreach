# Cold Outreach — Operations & Customization Guide

Everything you need to operate, customize, and extend this tool. Read top-to-bottom once; bookmark sections 4–7 for daily reference.

---

## TL;DR Cheat Sheet

```bash
# Inspect before doing anything
npm run stats                                # counts, ready/sent breakdown
npm run preview                              # render first 5 emails to terminal
npm run preview -- --count 20                # render more
npm run preview -- --template T1_NAMED_PERSON

# Dry-run (safe — nothing sent)
npm run send                                 # defaults to dry-run, cap=10
npm run send -- --cap 5 --delay 0 --jitter 0 # quick render of 5

# Real sending (must pass --live explicitly)
npm run send -- --live --cap 10              # day 1 cap
npm run send -- --live --cap 20 --template T1_NAMED_PERSON

# Resume — already-sent rows are auto-skipped via sent.log
npm run send -- --live --cap 10              # safe to re-run any time

# Stop mid-run: Ctrl+C — finishes current row, prints summary
```

**Golden rule:** no `--live` = no send. Pass it explicitly when you actually mean to send.

---

## 1. First-Time Setup

### Prerequisites
- Node.js 20+ (you're on 24, fine)
- 2-Factor Authentication enabled on your Google account
- An **App Password** from Google — generate at https://myaccount.google.com/security → "App passwords"

### Install
```bash
cd ColdOutrichAutoEmail
npm install
cp .env.example .env
```

Edit `.env`:
```
GMAIL_USER=youremail@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
FROM_NAME=Mahendra Singh Puniya
```

### Place the Excel file
Default expected name: `email_outreach_list.xlsx` at project root.
Your file is currently `email_outreach_list (2).xlsx` — already symlinked to the default name. If you replace the file, either:
- Rename to `email_outreach_list.xlsx`, **or**
- Pass `--file "email_outreach_list (2).xlsx"` to every command

---

## 2. The Three Commands

### `send` — main command
```
npm run send -- [flags]

  --file <path>            Excel file path           (default: ./email_outreach_list.xlsx)
  --cap <n>                Max emails this run       (default: 10)
  --delay <seconds>        Base delay between sends  (default: 45)
  --jitter <seconds>       Random extra 0..N seconds (default: 15)
  --dry-run                Render only, don't send   (default if --live not given)
  --live                   Actually send via SMTP    (REQUIRED to send)
  --template <id>          Filter: T1_NAMED_PERSON or T2_ROLE_INBOX
  --sent-log <path>        Sent log file             (default: ./sent.log)
```

`--dry-run` and `--live` are mutually exclusive — passing both is a fatal error.

### `preview` — inspect renders without sending
```
npm run preview -- [flags]

  --file <path>            (default: ./email_outreach_list.xlsx)
  --sent-log <path>        (default: ./sent.log)
  --template <id>          optional filter
  --count <n>              (default: 5)
```

### `stats` — counts and breakdown
```
npm run stats -- [flags]

  --file <path>            (default: ./email_outreach_list.xlsx)
  --sent-log <path>        (default: ./sent.log)
```

---

## 3. Daily Workflow (warm-up week)

A personal Gmail account can be suspended if Google's spam classifier flags you. **Always ramp slowly.**

| Day | `--cap` | What to watch |
|-----|---------|---------------|
| 1   | 10      | Check inbox for bounces (`Mail Delivery Subsystem`). Check Sent folder. |
| 2   | 15      | Any spam complaints? Any "Account suspended" alerts? |
| 3   | 20      | Steady. Vary `--delay` between 45–90 if you want extra caution. |
| 4   | 25      | |
| 5   | 30      | |
| 6   | 35      | |
| 7+  | 40      | Cap here. Spread across the day, not all at once. |

Run **morning, lunch, evening** in three chunks rather than all at once — more human-looking pattern.

```bash
# Morning
npm run send -- --live --cap 4 --template T1_NAMED_PERSON
# Lunch (auto-resumes from sent.log)
npm run send -- --live --cap 3
# Evening
npm run send -- --live --cap 3
# Total today: 10
```

---

## 4. Tracking & Auditing Sent Emails

### What gets logged
On every successful send, **before** sleeping, this line is appended to `sent.log`:
```
2026-05-11T08:30:14.221Z,ajay.tiwari@in.abb.com
```
The timestamp + comma + email format means you have a full audit trail by time.

### Useful shell commands

```bash
# Total emails ever sent
wc -l sent.log

# Sent today (UTC)
grep "^$(date -u +%Y-%m-%d)" sent.log | wc -l

# Sent in last hour
awk -v cutoff="$(date -u -d '1 hour ago' +%FT%T)" -F, '$1 > cutoff' sent.log | wc -l

# Last 20 sends
tail -20 sent.log

# Which domains have I emailed most
cut -d, -f2 sent.log | cut -d@ -f2 | sort | uniq -c | sort -rn | head

# Have I emailed this specific person?
grep -i "ajay.tiwari@in.abb.com" sent.log

# Unique recipients (defensive — shouldn't have duplicates, but check)
cut -d, -f2 sent.log | sort -u | wc -l
```

### Sent.log lookup is case-insensitive
The CLI lowercases emails before comparing, so `Foo@Bar.com` and `foo@bar.com` are treated as the same recipient (per RFC 5321).

### Resetting sent state

```bash
# Wipe everything — re-send to entire queue from scratch
rm sent.log

# Remove a specific recipient so it can be re-sent
grep -v "ajay.tiwari@in.abb.com" sent.log > sent.log.new && mv sent.log.new sent.log

# Remove everything sent today (start the day over)
grep -v "^$(date -u +%Y-%m-%d)" sent.log > sent.log.new && mv sent.log.new sent.log
```

### Backing up sent.log
**Do this every day before sending.** sent.log is your only crash-recovery state.

```bash
# Manual daily backup
cp sent.log "sent.log.backup.$(date +%Y-%m-%d)"

# Or run it before every send (alias in your shell)
alias outreach-backup='cp ~/Documents/p_projet/ColdOutrichAutoEmail/sent.log ~/Documents/p_projet/ColdOutrichAutoEmail/sent.log.backup.$(date +%Y-%m-%d-%H%M)'
```

### Cross-check with Gmail Sent folder
```
in:sent newer_than:1d
```
Count should match `grep "^$(date -u +%Y-%m-%d)" sent.log | wc -l` (within a small timezone offset).

---

## 5. Editing Content Without Touching Code

90% of customization needs only Excel + `.env`. No code edits required.

### 5a. Edit a template body

1. Open `email_outreach_list.xlsx`
2. Go to the `Templates` tab
3. Find the row where column A is `T1_NAMED_PERSON` or `T2_ROLE_INBOX`
4. Edit column B
5. **Format requirement:** body must start with `SUBJECT: <line>\n\n<actual body>` — that `SUBJECT:` line is auto-stripped at load time. (Per-row subjects come from `Active_Queue.suggested_subject`, not from this prefix.)
6. Save
7. `npm run preview` to verify

**Available placeholders inside the body:** `{first_name}`, `{full_name}`, `{company}` — anywhere, any number of times.

### 5b. Edit a subject line

Subjects are **per-row** in `Active_Queue.suggested_subject`. To change them:

- **One row:** edit the cell directly
- **All T1 rows:** Excel formula in a scratch column, then paste-values back. Example formula:
  ```
  ="Frontend Engineer (1+ yr) — interested in "&[@company_guess]
  ```
- **Templates only:** subjects support `{company}` and `{first_name}` placeholders too (same engine as body)

### 5c. Change sender display name
Edit `.env`:
```
FROM_NAME=Your Display Name
```

### 5d. Skip a row
In `Active_Queue`, put **any non-empty value** in the `manual_skip` column for that row (e.g., `x`, `skip`, `bounced`, `do-not-contact`). Save. The CLI skips it permanently.

This is **different from** sent.log:
- `manual_skip` = "never send" (your intent)
- `sent.log` = "already sent" (history)

Use `manual_skip` for bounces, do-not-contact requests, recipients you decide to skip.

### 5e. Add a new row to the queue

In `Active_Queue`, add a row with these required columns filled:

| Column | Example |
|--------|---------|
| `email` | `jane@acme.com` |
| `template_id` | `T1_NAMED_PERSON` or `T2_ROLE_INBOX` |
| `template_variables` | `{"company":"Acme","first_name":"Jane","full_name":"Jane Doe"}` |
| `suggested_subject` | `Frontend Engineer (1+ yr, React/Next.js) — quick intro` |

Optional columns (display only): `person_full_name`, `company_guess`.

Leave `manual_skip` blank. Save. Run `npm run preview -- --count 200` to find your row and verify rendering before sending.

---

## 6. Customizing via Code

### 6a. Add a new placeholder (e.g., `{role}`, `{city}`, `{referrer}`)

Four small edits:

**1. `src/template.js:43`** — extend the regex:
```js
const PLACEHOLDER_RE = /\{(first_name|full_name|company|role|city)\}/g;
```

**2. `src/config.js:11`** — add a fallback:
```js
export const FALLBACKS = Object.freeze({
  first_name: 'team',
  full_name: '',
  company: 'your company',
  role: 'the role',
  city: '',
});
```

**3. `src/template.js:33`** — add to `applyFallbacks`:
```js
return {
  first_name: pick('first_name'),
  full_name: pick('full_name'),
  company: pick('company'),
  role: pick('role'),
  city: pick('city'),
};
```

**4.** In Excel `template_variables` column, include the new key:
```json
{"company":"Acme","first_name":"Jane","role":"Senior Frontend"}
```

Use `{role}` and `{city}` anywhere in body or subject.

### 6b. Add a new template type (e.g., `T3_FOLLOWUP`)

**1. `src/config.js`** — register the ID:
```js
export const TEMPLATE_T3 = 'T3_FOLLOWUP';
export const VALID_TEMPLATE_IDS = new Set([TEMPLATE_T1, TEMPLATE_T2, TEMPLATE_T3]);
```

**2. `src/excel.js:65`** — make sure both required templates check still allows T3 to be optional, OR add T3 as required. Adjust this block:
```js
if (!out[TEMPLATE_T1] || !out[TEMPLATE_T2]) {
  // existing required-template check
}
```
T3 is optional unless you add it to that condition.

**3. `src/index.js`** — `SHORT_TEMPLATE` map for log output:
```js
const SHORT_TEMPLATE = {
  [TEMPLATE_T1]: 'T1',
  [TEMPLATE_T2]: 'T2',
  [TEMPLATE_T3]: 'T3',
};
```

**4. In Excel `Templates` tab**, add a new row:
- Column A: `T3_FOLLOWUP`
- Column B: `SUBJECT: Following up on my earlier email\n\nHi {first_name}, ...`

**5. In `Active_Queue`**, set `template_id` to `T3_FOLLOWUP` for rows that should use it.

Run `npm run send -- --template T3_FOLLOWUP --live --cap 10`.

### 6c. Change fallback values
Edit `src/config.js:11`. For example, change "team" to "there":
```js
export const FALLBACKS = Object.freeze({
  first_name: 'there',
  full_name: '',
  company: 'your company',
});
```

### 6d. Add Reply-To, BCC yourself, or CC

Edit `src/sender.js:42`:
```js
return async ({ to, subject, text }) => {
  const info = await transport.sendMail({
    from: fromHeader,
    to,
    subject,
    text,
    replyTo: cfg.gmailUser,         // explicit reply-to
    bcc: cfg.gmailUser,             // BCC yourself for record (CAUTION: doubles your Gmail send count!)
  });
  return { messageId: info.messageId, dryRun: false };
};
```

**Warning on `bcc: self`** — it counts against your 500/day Gmail limit twice (once for the recipient, once for the BCC copy to yourself). For audit trail, just use the Gmail "Sent" folder; you don't need BCC.

### 6e. Add a signature / footer to all emails
Two options:

**Option A (in Excel):** edit each template body in the `Templates` tab to include the signature at the bottom. Cleanest.

**Option B (in code):** Append in `src/index.js` after `renderRow`:
```js
rendered.text = rendered.text + '\n\n--\nSent via personal outreach. Reply STOP to opt out.';
```

### 6f. Change console output format
Edit the log lines in `src/index.js` inside `runSend()` (around lines 228–253). Each render uses `pad()` for column alignment. Examples:

```js
// More verbose
log.ok(`✓ [${row.template_id}] ${row.email} | "${rendered.subject}"`);

// CSV-style (pipe to a file for spreadsheet import)
log.raw(`${new Date().toISOString()},${row.email},${row.template_id},sent`);
```

### 6g. Why not add HTML emails?
**Don't.** Plain text:
- Has dramatically better deliverability from personal Gmail
- Looks human, not marketing-automated
- Cannot carry tracking pixels (which Gmail and Apple Mail both flag/strip)
- Renders identically in every email client

If you absolutely need a link to look like a hyperlink: paste the full URL. Gmail auto-linkifies it on display.

---

## 7. Handling Edge Cases & Follow-Ups

### 7a. You only have an email address — no name, no company — how to send

This is a common follow-up scenario: a recruiter shares `careers@somecompany.com` and that's it.

**Method 1 — Just add a row (recommended, no code change)**

The tool's fallback system handles this. Add a row to `Active_Queue`:

| Column | Value |
|--------|-------|
| `email` | `careers@somecompany.com` |
| `template_id` | `T2_ROLE_INBOX` (T2 is designed for role inboxes / unknown person) |
| `template_variables` | `{}` (empty object — fallbacks fill in) |
| `suggested_subject` | `Application — Frontend / Full-Stack Developer (1+ yr exp)` |

**What gets rendered:**
- T2 body line `"Hi {company} team,"` becomes `"Hi your company team,"` (fallback)
- T2 body line `"I came across {company}"` becomes `"I came across your company"`

This works but reads a bit awkward. Two better approaches:

**Method 2 — Derive company from the email domain**

For `careers@somecompany.com`, set `company: "SomeCompany"` manually:
```json
{"company": "SomeCompany"}
```
Renders as: `"Hi SomeCompany team, ... I came across SomeCompany"`.

A 5-second manual lookup gives a much better email. **Do this** — it's the difference between a generic blast and a personalized message.

**Method 3 — Add a dedicated "minimal-context" template**

Add a new template `T3_FOLLOWUP` (see section 6b) designed for cases where you have no metadata:
```
SUBJECT: Frontend Engineer — open role inquiry

Hello,

I'm Mahendra Singh Puniya, a Software Developer at Primathon with 1+ year of production experience in React.js, Next.js, and Node.js. Reaching out about any open Frontend or Full-Stack Developer roles your team is hiring for.

Highlights:
• Core team on Storefront-Builder (multi-merchant Next.js platform)
• Built Care41.net booking platform end-to-end
• AI engineering: custom Claude Code agents, CLI tools

Resume: https://drive.google.com/file/d/1gnZiqkO2vQcC_6gco8J2bkDt6E_d7Rzy
Portfolio: https://pooniya.com
Phone: +91-7568265755

Mahendra Singh Puniya
```
No placeholders → works for any email with zero metadata.

### 7b. Quick one-off send (single email, not in Excel)

Cleanest workflow today: create a tiny scratch Excel.

```bash
# Copy your main Excel to a one-off scratch
cp email_outreach_list.xlsx oneoff.xlsx
# Open oneoff.xlsx in Excel, delete all rows from Active_Queue except your one new row, save
npm run send -- --live --cap 1 --file ./oneoff.xlsx --sent-log ./oneoff.sent.log
```

Using `--sent-log ./oneoff.sent.log` keeps the one-off out of your main sent log.

**Or add a `send-one` command** (small enhancement — let me know if you want this added). Sketch:

```js
PROGRAM.command('send-one')
  .description('Send a single email by recipient + template, no Excel needed')
  .requiredOption('--to <email>')
  .requiredOption('--template <id>', `T1_NAMED_PERSON, T2_ROLE_INBOX, etc.`)
  .option('--first-name <name>')
  .option('--company <name>')
  .option('--subject <text>', 'Override the subject from .env or default')
  .option('--live')
  .option('--dry-run')
  .action(async (opts) => { /* render + send via createSender */ });
```

Useful for: replying to a thread, following up on a specific lead, testing a new template against your own email.

### 7c. Sending a follow-up to someone you ALREADY emailed

The CLI skips anyone in `sent.log` — so you need to either:

**Option 1 — Use a separate sent.log for follow-ups:**
```bash
npm run send -- --live --cap 10 --sent-log ./followup.sent.log --template T3_FOLLOWUP
```
This means follow-ups track their own sent state, and the same person can be reached by both the initial send and a follow-up.

**Option 2 — Temporarily remove a row from the main sent.log:**
```bash
grep -v "ajay.tiwari@in.abb.com" sent.log > sent.log.tmp && mv sent.log.tmp sent.log
```
Then send. After sending, the row gets re-added to sent.log. **You lose the original send timestamp** with this approach.

**Option 3 (recommended for systematic follow-ups):** use a follow-up sent-log AND a follow-up template:
```bash
# Initial send
npm run send -- --live --cap 10 --template T1_NAMED_PERSON

# 5 days later: follow-up to T1 recipients who haven't replied
# (You manually filter Active_Queue to a follow-up queue, or use --sent-log ./fu1.sent.log)
npm run send -- --live --cap 10 --template T3_FOLLOWUP --sent-log ./fu1.sent.log
```

### 7d. Resuming after a crash
Just re-run the same command. `sent.log` is append-only and written **before** the inter-send sleep, so:
- If the process was killed mid-sleep → no row is lost (last send is already in log)
- If killed mid-send → that one row may or may not have actually delivered; check Gmail Sent folder, manually add to `sent.log` if needed, then re-run

### 7e. Re-sending only failures from a previous run

The tool does NOT auto-retry failures (by design — keep this simple). Errored sends are visible in your terminal as `✗ ... SEND ERROR: ...`.

**To retry failures:**
1. Errored emails were **not** appended to sent.log
2. Re-running the same command picks them up automatically (they're still "ready")
3. If a specific row consistently fails (invalid email, etc.), mark it `manual_skip=x` in Excel so it stops trying

---

## 8. Multiple Campaigns / Multiple Accounts

### Different campaigns
Use separate Excel files and separate sent-logs:
```bash
# Campaign A: frontend roles
npm run send -- --live --cap 10 \
  --file ./campaign-frontend.xlsx \
  --sent-log ./sent.frontend.log

# Campaign B: AI eng roles
npm run send -- --live --cap 10 \
  --file ./campaign-ai.xlsx \
  --sent-log ./sent.ai.log
```

### Different Gmail accounts
You can't switch accounts via CLI flag — pick one of these:

**A. Multiple `.env` files:**
```bash
cp .env .env.personal
cp .env .env.work
# Edit each with different GMAIL_USER + GMAIL_APP_PASSWORD

# Run with a specific env
node -r 'dotenv/config' src/index.js send --live --cap 10 dotenv_config_path=.env.work
```
But our CLI uses `dotenv/config` directly. Simpler: temporarily symlink:
```bash
ln -sf .env.work .env && npm run send -- --live --cap 10
ln -sf .env.personal .env && npm run send -- --live --cap 5
```

**B. Edit `src/config.js` to support `--env <path>`:**
```js
import { config as loadDotenv } from 'dotenv';
loadDotenv({ path: process.env.ENV_FILE || '.env' });
```
Then: `ENV_FILE=.env.work npm run send -- --live --cap 10`

---

## 9. Throttling & Deliverability — How Many Emails Are Actually Safe

### TL;DR — the numbers

| Daily volume        | Risk level           | Reality                                                                          |
|---------------------|----------------------|----------------------------------------------------------------------------------|
| **1–20/day**        | ✅ Very safe         | Indistinguishable from normal personal email. No flag risk.                       |
| **20–30/day**       | ✅ Safe              | Normal active job-seeker volume. Recommended long-term.                          |
| **30–40/day**       | 🟡 Safe with care    | Need plain text + personalization + spread across the day. **Recommended max.**   |
| **40–60/day**       | 🟠 Risky             | Watch for spam complaints. Drops to spam folder more often.                       |
| **60–100/day**      | 🔴 High risk         | Spam-folder placement common. Temporary block possible.                          |
| **100–500/day**     | ⛔ Don't             | Gmail's hard cap is 500/day, but at this volume on a personal account you will be flagged. |
| **>500/day**        | ⛔ Blocked            | Hard cap — Gmail refuses to send and may suspend the account.                    |

**Per-hour matters as much as per-day.** Even at 30/day, blasting all 30 in 10 minutes triggers Gmail's rate-limit heuristics. Spread = your friend.

| Per-hour rate      | Risk level                                                                          |
|--------------------|--------------------------------------------------------------------------------------|
| **<20/hour**       | Safe                                                                                |
| **20–50/hour**     | Borderline — only do this if you're below 30/day total                              |
| **>50/hour**       | Rate-limited or flagged                                                              |
| **>100/hour**      | Almost certain temporary block                                                       |

The tool's default `45s + 0–15s jitter` = max ~80/hour theoretical, but you should never run a single batch larger than 10–15 emails.

### Recommended schedule (matches `crontab.example`)

**Steady state — 30 emails/day (RECOMMENDED for personal Gmail):**
- 9:30 AM: 10 emails (T1 named-person — highest engagement window)
- 1:00 PM: 10 emails (post-lunch inbox check)
- 5:00 PM: 10 emails (end-of-day inbox check)
- Mon–Fri only. Skip weekends.

**Why 30 and not 40:**
- Buffer for off-days (some replies need follow-up sends counted in your daily budget)
- Survives small spikes (e.g., one row malformed → you don't blow past the limit)
- Lower bounce-rate impact if a bad address slips through

### What lands you in the spam folder (vs. inbox)

These are the things Gmail looks at when deciding inbox-vs-spam for individual messages:

| Signal                                                | Inbox-friendly                                            | Spam-flag                                                    |
|-------------------------------------------------------|------------------------------------------------------------|--------------------------------------------------------------|
| **Format**                                            | Plain text                                                 | HTML with images                                             |
| **Tracking**                                          | None                                                       | Pixels, link rewrites (bit.ly, mailgun click-tracking)      |
| **Personalization**                                   | First name, company name in body                          | Identical content to many recipients                         |
| **From name**                                         | Your real name                                             | Generic ("Recruitment Team", "Career Bot")                   |
| **Subject**                                           | Specific, no ALL CAPS, no "$$$/Free/Urgent"               | Spammy words, all caps, excessive `!!!`                      |
| **Reply-To**                                          | Same as From (your real Gmail)                            | Different domain (looks like spoofing)                       |
| **URL count**                                         | 1–3 full URLs                                              | 5+ URLs, shortened URLs                                       |
| **Volume from sender**                                | <50/day, gradually increasing                              | Sudden burst from new sender                                 |
| **Engagement history**                                | Past recipients replied / didn't mark spam                | Past recipients marked as spam                                |
| **Send time pattern**                                 | Spread across hours                                       | All at 3 AM                                                    |
| **Authentication (SPF/DKIM/DMARC)**                  | Gmail handles automatically for gmail.com → ✅           | N/A — you can't break this with SMTP App Password            |

**You already do most of these right:**
- ✅ Plain text only (no HTML, no images)
- ✅ No tracking pixels
- ✅ Personalized with `{first_name}` and `{company}`
- ✅ Real `FROM_NAME` in `.env`
- ✅ Reply-To = your Gmail (default nodemailer behavior)
- ✅ 3 URLs in templates (resume, portfolio, phone)
- ✅ SPF/DKIM/DMARC automatic for `@gmail.com` sends

**What you still need to maintain:**
- 🟡 Send time spread → use cron schedule, not one big batch
- 🟡 Volume cap → use `--daily-cap` (now enforced automatically)
- 🟡 Bounce rate → mark `manual_skip` for bounces immediately
- 🟡 Watch for spam-marks → check Gmail's "Spam" folder weekly for replies-gone-wrong

### What gets your ACCOUNT (not just the message) flagged

Different from spam-folder placement. Account flags = Google suspends or restricts your account.

- **>500/day** → hard cap, account warning
- **>200/day sustained** for a personal Gmail → suspension likely within a week
- **High spam-complaint rate** (>0.3% of recipients marking as spam) → fast track to suspension
- **High bounce rate** (>5%) → reputation drop, account warning
- **Sudden volume spike** (0 → 100/day overnight) → flag for review

### What's safe long-term

- **30 emails/day, weekdays only, 3 batches** — indefinitely sustainable for personal Gmail
- **40 emails/day max** — only after 2+ weeks of clean sending history
- **Plain text, personalized, real name, real Reply-To** — non-negotiable
- **Backed-up `sent.log`** — protects you against re-emailing the same person (which is the #1 way to get spam complaints)

### If Gmail flags you

1. **Stop sending immediately** (`pkill -f send-batch.sh` and disable cron)
2. Check https://accounts.google.com/AccountDisabled for status
3. Sign in to your Gmail in a browser — Google often shows a warning banner
4. Wait 24–48 hours
5. When you resume: cap at 5/day for a week, then ramp slowly
6. Audit: which emails caused complaints? Mark those recipient domains `manual_skip` permanently
7. Consider: was the content too sales-y? Simplify language.

---

## 12. Scheduling Batched Sends with Cron

Send emails at fixed times in bunches (e.g., 10 at 9:30 AM, 10 at 1 PM, 10 at 5 PM) — fully automated, with a hard daily-cap safety net so misconfigured cron can never blow past your limit.

### Components

The tool ships three scheduling pieces:

| File                     | Purpose                                                                              |
|--------------------------|--------------------------------------------------------------------------------------|
| `--daily-cap` flag       | Hard daily ceiling. Counts today's sends from `sent.log` (your local TZ).            |
| `scripts/send-batch.sh`  | Cron-safe wrapper. Handles nvm PATH, skips weekends, writes logs to `logs/`.        |
| `crontab.example`        | Copy-paste schedules for 20/30/40 emails-per-day.                                    |

### How `--daily-cap` works

```bash
# Cap this batch at 10. Hard daily limit: 30 (across all batches today).
npm run send -- --live --cap 10 --daily-cap 30
```

Behavior:
- Reads `sent.log`, counts entries with timestamps that fall on **today's local date**
- If already at/above `--daily-cap` → exits immediately, sends nothing
- Otherwise, `effective_cap = min(--cap, --daily-cap − sent_today)`
- Logs the math at the top of the run so you can see what's happening

**Why this matters:** if cron mis-fires twice in a minute (it sometimes does after a reboot or clock adjustment), or you manually run a batch on top of a scheduled one, `--daily-cap` guarantees you won't exceed your safety limit.

Set `--daily-cap` slightly above your intended max:
```bash
# Plan: 30/day. Use --daily-cap 30. Don't use --daily-cap 60 "just in case."
```

### Setting up cron — step by step

**Step 1 — Read the example schedules:**
```bash
cat crontab.example
```

Three schedules are pre-written:
- **Warm-up week** (day 1: 10, day 2: 15, day 3: 20)
- **Steady state** (30/day in 3 batches — RECOMMENDED)
- **Aggressive** (40/day in 4 batches — only after 2+ clean weeks)

**Step 2 — Test the wrapper manually first:**
```bash
bash scripts/send-batch.sh --cap 2 --daily-cap 30 --delay 0 --jitter 0
# (no --live → dry-run; nothing actually sent)
tail logs/cron-$(date +%Y-%m-%d).log
```

You should see the wrapper write a header, run the CLI in dry-run, log the output. If this works, cron will work.

**Step 3 — Install the cron schedule:**
```bash
crontab -e
```

This opens your crontab in an editor (vim or nano depending on your `$EDITOR`). Paste the **STEADY STATE** block from `crontab.example`:
```
30 9  * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30 --template T1_NAMED_PERSON
0  13 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30
0  17 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30
```

Save and exit. Cron is now scheduled.

**Step 4 — Verify the schedule is installed:**
```bash
crontab -l
```

**Step 5 — Add `MAILTO=""` at the top of crontab (optional)** to suppress cron's email-on-output:
```
MAILTO=""

30 9 * * 1-5 ...
```

### Monitoring scheduled runs

**Live tail of today's log:**
```bash
tail -f logs/cron-$(date +%Y-%m-%d).log
```

**See what got sent today:**
```bash
grep "^$(date -u +%Y-%m-%d)" sent.log | wc -l        # count
tail -20 sent.log                                     # last 20 sends with timestamps
```

**See errors this week:**
```bash
grep -i "error\|fatal" logs/cron-*.log
```

**Verify cron actually ran (didn't silently fail):**
```bash
ls -la logs/ | tail -10                               # one log file per day
grep "START batch run" logs/cron-$(date +%Y-%m-%d).log
```

If no log file exists for today and a batch should have fired, cron probably isn't running or the path is wrong. Check:
```bash
systemctl status cron        # is cron running?
cat /var/log/syslog | grep CRON | tail   # what did cron try to do?
```

### Adjusting the schedule

**Change daily cap:**
Edit `crontab -e`, change all `--daily-cap 30` to `--daily-cap 25`, save. Takes effect immediately for the next batch.

**Change times:**
Edit the cron fields (minute hour) — see `crontab.example` for the field reference.

**Pause sending temporarily:**
```bash
crontab -e
# Put # in front of each send-batch line. Save. Cron stops firing.
```

Restart:
```bash
crontab -e
# Remove the # marks. Save.
```

**Switch from T1 to T2 (after T1 queue is exhausted):**
```bash
crontab -e
# Change `--template T1_NAMED_PERSON` to `--template T2_ROLE_INBOX` (or remove the flag to send mixed)
```

### Emergency stop

**Immediately stop all sending:**
```bash
pkill -f send-batch.sh           # kill any running batch
crontab -e                       # comment out all lines, save
```

**If you're worried about over-sending:**
The `--daily-cap` already protects you. Even if you forget to disable cron, you can't exceed your daily limit.

**If your Gmail gets flagged:**
1. `crontab -e` → comment out all lines → save (stops future batches)
2. Go to https://accounts.google.com/AccountDisabled
3. Wait 24–48 hours
4. When restored, edit `crontab.example` to use `--cap 3 --daily-cap 5` for a week before ramping back up

### Choosing your schedule

**Just started (day 1):**
```
30 10 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 10
```
One batch of 10 at 10:30 AM. See what happens.

**Going steady (day 8 onwards):**
```
30 9  * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30 --template T1_NAMED_PERSON
0  13 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30
0  17 * * 1-5 /home/primathon/Documents/p_projet/ColdOutrichAutoEmail/scripts/send-batch.sh --live --cap 10 --daily-cap 30
```
3 batches of 10 across the day. 30/day. **This is the recommended schedule.**

**You've finished T1 (named-person):**
After all 400 T1 rows are sent (~14 working days at 30/day), edit cron to switch to T2:
```
30 9  * * 1-5 ... --live --cap 10 --daily-cap 30 --template T2_ROLE_INBOX
0  13 * * 1-5 ... --live --cap 10 --daily-cap 30 --template T2_ROLE_INBOX
0  17 * * 1-5 ... --live --cap 10 --daily-cap 30 --template T2_ROLE_INBOX
```

### What happens in a typical cron run

```
$ cat logs/cron-2026-05-12.log

================================================================
[2026-05-12T09:30:01+05:30] START batch run
  args:      --live --cap 10 --daily-cap 30 --template T1_NAMED_PERSON
  node:      v24.14.0
  cwd:       /home/primathon/Documents/p_projet/ColdOutrichAutoEmail
================================================================

Cold Outreach — LIVE  •  cap=10  •  daily-cap=30  •  delay=45s (+0..15s jitter)
Already sent today: 0/30  |  remaining today: 30  |  effective cap this run: 10
Queue: 702 rows  |  ready: 395  |  skipped → manual_skip=0, already-sent=5, ...
Template filter: T1_NAMED_PERSON
Sent log: ./sent.log

[1/10] ✓ ajay.tiwari@in.abb.com         →  T1 — "Frontend Engineer (1+ yr, R..." — waiting 51s
[2/10] ✓ neha.verma@in.abb.com          →  T1 — "Frontend Engineer (1+ yr, R..." — waiting 47s
... (8 more)

Summary
  sent this run:  10
  total ever:     15
  errors:         0
  elapsed:        7m 53s

[2026-05-12T09:38:54+05:30] END batch run — exit=0
```

### Common cron gotchas

| Problem                                       | Cause                                                       | Fix                                                                                              |
|-----------------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------------------------------------------|
| Log file is empty                             | Cron not running, or PATH wrong                             | `systemctl status cron`; check `scripts/send-batch.sh` has the right `NVM_NODE_DIR`             |
| "command not found: node"                     | Cron's minimal PATH doesn't include nvm                     | The wrapper script handles this — make sure `NVM_NODE_DIR` matches your install                  |
| Runs at wrong time                            | Server timezone ≠ what you expect                           | `date` should show IST. If not, `sudo timedatectl set-timezone Asia/Kolkata`                     |
| Sends way more than expected                  | Multiple cron entries, or `--daily-cap` missing             | ALWAYS include `--daily-cap` in every cron entry                                                  |
| Sends nothing                                 | `--live` missing                                            | Add `--live` to every cron entry                                                                  |

---

## 10. Troubleshooting Reference

| Error | Cause | Fix |
|---|---|---|
| `Invalid login: 535-5.7.8` | Using regular password, not App Password | Generate App Password in Google Security settings. Paste exactly. |
| `Missing required env vars: GMAIL_USER, GMAIL_APP_PASSWORD` | `.env` missing or empty | `cp .env.example .env` and fill in |
| `Excel file not found` | File path wrong or symlink broken | `ls -la email_outreach_list.xlsx`; pass `--file <correct path>` |
| `Sheet "Active_Queue" not found` | Tab renamed or misspelled in Excel | Rename tab back, or edit `SHEET_ACTIVE_QUEUE` constant in `src/config.js` |
| `Templates sheet missing required template(s)` | T1 or T2 row missing from Templates tab | Add the missing row in column A with the body in column B |
| `ERROR: invalid JSON: ...` on a row | `template_variables` cell has malformed JSON | Fix the cell. Use double quotes inside: `{"company":"X"}` not `{'company':'X'}` |
| `SEND ERROR: Daily user sending quota exceeded` | Hit Gmail's 500/day cap | Wait 24 hours. Reduce future caps. |
| `SEND ERROR: 550 No such user here` | Recipient address doesn't exist | Mark that row `manual_skip=bounce` in Excel |
| `--dry-run and --live are mutually exclusive` | Passed both flags | Pass only one |
| Send appears successful but recipient didn't get it | Likely in their spam folder | Check Gmail Sent → click message → "show original" → see SPF/DKIM/DMARC status |

---

## 11. Safety Rules (Do Not Violate)

1. **Always `--live` explicitly.** Never alias it away. The friction is the point.
2. **Always `npm run preview` after editing a template** — catches placeholder typos, JSON errors, before any real send.
3. **Back up `sent.log` daily** (see section 4). If it's lost, you have no way to know who you've already contacted.
4. **Don't sync `sent.log` to git** — it has email addresses. Already `.gitignore`d.
5. **Don't commit `.env`** — has your App Password. Already `.gitignore`d.
6. **Cap stays ≤ 40/day for personal Gmail.** Higher = account suspension risk.
7. **Plain text only.** Don't add HTML mode "for nicer formatting." It will hurt you.
8. **Test in dry-run first** every time you touch templates or code. Cost: 0 seconds. Benefit: doesn't blast 100 broken emails.
9. **Don't share the `--file` Excel publicly** — it has emails, contact info, sometimes phone numbers.
10. **Honor unsubscribe / opt-out requests immediately** — set `manual_skip` and never re-send.

---

## Quick "where is X" reference

| What | Where |
|------|-------|
| Sender display name + creds | `.env` |
| Template bodies | Excel → `Templates` tab |
| Per-row subjects + recipient + vars | Excel → `Active_Queue` tab |
| Default cap/delay/jitter | `src/config.js` → `DEFAULTS` |
| Fallback values for missing vars | `src/config.js` → `FALLBACKS` |
| Valid template IDs | `src/config.js` → `VALID_TEMPLATE_IDS` |
| Allowed placeholders | `src/template.js` → `PLACEHOLDER_RE` |
| Sheet names | `src/config.js` → `SHEET_ACTIVE_QUEUE`, `SHEET_TEMPLATES` |
| Console output format | `src/index.js` → `runSend()` log lines |
| From header format | `src/sender.js` → `fromHeader` |
| Sent log format | `src/sentLog.js` → `appendSent()` |
| Error sleep duration | `src/config.js` → `DEFAULTS.errorSleepSeconds` |

---

## When to ask for code changes vs. doing it yourself

**Just do it (Excel only):** edit body text, edit subject text, add a row, skip a row.

**Just do it (`.env` only):** change sender display name, change Gmail account.

**Code change needed:** new placeholder, new template ID, change defaults, new CLI command (like `send-one`), change log format, support multiple env files cleanly.

Ask me to extend the tool when you find yourself doing the same manual workaround twice.
