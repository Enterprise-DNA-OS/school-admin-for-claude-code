<h1 align="center">School Admin for Claude Code</h1>

<p align="center">
  <strong>The open-source school administration system that is just a database and Claude Code.</strong>
</p>

<p align="center">
  Created by <a href="https://www.enterprisedna.co"><strong>Enterprise DNA</strong></a>. Free and open source. Works with Claude Code, Codex, OpenCode or Cursor.
</p>

<!-- three-doors -->
<table align="center">
  <tr>
    <td align="center"><strong>Do it yourself</strong><br/>Clone it, run it, own it. Free, MIT.<br/><a href="#quick-start">Quick start</a></td>
    <td align="center"><strong>We customise it</strong><br/>Your fields, your rules, your Synergetic data brought across.<br/><a href="https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=synergetic">Book a call</a></td>
    <td align="center"><strong>We run it for you</strong><br/>Installed, connected and operated inside Omni. Setup fee, then a retainer.<br/><a href="https://enterprisedna.co/omni/instead-of/synergetic?utm_source=github&utm_medium=readme&utm_campaign=synergetic">How it works</a></td>
  </tr>
</table>

<p align="center">
  <a href="#what-is-this">What is this</a> &bull;
  <a href="#why-no-front-end">Why no front end</a> &bull;
  <a href="#quick-start">Quick start</a> &bull;
  <a href="#the-commands">Commands</a> &bull;
  <a href="#instead-of-synergetic">Instead of Synergetic</a> &bull;
  <a href="#want-it-installed-and-run-for-you">Installed for you</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node-20+-339933?style=flat-square" alt="Node 20+" />
  <img src="https://img.shields.io/badge/PostgreSQL-any-336791?style=flat-square" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/PGlite-embedded-3ecf8e?style=flat-square" alt="PGlite" />
  <img src="https://img.shields.io/badge/License-MIT-yellow?style=flat-square" alt="MIT License" />
</p>

---

## What is this

