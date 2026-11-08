---
description: Move a future student's enquiry to its next stage, with the next step and due date.
---

```bash
npm run school -- move-enquiry <enquiry> --stage=<enquiry|tour|applied|interview|offered|accepted|declined|withdrawn> --next-step="..." --due=YYYY-MM-DD [--offer-expires=YYYY-MM-DD] --actor="<operator>"
```

Confirm the stage and next step with the operator before running. An offer needs an acceptance date. Use /enrol, not this, when an accepted family confirms.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
