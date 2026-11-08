---
description: Record a payment received against a family account. It clears the oldest term first.
---

```bash
npm run school -- record-payment <family> --amount=<dollars> --date=YYYY-MM-DD --method="bank transfer" --ref="<reference>" --actor="<operator>"
```

Read the amount and reference back before running. This records money already received. It never charges a card or pulls a direct debit. Show the new balance after.

Every answer starts from the CLI output. Use the record codes it prints. Never answer about a family, student or staff member from memory, and never invent a record. If a name matches more than one record, show the candidates and ask.
