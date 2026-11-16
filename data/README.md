# Email outreach data and workflow

This folder holds the master contact workbook, batches awaiting review, and JSON files selected for sending. The sender runs from the **project root**:

```bash
cd /Users/pooniya0092/Documents/p_project/ColdOutrichAutoEmail
```

The campaign started with fresh send logs in November 2026. Work through the 773 contacts in batches of the requested size, such as 50 or 100. Review each batch before making it active. Preparing or previewing a batch does not send email.

## Folder layout

```text
ColdOutrichAutoEmail/
├── data/
│   ├── README.md
│   ├── upcoming/
│   │   └── master_email_list.xlsx     # Source workbook; Master Contacts sheet
│   ├── upcoming_json/
│   │   └── master-first-50.json      # First 50 source rows, for review
│   ├── email_json/
│   │   └── emails.json               # Active queue folder; currently examples
│   └── HR_Contacts.xlsx              # Separate Excel-format queue
├── resume/                           # PDFs attached to emails
├── attachment-categories.json        # Category mapping used by Excel queue
├── sent.log                          # Account 0 history, created after a send
├── sent.1.log                        # Account 1 history, created after a send
└── archive/send-history-2026-11-16-fresh-start/  # Previous campaign logs
```

**`data/email_json/emails.json` is the combined 773-contact queue.** The sender loads every `.json` file in that folder in filename order. Keep duplicate copies elsewhere. Review recipients and content before sending; `upcoming_json` contains the preserved source batches.

## Flow

1. **Source:** Open `data/upcoming/master_email_list.xlsx` and use the **Master Contacts** sheet. It contains one row per contact, suggested subjects and bodies, and review information. The workbook is the source, not the active send queue.
2. **Prepare a batch:** Copy the chosen contact rows into a JSON file under `data/upcoming_json/`, using the format below. `ok_master-000-050.json` contains the first 50 rows of Master Contacts in sheet order. The remaining source rows are already prepared as `master-050-100.json` through `master-750-773.json` in the same folder. Ranges use zero-based positions with the end excluded: `050-100` means contacts 51–100. Each full file contains 50 contacts; the last contains 23. Batch sizes for sending are your choice. There is no command to automatically prepare batches from a changed master workbook.
3. **Review:** Check each address, name, subject, complete message, attachment, source decision and review note. Check Gmail history when appropriate: the master workbook does not confirm whether Mahendra has previously contacted these people. The first 50 contain 40 source rows marked Ready, seven Review and three Skip; the latter 10 have `manual_skip: true`. Change a disabled entry to `false` only after reviewing it.
4. **Activate:** The combined queue is already in `data/email_json/`. Review it before sending; leave review/skip entries disabled until verified.
5. **Check:** Run the stats and preview commands below. Read the preview and resolve any reported errors before sending.
6. **Send:** After reviewing and explicitly confirming the intended batch, run the live command with your chosen run cap and daily cap. The script sends in queue order, uses a delay between recipients, and records successful sends in the selected account's sent log.
7. **Continue:** Prepare and review the next batch. The JSON sent markers and all account logs prevent repeating an address already sent from any campaign account. Daily caps remain per account.

The prepared first batch uses the source workbook's suggested subject and body. Its resumes were chosen by role bucket for review: React / UI and Commerce use the frontend resume, while General SDE and Full Stack use the software-developer resume. The workbook itself lists a different generic resume filename; confirm that the chosen PDF is suitable for each person.

## JSON file format

Each file must be valid JSON with an `emails` array. Example addresses below are fictional:

```json
{
  "emails": [
    {
      "name": "Asha Sharma",
      "email": "asha.sharma@example.com",
      "company": "Example Technologies",
      "category": "frontend development",
      "subject": "Frontend Developer Opportunities at Example Technologies",
      "message": [
        "Hello Asha,",
        "I’m interested in frontend developer opportunities at Example Technologies.",
        "I’ve attached my resume for your review.",
        "Best regards,\nMahendra Singh Puniya"
      ],
      "resume": "resume/mahendra_resumeA.pdf",
      "reply_to": "mahendrapuniya92@gmail.com",
      "manual_skip": false
    }
  ]
}
```

