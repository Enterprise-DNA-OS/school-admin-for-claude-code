# Moving off Synergetic

Synergetic does not have one export button for everything. Schools get their records out in three ways, all documented by the vendor: extracting tables with Microsoft Query from the Synergetic database, running the built-in and Crystal debtor reports, and the CSV exports on the Student Data Import/Export window. Your Synergetic database administrator will know which your school uses.

## 1. Extract the records

Save one CSV per kind of record into a folder. Any of these files can be left out:

| File | What it holds | Columns the importer recognises |
|---|---|---|
| `families.csv` | one row per family or debtor | FamilyID or DebtorID, FamilyName or Surname, DefaultEmail, HomePhone, AddressFull, Status |
| `contacts.csv` | parents and carers | ContactID, FamilyID, Given1, Surname (or Name), RelationshipDesc, DefaultEmail, MobilePhone, DebtorContactFlag |
| `students.csv` | current and past students | StudentID, FamilyID, Given1, Surname, BirthDate, StudentYearLevel, StudentHouse, StudentStatus, EntryDate |
| `staff.csv` | staff, volunteers, contractors and their checks | StaffID, FullName, PositionDescription, StaffType, State, WWCNumber, WWCExpiryDate |
| `enquiries.csv` | future students | FutureStudentID, StudentName, ParentName, Email, Phone, ProposedEntryYear, ProposedYearLevel, Status, EnquiryDate |
| `debtors.csv` | the balance each family owes today | DebtorID, OutstandingBalance, OldestDueDate |

Column names are matched without caring about case. If your extract uses other headings, add them to `IMPORT_COLUMNS` in `scripts/school.mjs` (or ask Claude Code to). Dates can be `YYYY-MM-DD` or `DD/MM/YYYY`. Year levels can be numbers, `Year 7`, `K`, `Kindergarten`, `Prep` or `Reception`.

`fixtures/synergetic/` has a small fictional example of every file.

## 2. Test, then import

```bash
npm run school -- import synergetic --dir=imports/synergetic --source=synergetic-2026-11 --dry-run
npm run school -- import synergetic --dir=imports/synergetic --source=synergetic-2026-11 --actor="Your name"
```

The dry run checks every row and saves nothing. The real run is one transaction: if any row fails, nothing is saved and the error names the file and row. Running the same files again skips unchanged rows. A row whose values changed since the last import stops the run, so nothing is overwritten silently: change the record with a command instead.

Each original row is kept in `import_records`, so you can always see what came across from where (`npm run school -- import-history`).

## What maps

- Families keep their Synergetic ID as their code, so staff can still search by the number they know.
- Students join their family by FamilyID. Status "left" or "past" becomes left; "future" becomes a future student; anything else is enrolled.
- Each debtor balance becomes one opening invoice dated at its oldest due date, so it ages correctly in `debtors` from day one.
- Future student statuses map to the stages enquiry, tour, applied, interview, offered, accepted, enrolled, declined and withdrawn.

## What does not carry over

- **Invoice and receipt history.** Only the balance comes across. Keep Synergetic's debtor reports for the history, or ask Enterprise DNA to map the full transaction history.
- **The general ledger, creditors, payroll and assets.** These stay in your accounting and payroll systems.
- **Attendance history, academic results, timetables and documents.** Attendance starts from the day you switch. Results and timetables stay where they are.
- **Care alerts.** Medical and custody notes are imported by hand with `add care`, one by one, so a person reads each one.
- **Fee schedules and settings.** Enter your fee items with `add fee` and your sibling discounts with `set`.

## Before you stop paying

Run both systems for a term: the same fee run, the same debtor list, the same absence follow-up. Compare totals family by family. Only then switch off the modules you have replaced.
