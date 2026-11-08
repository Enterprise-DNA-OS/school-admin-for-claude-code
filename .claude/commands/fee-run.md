---
description: The termly fee run: one invoice per current family with sibling discounts on tuition. Always a dry run first.
---

```bash
npm run school -- fee-run --period=<YYYY-Tn> --issued=YYYY-MM-DD --dry-run --json
npm run school -- fee-run --period=<YYYY-Tn> --issued=YYYY-MM-DD --actor="<operator>"
```

Run the dry run, show the bursar each family's total and the sibling discounts, and wait for a yes in this session before the real run. A family already invoiced for the period is skipped, so a second run never double bills. This records invoices. It does not email them or take payment.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
