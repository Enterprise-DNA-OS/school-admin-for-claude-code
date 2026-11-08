---
description: Add a family, contact, student, enquiry, staff member, excursion, care alert, gift, fee item or payment plan.
---

```bash
npm run school -- add <family|contact|student|enquiry|staff|excursion|care|gift|fee|plan> --field=value ... --actor="<operator>"
```

Fields per kind are in docs/operations.md. References take a code or a unique name (--family=FAM-003). Money is in dollars (--amount=250). Read the record back after adding.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
