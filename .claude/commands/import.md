---
description: Bring records across from Synergetic: families, contacts, students, staff checks, future students and debtor balances. Always a dry run first.
---

```bash
npm run school -- import synergetic --dir=<folder of CSVs> --source=synergetic-<date> --dry-run
npm run school -- import synergetic --dir=<folder of CSVs> --source=synergetic-<date> --actor="<operator>"
```

Read docs/replace-synergetic.md first. Check the CSV headings against IMPORT_COLUMNS in scripts/school.mjs and add the school's own headings there if they differ. Show the dry-run counts and wait for a yes. A failed row rolls back the whole batch. A repeat of an unchanged row is skipped, a changed one stops the import.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
