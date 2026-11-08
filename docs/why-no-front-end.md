# Why there is no front end

A school administration system is a database with a subscription. Underneath are ordinary records: families, contacts, students, enquiries, fee terms, payments, attendance days, care alerts, staff checks, consents and gifts. What a school pays for is mostly the layer on top that lets the bursar, the registrar and the front office get at those records without writing a query.

That layer used to be the whole product, because talking to a database was hard. It is not hard any more. Open this folder in Claude Code, ask "which families are more than 60 days behind and not on a plan?", and it runs the query and explains the answer. Ask a question no report was ever built for and you still get an answer.

## What you gain

- **Answers to your own questions.** The business manager asks about debtors, the registrar about next year's Year 7, the principal about child safety, each in plain words.
- **No per-module licence.** Everyone who needs to look can look.
- **Your records in a database you own.** Plain Postgres tables. Back them up, query them from anything, leave any time.
- **Your rules.** Sibling discounts, the absence window, review periods and fee schedules are settings and tables you change by asking.

## What a screen gives that this does not

Be honest about it before you switch:

- **Teachers marking rolls.** A teacher with thirty students wants a phone screen, not a chat. Roll marking here is a command or an import from your learning platform.
- **A parent portal.** Families paying online, updating details and returning consent forms need a web page.
- **Timetabling and academic reporting.** This base does not build timetables or semester reports.
- **General ledger and payroll.** This base records fees and payments. It is not your accounting system or your payroll.
- **A vendor help desk.** This is open source. Enterprise DNA supports the installed version for schools that want someone to call.

Enterprise DNA builds the screens a school actually needs (a roll-marking page, a parent consent form, a bursar's board) on top of the same database, so the records stay yours.

## Who this fits

Independent schools whose admin team spends its week on families, fees, enrolments, attendance follow-up and compliance checks, and who want those answers faster than the current system gives them.

Installed and run for you: https://enterprisedna.co/omni/instead-of/synergetic