School Admin for Claude Code does the administration work an independent school pays Synergetic for, as a Postgres database and a set of agent commands: families and contacts, students, future student enquiries and waitlists, termly fee runs with sibling discounts, debtors, attendance follow-up, care alerts, Working With Children Checks, excursion consent and the development office. There is no web front end. You open the folder in [Claude Code](https://claude.com/claude-code) (or Codex, OpenCode, Cursor: see `AGENTS.md`) and ask in plain language.

Education Horizons quotes Synergetic privately and prices it by module. The only public figure is a review-site listing of "starting from US$5,000" per feature, which is not a quote or a school's invoice ([research](docs/research.md)). Bring your own bill to compare.

It is for the business manager, bursar, registrar and front office of an independent school. It covers the weekly admin; timetabling, academic reporting, the general ledger and payroll stay where they are.

Want the same thing with a roll-marking screen, a parent consent form, or built on a different stack? That is a customisation, and it is exactly what Enterprise DNA does: [book a call](https://enterprisedna.co/omni/book/?utm_source=github&utm_medium=readme&utm_campaign=synergetic).

## Why no front end

- The front end was only ever there because the database was hard to talk to. That is no longer true.
- Your records sit in plain Postgres tables you own. Any tool can read them. No lock-in.
- No per-module licence. Read [docs/why-no-front-end.md](docs/why-no-front-end.md) for what a screen still does better.

## Quick start

Sixty seconds, no database install (an embedded Postgres runs inside Node 20 or later):

```bash
git clone https://github.com/Enterprise-DNA-OS/school-admin-for-claude-code.git
cd school-admin-for-claude-code
npm install
npm run demo
npm run school -- weekly-review
```

Then open the folder in Claude Code and type `/weekly-review`.

The demo is Harbourside Grammar, a fictional school in New South Wales: five families, eight students, two terms of fees, and deliberately an expired Working With Children Check, an anaphylaxis plan overdue for review, unexplained absences past the 7-day window, a family 75 days behind, a lapsed offer and a sibling enquiry that has gone quiet. Seed only a disposable demo database.

### Use it with your own Postgres or Supabase

Copy `.env.example` to `.env`, set `DATABASE_URL`, then `npm run migrate`. Same commands, shared records.

## The weekly rituals

| Command | What it does |
|---|---|
| `/weekly-review` | the Monday review: child safety and care, attendance, fees, enrolments |
| `/attention` | everything that needs a person, in one list |
| `/compliance` | the rules in [docs/compliance.md](docs/compliance.md), checked against the records, with sources |
| `/fee-run` | the termly invoices with sibling discounts, dry run first, never double billed |
| `/debtors` | who owes what, aged by the oldest unpaid term, plans separated from quiet families |
| `/record-payment` | a payment received, applied to the oldest term first |
| `/absences` | unexplained absences, the ones past the window first |
| `/explain-absence` | record a family's explanation |
| `/attendance` | term attendance rates, lowest first |
| `/staff-checks` | Working With Children Checks: expired, missing, due soon |
| `/care-plans` | anaphylaxis and asthma plans missing or overdue, custody notes |
| `/excursions` | consent returned and outstanding for upcoming excursions |
| `/enquiries` | future students: lapsed offers, overdue next steps, quiet enquiries |
| `/waitlist` | places left by year group against confirmed students and offers out |
| `/move-enquiry`, `/enrol` | move an enquiry along; turn an accepted one into a student |
| `/appeals` | totals by appeal, recent gifts, lapsed donors |
| `/families`, `/family`, `/students`, `/student` | the community records |
| `/add` | add a family, contact, student, enquiry, staff member, excursion, care alert, gift, fee or plan |
| `/draft-fee-reminder`, `/draft-absence-letter`, `/draft-offer-letter` | drafts to `drafts/`, never sent |
| `/import`, `/export` | bring Synergetic records in; take everything out as CSV |
| `/activity` | who changed what |
| `/customise`, `/new-view` | change a field, a rule or a report in plain language |

43 CLI commands sit underneath: [docs/operations.md](docs/operations.md).

## Ten questions you can answer today

Each runs against the demo records now. No claim is made that Synergetic cannot answer them.

1. Which families are more than 60 days behind, and which of them are on a payment plan? `debtors`
2. Who is working with students on an expired or missing Working With Children Check? `staff-checks`
3. Which students with anaphylaxis have no action plan on file or an overdue review? `care`
4. Which absences have gone past the 7-day explanation window? `absences`
5. Which students are under 90% attendance this term? `attendance`
6. How many Year 7 places are left next year once offers out are counted? `waitlist`
7. Which offers have lapsed without an answer? `enquiries`
8. Which sibling enquiries from current families have gone quiet? `enquiries`
9. Who has not returned consent for an excursion this week? `consent-gaps`
10. Which donors gave last year and not since, and what have they given in total? `lapsed-donors`

## Instead of Synergetic

Extract families, contacts, students, staff checks, future students and debtor balances to CSV, then:

```bash
npm run school -- import synergetic --dir=imports/synergetic --dry-run
```

The dry run saves nothing. The real run is all or nothing, keeps every original row, skips unchanged repeats and stops on a changed one. The importer recognises Synergetic-style and plain column names; add your own headings in one place. Full guide, including what does not carry over: [docs/replace-synergetic.md](docs/replace-synergetic.md).

## Documents and views

Edit `brand.json` for your school's name, logo and colours. `npm run docs` writes fee statements (tuition shown as GST-free), absence explanation requests, offers of a place, gift receipts and care plan registers. `npm run view` writes the week, debtors and enrolments pages. They contain private records: keep them private.

## Your first hour: ten things to ask for

1. Put our school's name and colours on the fee statements.
2. Show me every family more than 30 days behind who is not on a plan.
3. Draft fee reminders for those families.
4. Who can't go on the Year 12 field trip without consent?
5. Change the sibling discount to 15% for the second child.
6. Our explanation window is 7 school days, not calendar days. Change the rule.
7. Add a uniform levy of $120 a year for Years 7 to 12.
8. Test our Synergetic extract without saving anything.
9. Add a page for the registrar: next year's places by year group and every open enquiry.
10. Add a field for a student's previous school, with a tested migration.

`/customise` writes and tests a numbered migration. `/new-view` adds a read-only page.

## Architecture

```
school-admin-for-claude-code/
  CLAUDE.md                 how the school wants this run (routing table + house rules)
  AGENTS.md                 the same, for Codex / OpenCode / Cursor / Gemini CLI
  .claude/commands/         the slash commands
  scripts/school.mjs        the CLI the commands drive
  scripts/lib/db.mjs        one adapter: DATABASE_URL (pg) or embedded PGlite
  supabase/migrations/      plain SQL schema and views
  supabase/seed.sql         the Harbourside Grammar demo
  fixtures/synergetic/      a fictional Synergetic extract for the importer
  documents.json, views.json  the paperwork and the pages
  docs/                     compliance sources, operations, the switching guide
```

## Verification

`npm test` runs every CLI command against a temporary database and checks ageing, sibling discounts, fee run idempotence, attendance windows, every compliance rule, enrolment, import rollback and repeats, export, drafts and rendering. The manual GitHub workflow runs it on Linux and Windows, Node 20 and 22, and on Postgres 17.

## Contributing

Issues and pull requests are welcome. Keep the shape: plain SQL, a small CLI, a slash command per recurring job, no front end.

## Want it installed and run for you?

Enterprise DNA installs School Admin for your school, maps your Synergetic records, connects it to your learning platform, payments and email, builds the screens your staff need, and runs it for you as part of **Omni**, our managed Command Centre. One setup fee, then a monthly retainer.

- Book a call: [enterprisedna.co/omni/book](https://enterprisedna.co/omni/book/?offer=replace-software&utm_source=github&utm_medium=readme&utm_campaign=synergetic)
- Read more: [enterprisedna.co/omni/instead-of/synergetic](https://enterprisedna.co/omni/instead-of/synergetic?utm_source=github&utm_medium=readme&utm_campaign=synergetic)

## License

MIT. Copyright (c) 2026 Enterprise DNA. Not affiliated with Education Horizons or Anthropic. Hosting and agent usage have their own costs.
