# Prompt: Prepare an email outreach JSON file

Copy the prompt below and provide it to your AI together with the source contacts and any instructions for the email content. Replace the bracketed sections with your details. This prompt prepares a reviewable file; it does not authorize sending email.

---

You are preparing a JSON queue for my existing cold outreach sender. Convert the contact data I provide into the exact structure below. The sender will read the file later; do not send emails, change Gmail, modify sent logs, or activate the queue.

## My instructions

- **Source data or file:** [Provide or attach the source data or its accessible file path. If it is a workbook, name the sheet.]
- **Contacts to include:** [For example, all rows or contacts 1–50 in source order.]
- **Purpose and style:** [For example, frontend job applications; concise, professional, plain text.]
- **Message content:** [Provide approved messages, source columns, or factual information to use.]
- **Output filename:** [For example, `data/upcoming_json/new-contacts.json`.]
- **Additional instructions:** [Optional.]

If essential information is missing, state what is missing. Do not invent contact details, professional experience, job openings, company facts, attachment names, or an approval to send.

## Output structure

Return one valid UTF-8 JSON object with an `emails` array. Each element represents one recipient:

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
      "manual_skip": false,
      "review": {
        "source_decision": "Ready",
        "reason": "",
        "source_reference": "Example row 1"
      },
      "sent": false
    },
    {
      "name": "Rohan Mehta",
      "email": "rohan.mehta@example.com",
      "company": "Example Mobile",
      "category": "android developer",
      "subject": "Android Developer Opportunities at Example Mobile",
      "message": [
        "Hello Rohan,",
        "I’m interested in Android developer opportunities at Example Mobile.",
        "I’ve attached my resume for your review.",
        "Best regards,\nMahendra Singh Puniya"
      ],
      "resume": "resume/mahendra_resumeC.pdf",
      "manual_skip": false,
      "sent": false
    }
  ]
}
```

These recipients and companies are fictional examples. Do not include them in the output unless they are explicitly present in my source data.

## Field rules

- `name`: recipient's name from the source. Use an empty string if unavailable; do not guess.
- `email`: recipient email from the source, trimmed. It is required for sending. Do not fabricate one.
- `company`: source company name, or an empty string when unknown.
- `category`: use a supported category when the role is clear. The sender uses this to look up an attachment when `resume` is blank.
- `subject`: complete, nonempty subject for this recipient. Use my approved subject or source suggestion when supplied.
- `message`: an array of strings, ordered as greeting, paragraphs, and closing. The sender joins nonempty items with blank lines. Keep approved or source wording intact unless I request changes. Use at least one nonempty item.
- `resume`: optional project-relative path or absolute path to the intended attachment. An explicit `resume` takes priority over the category mapping. If neither is supplied, no file is attached. Do not invent file paths; if unsure, mark the entry for review.
- `reply_to`: optional reply email. If omitted or empty, the sender defaults to `mahendrapuniya92@gmail.com`. It does not choose the sending account.
- `manual_skip`: JSON boolean, not a string. Set to `true` for source rows marked Review or Skip, missing/invalid information, uncertain resume selection, or anything else requiring my decision. Include a reason in `review`. Set to `false` only when the row is ready according to the supplied instructions and source; this is not permission to send.
- `review`: optional object for source identifiers, source decision, review reason, and verification notes. It is informational: the sender does not enforce it. Use `manual_skip: true` to prevent a row from being sent until reviewed.
- `sent`: for a newly prepared contact with no confirmed campaign send, use `false` or omit it. Never assume that an email was sent from draft status, historical data, or missing information. Preserve existing `sent`, `sent_at`, and `sent_account` fields when updating an existing campaign queue; do not reset them or alter send logs. The sender sets these after SMTP accepts a message. SMTP acceptance is not proof of delivery.

## Resume categories

The following paths are relative to the project root:

| Category | Resume path |
| --- | --- |
| `frontend development` | `resume/mahendra_resumeA.pdf` |
| `software developer` | `resume/mahendra_resumeB.pdf` |
| `android developer` | `resume/mahendra_resumeC.pdf` |
| `freelancing work` | `resume/mahendra_resumeD.pdf` |
| `ai developer` | `resume/mahendra_resumeE.pdf` |

Select a category and resume only when supported by the source or my instructions. If making a reasonable role-based selection, record that it needs review and set `manual_skip: true` unless I explicitly approve the selection rule. If file access is available, confirm the selected files exist. An entry's explicit `resume` path overrides the category mapping.

## Preparation and checks

1. Preserve the requested source order and include the requested rows. Do not silently omit review/skip rows: carry them with `manual_skip: true` and explain why. Flag missing addresses or messages for correction.
2. Check email addresses for basic formatting and duplicates, case-insensitively. Report duplicates and keep source information for review rather than inventing replacements. The sender skips duplicate addresses within a loaded queue and previously sent addresses found in campaign logs.
3. Do not claim to have verified Gmail history, delivery, a company, or a role unless you actually have evidence. Preserve source review decisions and mention unverified history.
4. Validate that the final file parses as JSON, has one top-level `emails` array, and that every `message` is an array of strings. Use proper double quotes, commas, and JSON booleans.
5. When you have filesystem access, create a new file in `data/upcoming_json/` by default. Do not overwrite existing files without checking. Do not put a draft in `data/email_json/` or modify the active queue. If file access is unavailable, return only the JSON in a fenced `json` block, followed by a short separate review summary.
6. Report the total number of entries, how many are marked for review, missing/invalid fields, duplicate addresses, and whether attachment paths were verified. Explain any assumptions. Do not send email.

The user will review the result and choose whether to add it to the active queue. The sender's complete workflow is documented in `SEND_EMAILS.md` and `data/README.md`.
