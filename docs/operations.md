# Operations: every command

Run any command with `npm run school -- <command>`. Add `--json` for machine output. Names match by code, the start of an id, or any part of the name, ignoring case; when more than one record matches, the command lists them and exits 1. Every write takes `--actor="Your name"` and is recorded in `audit`.

## Reads

| Command | What it shows |
|---|---|
| `families` | every family, enrolled children and balance |
| `family <name>` | one family: contacts, children, balance and ageing, unpaid terms, payments, plans |
| `students` | students by status and year level |
| `student <name>` | one student: family, care alerts, term attendance, absences, consents |
| `enquiries` | open enquiries with their issue (offer lapsed, next step overdue, gone quiet, no next step) |
| `pipeline` | enquiry counts by entry year, year level and stage |
| `waitlist` | places by year group against confirmed, offers out, pipeline and siblings waiting |
| `fees` | the fee schedule |
| `invoices` | every invoice with its total and what is still outstanding |
| `payments` | payments received, newest first |
| `payment-plans` | agreed payment plans |
| `debtors` | families with overdue fees, aged 1-30, 31-60, 61-90 and 90+ days |
| `absences` | unexplained absences, late arrivals and partial days |
| `attendance` | term attendance rate per student, lowest first |
| `care` | care alerts and the plans missing or due for review |
| `staff-checks` | Working With Children Checks by status |
| `excursions` | upcoming excursions with consent counts |
| `consent-gaps` | students without consent for an upcoming excursion |
| `gifts`, `appeals`, `lapsed-donors` | the development office |
| `attention` | everything above that needs a person, in one list |
| `compliance` | the rules in docs/compliance.md checked against the records |
| `weekly-review` | compliance, debtors, absences past the window, enrolment issues and the waitlist |
| `settings` | the school's operating settings |
| `activity`, `import-history` | the audit trail and imported rows |

## Writes

| Command | Required | Optional |
|---|---|---|
| `add family` | `--name` | `--code --billing_email --phone --address --status --payment_terms_days` |
| `add contact` | `--family --name` | `--relationship --email --phone --receives_billing --lives_with_student` |
| `add student` | `--family --name --year_level` | `--code --date_of_birth --house --status --entry_date` |
| `add enquiry` | `--child_name --parent_name --entry_year --entry_level` | `--email --phone --stage --sibling_family --source --next_step --next_step_due` |
| `add staff` | `--name --role --jurisdiction --check_type` | `--kind --check_number --check_expires` |
| `add excursion` | `--name --on_date --year_level` | `--staff_lead --consent_due` |
| `add care` | `--student --kind --detail` | `--action_plan_on --review_due` (kind: anaphylaxis, asthma, medical, custody, learning, other) |
| `add gift` | `--donor_name --appeal --amount --received_on` | `--family --receipt_number --tax_deductible` |
| `add fee` | `--name --category --amount` | `--year_from --year_to --per --basis --gst_free` |
| `add plan` | `--family --instalment --frequency --starts_on` | `--note` |
| `move-enquiry <enquiry>` | `--stage` | `--next-step --due --contacted`; `--offer-expires` when offered |
| `enrol <enquiry>` | an accepted enquiry | `--family --family-name --entry-date` |
| `mark-absence <student>` |  | `--date --status --reason` |
| `explain-absence <student>` | `--date --reason --by` | `--on` |
| `record-payment <family>` | `--amount` | `--date --method --ref --code` |
| `fee-run` | `--period` | `--issued --dry-run` |
| `record-check <staff>` | `--number --expires` |  |
| `record-consent <excursion> <student>` | `--by` | `--status --on` |
| `set <key> <value>` | a known setting |  |

Money is entered in dollars (`--amount=1250.50`) and stored in cents. Dates are `YYYY-MM-DD`.

## How the numbers work

- **Payments clear the oldest term first.** Each invoice's outstanding amount is what is left after all of the family's payments are applied in due-date order. Ageing uses each invoice's own due date.
- **Fee run.** One invoice per current family that has enrolled students. Student fee items match by year level. Tuition discounts go eldest first: the oldest child (highest year level) pays full tuition, the second gets `sibling_discount_2_pct`, the third and later get `sibling_discount_3_pct`. Family fee items (a levy) are charged once. A family already invoiced for the period is skipped.
- **Attendance rate.** School days in the current term up to today, less full-day absences, less half a day for each partial day. Late arrivals count as present.
- **Lapsed donors.** Gave between 12 and 24 months ago, nothing since.

## Documents and views

`npm run docs` writes fee statements, absence explanation requests, offers of a place, gift receipts and care plan registers to `docs-out/`. `npm run view` writes the week, debtors and enrolments pages to `views/`. Both use `brand.json`. Both contain private records: keep the folders private.

## Tests

`npm test` builds a temporary database, migrates, seeds twice, runs every command, checks ageing, sibling discounts, fee run idempotence, attendance windows, every compliance rule, enrolment, import (dry run, real, repeat, changed row, failed batch), export, drafts and rendering. It never connects to `DATABASE_URL`. `TEST_DATABASE_URL` pointing at a local disposable Postgres runs the same tests in a throwaway schema. The manual GitHub workflow runs Linux and Windows on Node 20 and 22, plus Postgres 17.
