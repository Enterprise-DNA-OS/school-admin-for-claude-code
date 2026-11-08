---
description: Upcoming excursions with consent returned and outstanding, and the students still missing consent.
---

```bash
npm run school -- excursions --json
npm run school -- consent-gaps --json
```

Lead with excursions whose consent date has passed. Record a returned form with: npm run school -- record-consent <excursion> <student> --by="<parent>" [--status=declined]

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
