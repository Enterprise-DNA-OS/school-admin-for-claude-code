# School Admin for Claude Code: operating instructions

This file is the brain. Claude Code reads it at the start of every session. It says who this is for, how work gets done, and the one right way to do each recurring job.

## Who this is for

- **School:** [YOUR SCHOOL]
- **Operator:** [YOUR NAME], [business manager, bursar, registrar or front office]
- **What matters most:** [for example: every child-safety check current, fees under 30 days, next year's Year 7 full]

Fill this in once. A worker with context knows. A worker without it guesses.

## How to work

1. **Take a brief, not a script.** The operator describes the outcome. You run the right command and present the answer.
2. **Read before you write.** Before drafting anything about a family or student, open `/family` or `/student` first.
3. **Plain language.** Short sentences. Numbers in tables. Codes beside names.
4. **Silent success, loud problems.** No play-by-play. Say what broke and what you did about it.
5. **Stop at the line.** Anything that sends, deletes, bills or faces a family waits for a yes in this session.

## Routing table: one right way for each recurring job

| When the operator asks for... | Use this |
|---|---|
| the Monday review, "what do I need to know this week" | `/weekly-review` |
| everything that needs a person | `/attention` |
| child safety, compliance, "are we covered" | `/compliance` |
| term fees, the fee run, invoices | `/fee-run` (dry run first) |
| who owes money, debtors, overdue fees | `/debtors` |
| a payment came in | `/record-payment` |
| a fee reminder | `/draft-fee-reminder` |
| unexplained absences, absence follow-up | `/absences`, then `/draft-absence-letter` |
| a family explained an absence | `/explain-absence` |
| attendance rates, who is missing school | `/attendance` |
| Working With Children Checks | `/staff-checks` |
| anaphylaxis, asthma, medical, custody | `/care-plans` |
| excursions and consent forms | `/excursions` |
| enquiries, future students, open day follow-up | `/enquiries` |
| places next year, waitlist | `/waitlist` |
| move an enquiry, make an offer | `/move-enquiry`, `/draft-offer-letter` |
| a family accepted | `/enrol` |
| fundraising, appeals, donors | `/appeals` |
| look up a family or student | `/family`, `/student`, `/families`, `/students` |
| add any record | `/add` |
| bring records from Synergetic | `/import` |
| take everything out | `/export` |
| who changed something | `/activity` |
| change a field, stage, rule or fee | `/customise` |
| a new page to look at | `/new-view` |

If an ask fits nothing here, run the CLI directly (`npm run school -- help`) and then propose a new command for it.

## Hard rules

- Never send email or messages from here. Draft to `drafts/`, a person sends from the school's own email.
- Never take or charge money. `record-payment` records money already received.
- The fee run is always a dry run first, shown to the operator, then a real run on their yes.
- Never delete records without an explicit yes in this session. A student leaves (`status=left`); a family becomes past.
- Never invent a record. If a name is ambiguous, list the candidates and ask.
- Quote custody notes word for word. Never put medical or custody detail into a draft that goes to a family.
- Exports, drafts, documents and views hold private student records. Keep them private.
- The database is the source of truth. If the answer is not in it, say so.

## Where things live

- `scripts/school.mjs` the CLI. `scripts/lib/db.mjs` picks `DATABASE_URL` (Postgres, Supabase) or the embedded database in `.data/`.
- `supabase/migrations/` the schema and views, plain SQL. `npm run migrate` applies it.
- `.claude/commands/` the slash commands. Add one every time the same ask comes twice.
- `docs/compliance.md` the rules and their sources. `docs/operations.md` every command and field. `docs/replace-synergetic.md` the switching guide.

Built by Enterprise DNA. Installed and run for you as part of Omni: https://enterprisedna.co/omni/instead-of/synergetic
