# Sending emails from JSON

Run these commands from the project folder:

```bash
cd /Users/pooniya0092/Documents/p_project/ColdOutrichAutoEmail
```

The shortcuts read every `.json` file in `data/email_json/`. Put only reviewed batches there. Move out the fictional `emails.json` example before placing a real batch in the folder. Files in `data/upcoming_json/` are for review and are not sent unless moved or copied into `data/email_json/`.

## 1. Check the queue

```bash
npm run mail:stats
npm run mail:preview -- --count 50
```

Stats shows total rows, already sent, manually skipped, and ready. Preview displays each ready recipient's subject, full message, reply address, and attachment. Increase `--count` to review more entries. Stats does not check every attachment; use preview too.

These commands check `sent.log` for account 0. For account 1, add `--sent-log sent.1.log`; for account 2, use `--sent-log sent.2.log`. Review both accounts' logs before switching accounts: a single-account send only checks that account's log.

## 2. Send a proof copy only

```bash
npm run mail:proof -- --live
```

This sends the **first ready email only** to `mahendrapuniya92@gmail.com`, with a `[PROOF]` subject prefix and its attachment. It does not send to the recipient or record the recipient as sent. The first account is used by default; append `--account 1` or `--account 2` to choose another configured account. The account must have capacity under its daily cap, although proof copies themselves are not counted in the sent log or daily recipient cap.

Without `--live`, this command is a dry run and no proof email is sent. If no ready rows remain, there is no proof to send. To change the proof address, edit `proofEmail` in `src/config.js`. **That value is also the default Reply-To address** for rows that do not specify `reply_to`.

A live batch separately attempts a proof copy before sending the recipients, even if you already sent a proof-only email. If that automatic proof fails, the batch currently continues and reports a warning.

## 3. Send the batch

For a requested batch of 50 on account 0, after checking stats, previewing and confirming the batch:

```bash
npm run mail:send -- --live --cap 50 --daily-cap 50
```

For a different amount, replace **both** numbers with the requested number. `--cap` limits successful recipient sends in this run; `--daily-cap` limits the account's successful recipient sends for the current local day, including earlier batches. If the account already sent emails today, the daily cap can stop this run early. The command uses the `T1_NAMED_PERSON` filter for the JSON queue.

With no options, `npm run mail:send` is a **dry run**: it sends nothing and defaults to a run cap of 10 and daily cap of 100. Include `--live` only when ready to send. To try a quick dry run with no waiting:

```bash
npm run mail:send -- --dry-run --cap 50 --daily-cap 50 --delay 0 --jitter 0
```

The CLI runs in the foreground. Press **Ctrl+C once** to stop after the current email. Check the summary for successful sends and errors. Failed entries are not recorded as sent and may be tried later.

## Account selection

| Account | Option | Credentials in `.env` | Sent log |
| --- | --- | --- | --- |
| First | `--account 0` (default) | `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `FROM_NAME` | `sent.log` |
| Second | `--account 1` | `GMAIL_USER2`, `GMAIL_APP_PASSWORD2`, `FROM_NAME2` | `sent.1.log` |
| Third | `--account 2` | `GMAIL_USER3`, `GMAIL_APP_PASSWORD3`, `FROM_NAME3` | `sent.2.log` |

Add the appropriate credentials to `.env` before using an account; never put passwords in JSON. For example, send 50 from the second account:

```bash
npm run mail:send -- --live --account 1 --cap 50 --daily-cap 50
```

`--rotate` currently rotates between accounts 0 and 1 only; it is not a three-account rotation. For ordinary single-account runs, the sender checks only the selected account's log. Preserve logs to prevent repeat sends and keep daily counts accurate. Previous campaign logs are archived in `archive/send-history-2026-11-16-fresh-start/` and are not used by default.

## Change timing

By default the sender waits **45 seconds plus a random 0–15 seconds** between emails. Change both values in seconds if needed:

```bash
npm run mail:send -- --live --cap 50 --daily-cap 50 --delay 60 --jitter 20
```

That example waits between 60 and 80 seconds between emails. With default pacing, 50 emails take roughly 43 minutes. More than about 40 emails in one batch may increase deliverability risk on personal Gmail accounts.

## Prepare and review new batches

The source is `data/upcoming/master_email_list.xlsx`, on the **Master Contacts** sheet. The first 50 are in `data/upcoming_json/master-first-50.json`; the 10 source rows marked Review or Skip have `manual_skip: true`. Review Gmail history, content, addresses and resume selection before making a batch active. `manual_skip: true` excludes an entry; change it to the JSON boolean `false` only after review. The remaining contacts are prepared as files `master-050-100.json` through `master-750-773.json` in `data/upcoming_json/`. Each file needs review before activation; there is no command to automatically rebuild batches from an updated master workbook.

For the JSON format, resume mapping, troubleshooting, and full data flow, see [data/README.md](data/README.md).

## Select a different JSON file and account

You do not need to replace `data/email_json/emails.json`. Add `--json` with the exact file you want. The file can be in `data/upcoming_json/` or another folder. Review it first: files in `upcoming_json` are prepared for review and are not automatically approved. The last `--json` option overrides the shortcut's default folder.

For example, to review `master-050-100.json` against **account 1's** sent history:

```bash
npm run mail:stats -- --json data/upcoming_json/master-050-100.json --sent-log sent.1.log
npm run mail:preview -- --json data/upcoming_json/master-050-100.json --sent-log sent.1.log --count 50
```

After reviewing the batch, optionally send a proof from account 1:

```bash
npm run mail:proof -- --json data/upcoming_json/master-050-100.json --account 1 --live
```

After the batch is reviewed and confirmed, send up to 50 from account 1:

```bash
npm run mail:send -- --json data/upcoming_json/master-050-100.json --account 1 --live --cap 50 --daily-cap 50
```

For another batch, change the filename. For the first or third configured account, change the account to `0` or `2`, and use `sent.log` or `sent.2.log` for its stats and preview. Each account has a separate sent log; single-account runs do not consult the other logs, so check the other account's history before switching to avoid sending the same address twice. Disabled rows are still skipped, so a 50-row file can send fewer than 50 emails.
