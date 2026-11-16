# Resume folder

The sender selects a PDF from this folder using the `category` column in the Excel `Active_Queue` sheet:

| Category | Resume |
| --- | --- |
| frontend development | `mahendra_resumeA.pdf` |
| software developer (full stack) | `mahendra_resumeB.pdf` |
| android developer (mobile) | `mahendra_resumeC.pdf` |
| freelancing work | `mahendra_resumeD.pdf` |
| ai developer | `mahendra_resumeE.pdf` |

Use the category names in the first column, without the descriptions in parentheses. The mapping is configured in the project's `attachment-categories.json`. To replace a resume, update the PDF with the same filename, or update the path in that configuration file. Run `npm run preview` from the project folder to check the attachment before sending.
