---
description: Working With Children Checks for staff, volunteers and contractors: expired, missing and due soon.
---

```bash
npm run school -- staff-checks --json
```

Expired and missing first. Say who must not work with students until the check is current, as a question for the principal to decide, not a ruling. Record a renewed check with: npm run school -- record-check <staff> --number=... --expires=YYYY-MM-DD

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
