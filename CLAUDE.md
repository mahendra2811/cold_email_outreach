# ColdOutrichAutoEmail — Project Instructions

Cold-email outreach CLI. Sends batched personalized emails via Gmail SMTP, tracking
progress in `sent.log` (per account) and reading recipients from `excel/HR_Contacts.xlsx`.

## Running a send

Always run from this directory. Required safety flags: `--live`, matching `--cap`/`--daily-cap`,
and `--template T1_NAMED_PERSON` by default. Without `--live` the CLI does a dry-run (nothing sends).

```bash
npm run send -- --live --cap <N> --daily-cap <N> --template T1_NAMED_PERSON
```

- `<N>` is whatever the user requests — no hard clamp. Flag deliverability risk once above ~40
  (Gmail personal-account spam heuristics), then proceed.
- Per-email delay ≈ 45s base + 0–15s jitter, so a batch takes roughly `N × 52s`.
- Long sends run in the foreground; Ctrl+C once stops cleanly (CLI handles SIGINT).

Pre-send check: run `npm run stats` first and show total sent, T1 rows remaining, and requested N.

## Multiple sender accounts (`--account <n>`)

The CLI supports several Gmail accounts, chosen with `--account`:

| Flag          | Env vars used                                          | Sent log      |
|---------------|--------------------------------------------------------|---------------|
| `--account 0` (default) | `GMAIL_USER` / `GMAIL_APP_PASSWORD` / `FROM_NAME`       | `sent.log`    |
| `--account 1` | `GMAIL_USER2` / `GMAIL_APP_PASSWORD2` / `FROM_NAME2` (`mr.coder0092@gmail.com`) | `sent.1.log`  |
| `--rotate`    | auto-rotate `[0→1]` when an account's daily cap is hit | per-account   |

- **Daily cap and sent-log are per-account** — each account tracks its own count and starts
  fresh against its own cap.
- "Send from another email id" / "the other account" / "second account" → add `--account 1`.

Second-account command:
```bash
npm run send -- --live --cap <N> --daily-cap <N> --template T1_NAMED_PERSON --account 1
```

## Source map

- `src/config.js` — `loadAccount(n)` reads per-account credentials from `.env`.
- `src/index.js` — CLI flags (`--account`, `--rotate`, `--cap`, `--daily-cap`, `--sent-log`),
  per-account daily-cap enforcement, sent-log path derivation.
- `src/sender.js` — builds the SMTP transport / sender function.
- `src/sentLog.js` — sent-log read/append + dedup.
- `src/excel.js`, `src/template.js`, `src/throttle.js`, `src/logger.js` — queue, templating, delay, logging.

## Editing content

- **Body**: `excel/HR_Contacts.xlsx` → `Templates` tab → row 4 (T1) / row 5 (T2), column B.
  Keep `{first_name}`, `{full_name}`, `{company}` placeholders.
- **Subject**: `Active_Queue` tab → `suggested_subject` column (per row).
- **Sender display name**: `.env` → `FROM_NAME=` (or `FROM_NAME2=` for account 1).
- Run `npm run preview` after edits before sending.

## Reference

Full operational guidance: `LEARNINGS.md` (§3 warm-up, §4 sent-log, §9 deliverability, §12 cron).
Scheduling: `crontab.example`.

## Campaign fresh start (16 Nov 2026)

The user requested a fresh campaign for all 773 contacts, sent in batches of the size they specify. Previous per-account sent logs were archived under `archive/send-history-2026-11-16-fresh-start/`; do not use those archived logs to suppress contacts in the new campaign. Continue to use the new per-account sent logs to avoid repeat sends within this campaign. The source workbook's Review/Skip flags remain in the prepared JSON for user review. Follow the pre-send checks and explicit confirmation rule above for every live batch.