- `email`: recipient address. `name` and `company` are useful for review and for `{first_name}`, `{full_name}`, and `{company}` placeholders.
- `subject`: subject line; it must not be empty.
- `message`: an array of strings. Nonempty entries are joined in order with a blank line. Include the greeting and sign-off here. At least one nonempty entry is needed.
- `resume`: optional file path, relative to the **project root** or absolute. The file must exist. A JSON entry's `resume` takes precedence over its category mapping. Leave it out or blank and supply a configured `category` to select a shared resume; leave both blank for no attachment.
- `category`: optional category name. When `resume` is blank, the sender looks it up in `attachment-categories.json`; matching ignores case.
- `reply_to`: optional reply address. When blank or omitted, it defaults to `mahendrapuniya92@gmail.com`. The selected Gmail account remains the sender.
- `manual_skip`: use JSON boolean `true` to disable an entry; use `false` or omit it to allow the entry into the queue. Do not write the string `"false"`, because a nonempty string is treated as enabled skipping.
- `review`: optional notes in the prepared file, including source decision and lead ID. The sender does not interpret these notes; `manual_skip` controls exclusion.

Add more entries to the same `emails` array, separated by commas. Do not put Gmail passwords or app passwords in JSON. Malformed JSON, a missing `emails` array, or a message that is not an array of strings stops the command. Missing subject, missing message, invalid email, invalid reply address, and missing attachment are reported during rendering and the affected entry is skipped. An unresolved category also causes an error. Stats is a filtering count and does not validate every message or attachment: use preview for that.

## Resume files

| Category               | Project-relative PDF          |
| ---------------------- | ----------------------------- |
| `frontend development` | `resume/mahendra_resumeA.pdf` |
| `software developer`   | `resume/mahendra_resumeB.pdf` |
| `android developer`    | `resume/mahendra_resumeC.pdf` |
| `freelancing work`     | `resume/mahendra_resumeD.pdf` |
| `ai developer`         | `resume/mahendra_resumeE.pdf` |

Change the PDF path in an individual JSON entry to choose a different attachment for that recipient. If relying on category lookup, edit the category's path in `attachment-categories.json`. Always preview after a change.

## Preview and counts

From the project root:

```bash
# Check the current folder that would be sent
npm run stats -- --json data/email_json
npm run preview -- --json data/email_json --count 50

# Review the prepared batch without moving it
npm run stats -- --json data/upcoming_json/master-first-50.json
npm run preview -- --json data/upcoming_json/master-first-50.json --count 50
```

The preview shows the subject, full body, reply address and resolved attachment path for ready entries. It ignores entries marked `manual_skip`, entries marked sent, and addresses found in campaign account logs. The `--count` limit applies to ready entries; increase it for a larger batch. Stats and preview consult all numbered account logs for the selected campaign.

You can also test the send path without sending:

```bash
npm run send -- --json data/email_json --dry-run --cap 50 --daily-cap 50 --template T1_NAMED_PERSON --delay 0 --jitter 0
```

Dry runs do not send or append to the sent log. `--delay 0 --jitter 0` here is for a quick dry run; omit them for normal live pacing.

## Live batches

After checking the queue and confirming a specific batch, for example 50 recipients:

```bash
npm run send -- --json data/email_json --live --cap 50 --daily-cap 50 --template T1_NAMED_PERSON
```

- `--live` is required to send; without it the command defaults to dry-run.
- `--cap` is the maximum number of successful recipient sends in this run. `--daily-cap` is the selected account's maximum successful recipient sends for the local calendar day, including earlier runs. Set both to the requested batch size unless another daily cap was specified. If some were sent earlier today, fewer than the run cap may be sent.
- All JSON entries are treated as `T1_NAMED_PERSON`, so the standard template filter includes them.
- The normal delay is 45 seconds plus 0–15 seconds of random jitter between sends. A batch of 50 takes roughly 43 minutes; batches above about 40 may increase personal Gmail deliverability risk.
- Before each account's live batch, the script attempts one proof copy to `mahendrapuniya92@gmail.com` with the first recipient's subject, body and attachment. It continues even if the proof fails. Proof copies are not counted in the recipient cap or sent log.
- Press **Ctrl+C once** to stop after the current email. Review the final summary and errors. A failed recipient is not written to the sent log and can be tried in a later run.
- Sending through Codex follows the user's pre-send stats and explicit confirmation instructions; preparing and previewing do not authorize a live send.

