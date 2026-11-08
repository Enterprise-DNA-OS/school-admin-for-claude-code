---
description: Turn an accepted enquiry into a future student, joining a sibling's family or creating a new family.
---

```bash
npm run school -- enrol <enquiry> [--family=<family code>] [--entry-date=YYYY-MM-DD] --actor="<operator>"
```

Only accepted enquiries can be enrolled. If the parent may already be a current family under another name, check /families first and pass --family. Report the new student code and family.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
