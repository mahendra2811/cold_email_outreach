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

**The current `data/email_json/emails.json` contains fictional examples.** Before a live batch, remove or move that example file and place only the approved JSON file or files in `data/email_json/`. The sender loads every `.json` file in that folder, in filename order. Selecting a folder does not automatically select `upcoming_json`.

## Flow

1. **Source:** Open `data/upcoming/master_email_list.xlsx` and use the **Master Contacts** sheet. It contains one row per contact, suggested subjects and bodies, and review information. The workbook is the source, not the active send queue.
2. **Prepare a batch:** Copy the chosen contact rows into a JSON file under `data/upcoming_json/`, using the format below. `master-first-50.json` contains the first 50 rows of Master Contacts in sheet order. Batch sizes are your choice. At present there is **no command that automatically creates the next batch**; it must be prepared before use.
3. **Review:** Check each address, name, subject, complete message, attachment, source decision and review note. Check Gmail history when appropriate: the master workbook does not confirm whether Mahendra has previously contacted these people. The first 50 contain 40 source rows marked Ready, seven Review and three Skip; the latter 10 have `manual_skip: true`. Change a disabled entry to `false` only after reviewing it.
4. **Activate:** Move or copy the reviewed batch into `data/email_json/`, first moving out the fictional examples and any other files you do not intend to send. Keep a review copy if useful.
5. **Check:** Run the stats and preview commands below. Read the preview and resolve any reported errors before sending.
6. **Send:** After reviewing and explicitly confirming the intended batch, run the live command with your chosen run cap and daily cap. The script sends in queue order, uses a delay between recipients, and records successful sends in the selected account's sent log.
7. **Continue:** Prepare and review the next batch. Existing logs prevent repeating an address already sent **from the selected account** in this campaign. See the account section below for cross-account limits.

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

| Category | Project-relative PDF |
| --- | --- |
| `frontend development` | `resume/mahendra_resumeA.pdf` |
| `software developer` | `resume/mahendra_resumeB.pdf` |
| `android developer` | `resume/mahendra_resumeC.pdf` |
| `freelancing work` | `resume/mahendra_resumeD.pdf` |
| `ai developer` | `resume/mahendra_resumeE.pdf` |

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

The preview shows the subject, full body, reply address and resolved attachment path for ready entries. It ignores entries marked `manual_skip` and addresses found in the specified sent log. The `--count` limit applies to ready entries; increase it for a larger batch. Stats and preview use `sent.log` by default. To inspect account 1's history, add `--sent-log sent.1.log` to either command.

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

**Cross-account behavior:** a run using only `--account 0` checks account 0's log; a run using only `--account 1` checks account 1's log. It does not automatically check the other account's log. A run with `--rotate` checks both active account logs and can switch accounts when its per-account daily cap is reached. Review both logs when changing accounts to avoid duplicate contacts. Duplicate addresses in the same loaded queue are also filtered.

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
- **Unexpected fictional recipients:** remove or move `data/email_json/emails.json` before activating a real batch.