## Accounts and tracking

Account 0 uses `GMAIL_USER`, `GMAIL_APP_PASSWORD`, and `FROM_NAME` from `.env`, and writes to `sent.log`. Account 1 uses the corresponding `GMAIL_USER2`, `GMAIL_APP_PASSWORD2`, and `FROM_NAME2` settings, and writes to `sent.1.log`. To use account 1, add `--account 1` to the live or dry-run send command.

Logs contain successful recipient sends as timestamp and email. They are created automatically after the first successful live send. Keep them for the life of this campaign: removing a log makes its addresses eligible again and resets its recorded daily count. The old campaign logs in `archive/send-history-2026-11-16-fresh-start/` are retained for reference and are not used by default.

**Cross-account behavior:** all sends, previews, and stats consult all account logs and JSON sent markers. Daily limits use only the selected account's log. After SMTP accepts a message, its JSON entry is also marked `sent: true` with time and account. Avoid concurrent send processes and queue edits during a run. Check Gmail Sent for an uncertain interruption between SMTP acceptance and recording; failed attempts are reported in the terminal and remain eligible for retry.

## Excel queue and older paths

`data/HR_Contacts.xlsx` is a separate queue format with `Active_Queue` and `Templates` sheets. The current CLI's default Excel path still points to `./excel/HR_Contacts.xlsx`, so explicitly pass the current path when using Excel:

```bash
npm run stats -- --file data/HR_Contacts.xlsx
npm run preview -- --file data/HR_Contacts.xlsx --count 50
```

The JSON workflow uses `--json data/email_json`; it does not read `HR_Contacts.xlsx`. Some older project documents and scripts refer to `excel/` or a different machine's paths; use the paths in this guide for the current folder layout. The cron wrapper has old machine-specific paths and should be updated and checked before use.

## Troubleshooting

- **No emails ready:** check `manual_skip`, the selected sent log, and whether the intended file is actually in `data/email_json`.
- **Unknown category / missing attachment:** correct the JSON `resume` path or category mapping, ensure the PDF exists, and run preview again from the project root.
- **Invalid JSON:** check commas, double quotes, brackets, and the `emails` array. Preview reports the file error.
- **Missing credentials or Gmail login error:** check the chosen account's `.env` settings and Gmail app password; do not put credentials in the queue file.
- **Fewer than the cap sent:** the queue may be exhausted, entries may be skipped or invalid, or the account's daily cap may already have been reached. Check the summary and errors.
- **Unexpected recipients:** inspect the contents of `data/email_json` and the preview before sending.

### Choose one JSON file and another account

To use a particular file instead of the default `data/email_json` folder, add `--json` with the file path. For example, check a reviewed batch against account 1's log and then preview it:

```bash
npm run mail:stats -- --json data/upcoming_json/master-050-100.json --sent-log sent.1.log
npm run mail:preview -- --json data/upcoming_json/master-050-100.json --sent-log sent.1.log --count 50
```

After review and confirmation, send from that account with `npm run mail:send -- --json data/upcoming_json/master-050-100.json --account 1 --live --cap 50 --daily-cap 50`. The shortcuts accept the explicit `--json` path in place of their default directory. All campaign account logs are checked to prevent cross-account duplicates. See the root `SEND_EMAILS.md` for proof-only and account examples.

## Reset the campaign

Use `npm run mail:reset` to preview, then `npm run mail:reset -- --confirm-reset` to archive the active queue and account logs and clear their sent state. This also resets recorded daily counts and makes previously sent addresses eligible again. Stop all send processes first. Review flags and the source batches remain unchanged. See the root `SEND_EMAILS.md` for the full reset procedure and backup location.
