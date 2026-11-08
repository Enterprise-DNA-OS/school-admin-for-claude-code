#!/usr/bin/env node
// npm test: a temporary database, migrate, seed twice, every command, the rules that matter.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { migrate } from './migrate.mjs';
import { run, commands, resolve, parseArgs } from './school.mjs';
import { parseCsv } from './lib/csv.mjs';

const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'school-test-'));
// Tests never touch a working database, even when the shell has credentials.
delete process.env.DATABASE_URL;
process.env.DATA_DIR = path.join(temp, 'db');
process.env.OUTPUT_DIR = temp;
let testSchema;
if (process.env.TEST_DATABASE_URL) {
  const url = new URL(process.env.TEST_DATABASE_URL);
  if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw Error('TEST_DATABASE_URL must point to a disposable local test server');
  testSchema = 'school_test_' + process.pid + '_' + Date.now();
  url.searchParams.set('options', '-csearch_path=' + testSchema);
  process.env.DATABASE_URL = url.toString();
}

const db = await getDb();
if (testSchema) await db.exec('create schema ' + testSchema);
const seen = new Set();
const call = (c, o = {}, a = []) => { seen.add(c); return run(db, c, o, a); };
const count = async (t, where = '') => Number((await db.query(`select count(*) as n from ${t} ${where}`))[0].n);
const days = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const actor = { actor: 'Smoke test' };
let passed = 0;
const check = async (name, fn) => { await fn(); passed++; console.log(`ok  ${name}`); };

try {
  await check('migrate runs once, then is a no-op', async () => {
    assert.equal((await migrate(db)).ran.length, 1);
    assert.equal((await migrate(db)).ran.length, 0);
  });

  await check('seed is idempotent', async () => {
    const seed = fs.readFileSync(path.join(REPO_ROOT, 'supabase', 'seed.sql'), 'utf8');
    await db.exec(seed); await db.exec(seed);
    assert.equal(await count('families'), 5);
    assert.equal(await count('students'), 8);
    assert.equal(await count('invoices'), 8);
  });

  await check('every read command returns rows or an empty list', async () => {
    for (const c of ['families', 'students', 'enquiries', 'pipeline', 'waitlist', 'fees', 'invoices', 'payments', 'payment-plans', 'debtors', 'absences', 'attendance', 'care', 'staff-checks', 'excursions', 'consent-gaps', 'gifts', 'appeals', 'lapsed-donors', 'attention', 'compliance', 'settings', 'activity', 'import-history', 'help']) {
      assert(Array.isArray(await call(c)), c);
    }
  });

  await check('payments clear the oldest term first and debtors age correctly', async () => {
    const d = await call('debtors');
    const walker = d.find((r) => r.code === 'FAM-002');
    assert.equal(Number(walker.balance_cents), 1350000);
    assert.equal(Number(walker.overdue_61_90_cents), 675000);
    assert.equal(Number(walker.overdue_1_30_cents), 675000);
    const teaho = d.find((r) => r.code === 'FAM-003');
    assert.equal(Number(teaho.balance_cents), 915000);
    assert.equal(Number(teaho.oldest_days_overdue), 26);
    assert.equal(teaho.on_payment_plan, true);
    assert.equal(Number(d.find((r) => r.code === 'FAM-005').overdue_90_plus_cents), 255000);
    assert(!d.find((r) => r.code === 'FAM-001'), 'a family that has paid is not a debtor');
    assert(!d.find((r) => r.code === 'FAM-004'), 'an invoice not yet due is not overdue');
  });

  await check('attendance: unexplained absences past the window and the term rate', async () => {
    const abs = await call('absences');
    assert.equal(abs.filter((r) => r.code === 'STU-003' && r.past_window).length, 3);
    assert(abs.find((r) => r.code === 'STU-005' && !r.past_window), 'a late arrival yesterday is inside the window');
    assert(!abs.find((r) => r.code === 'STU-001'), 'an explained absence is not listed');
    const ella = (await call('attendance')).find((r) => r.code === 'STU-003');
    assert(Number(ella.attendance_pct) < 90);
  });

  await check('compliance finds the expired check, missing check, care plans and consent', async () => {
    const c = await call('compliance');
    const has = (rule, code, sev) => c.some((r) => r.rule === rule && r.code === code && r.severity === sev);
    assert(has('CHILD-SAFETY-CHECK', 'STF-02', 'breach'));
    assert(has('CHILD-SAFETY-CHECK', 'STF-04', 'breach'));
    assert(has('CHILD-SAFETY-CHECK', 'STF-03', 'due'));
    assert(!c.some((r) => r.code === 'STF-01'));
    assert(has('ANAPHYLAXIS-PLAN', 'STU-002', 'breach'));
    assert(has('ANAPHYLAXIS-PLAN', 'STU-006', 'breach'));
    assert(has('EXCURSION-CONSENT', 'STU-004', 'breach'));
    assert(has('EXCURSION-CONSENT', 'STU-001', 'due'));
    assert(!c.some((r) => r.code === 'STU-005' && r.rule === 'EXCURSION-CONSENT'), 'given consent clears the gap');
    assert(has('ABSENCE-FOLLOW-UP', 'STU-007', 'breach'));
  });

  await check('enrolments: issues, places and the waitlist', async () => {
    const e = await call('enquiries');
    assert.equal(e.find((r) => r.code === 'ENQ-004').issue, 'offer lapsed');
    assert.equal(e.find((r) => r.code === 'ENQ-001').issue, 'next step overdue');
    assert.equal(e.find((r) => r.code === 'ENQ-003').issue, 'gone quiet');
    assert(!e.find((r) => r.code === 'ENQ-006'), 'declined enquiries leave the pipeline');
    const y7 = (await call('waitlist')).find((r) => Number(r.year_level) === 7);
    assert.equal(Number(y7.places_left), 1);
    assert(Array.isArray(await call('pipeline')));
  });

  await check('weekly review combines five sections', async () => {
    const w = await call('weekly-review');
    for (const k of ['compliance', 'debtors', 'absences', 'enrolments', 'waitlist']) assert(Array.isArray(w[k]) && w[k].length, k);
  });

  await check('lookups: code, partial name, ambiguity', async () => {
    assert.equal((await call('family', {}, ['walker'])).family.code, 'FAM-002');
    assert.equal((await call('student', {}, ['ella'])).student.code, 'STU-003');
    await assert.rejects(() => resolve(db, 'students', 'Te Aho'), /Ambiguous.*STU-004.*STU-005.*STU-006/);
    await assert.rejects(() => resolve(db, 'students', 'Nobody'), /No students match/);
  });

  await check('fee run: dry run saves nothing, real run applies sibling discounts once', async () => {
    const before = await count('invoices');
    const dry = await call('fee-run', { period: 'TEST-T1', 'dry-run': true });
    assert.equal(dry.invoices.length, 4, 'current families with enrolled students only');
    assert.equal(await count('invoices'), before);
    const real = await call('fee-run', { period: 'TEST-T1', issued: days(0), ...actor });
    const teaho = real.invoices.find((i) => i.family === 'Te Aho');
    assert.equal(teaho.total_cents, 1515000, 'eldest full, second 10% off, third 20% off, one levy');
    assert.equal(teaho.lines.filter((l) => /Sibling discount/.test(l.description)).length, 2);
    assert.equal(real.invoices.find((i) => i.family === 'Walker').total_cents, 675000);
    assert.equal(await count('invoices'), before + 4);
    const again = await call('fee-run', { period: 'TEST-T1', ...actor });
    assert(again.invoices.every((i) => i.skipped === 'already invoiced'));
    assert.equal(await count('invoices'), before + 4);
    await assert.rejects(() => call('fee-run', {}), /--period/);
  });

  await check('record a payment, then the balance drops', async () => {
    const before = Number((await call('family', {}, ['FAM-002'])).balance.balance_cents);
    await call('record-payment', { amount: '6,750.00', date: days(0), ref: 'WALKER T3', ...actor }, ['FAM-002']);
    const after = Number((await call('family', {}, ['FAM-002'])).balance.balance_cents);
    assert.equal(before - after, 675000);
    await assert.rejects(() => call('record-payment', { amount: 'lots' }, ['FAM-002']), /amount/);
    await assert.rejects(() => call('record-payment', { amount: '0' }, ['FAM-002']), /more than zero/);
  });

  await check('attendance writes: mark, explain, validation', async () => {
    const day = days(0);
    await call('mark-absence', { date: day, ...actor }, ['STU-004']);
    assert((await call('absences')).some((r) => r.code === 'STU-004'));
    const abs = await db.query("select on_date from attendance a join students s on s.id = a.student_id where s.code = 'STU-003' order by on_date limit 1");
    await call('explain-absence', { date: abs[0].on_date, reason: 'unwell', by: 'Sarah Walker', ...actor }, ['STU-003']);
    assert.equal((await call('absences')).filter((r) => r.code === 'STU-003').length, 2);
    await assert.rejects(() => call('explain-absence', { date: '2001-01-01', reason: 'x', by: 'y' }, ['STU-003']), /no absence recorded/);
    await assert.rejects(() => call('mark-absence', { date: '2026-02-30' }, ['STU-003']), /real YYYY-MM-DD/);
    await assert.rejects(() => call('mark-absence', { status: 'asleep' }, ['STU-003']), /--status/);
  });

  await check('enquiry stages and enrolment', async () => {
    await assert.rejects(() => call('move-enquiry', { stage: 'offered' }, ['ENQ-002']), /offer-expires/);
    await call('move-enquiry', { stage: 'offered', 'offer-expires': days(14), ...actor }, ['ENQ-002']);
    await assert.rejects(() => call('enrol', {}, ['ENQ-002']), /Only an accepted enquiry/);
    await assert.rejects(() => call('move-enquiry', { stage: 'enrolled' }, ['ENQ-005']), /Use enrol/);
    const out = await call('enrol', actor, ['ENQ-005']);
    assert.equal(out.enquiry.stage, 'enrolled');
    assert.equal(out.student.status, 'future');
    assert.equal(await count('families', "where name = 'Patel'"), 1);
    await call('move-enquiry', { stage: 'accepted', ...actor }, ['ENQ-003']);
    const sib = await call('enrol', actor, ['ENQ-003']);
    assert.equal((await db.query('select code from families where id = $1', [sib.student.family_id]))[0].code, 'FAM-003', 'a sibling joins the existing family');
  });

  await check('checks, consent, settings and add', async () => {
    await call('record-check', { number: 'WWC0999999E', expires: days(1500), ...actor }, ['Tom Hale']);
    assert(!(await call('compliance')).some((r) => r.code === 'STF-04'));
    await call('record-consent', { by: 'Hemi Te Aho', ...actor }, ['EXC-02', 'Mere']);
    assert(!(await call('consent-gaps')).some((r) => r.student_code === 'STU-004'));
    await call('set', actor, ['absence_explanation_days', '3']);
    assert.equal((await call('settings')).find((r) => r.key === 'absence_explanation_days').value, '3');
    await assert.rejects(() => call('set', {}, ['nonsense', '1']), /Unknown setting/);
    await assert.rejects(() => call('set', {}, ['absence_explanation_days', 'soon']), /whole number/);
    const fam = await call('add', { name: 'Singh', billing_email: 'singh@example.com', ...actor }, ['family']);
    assert.match(fam.code, /^FAM-\d{3}$/);
    const stu = await call('add', { family: fam.code, name: 'Arjun Singh', year_level: '4', ...actor }, ['student']);
    assert.equal(stu.year_level, 4);
    await call('add', { student: stu.code, kind: 'anaphylaxis', detail: 'Egg allergy', ...actor }, ['care']);
    assert((await call('care')).some((r) => r.student_code === stu.code && r.issue === 'no action plan on file'));
    await call('add', { donor_name: 'Arjun Singh family', family: fam.code, appeal: 'Annual Giving', amount: '100', received_on: days(0), ...actor }, ['gift']);
    await assert.rejects(() => call('add', { name: 'No family' }, ['student']), /--family/);
    await assert.rejects(() => call('add', { family: fam.code, name: 'X', year_level: '15' }, ['student']), /0 to 13/);
    await assert.rejects(() => call('add', {}, ['widgets']), /add needs a kind/);
    const act = await call('activity');
    assert(act.some((r) => r.actor === 'Smoke test' && r.operation === 'fee run TEST-T1'));
  });

  await check('import from Synergetic: dry run, real run, repeat, changed duplicate, bad row', async () => {
    const dir = path.join(REPO_ROOT, 'fixtures', 'synergetic');
    const before = await count('students');
    const dry = await call('import', { dir, 'dry-run': true, source: 'fixture', ...actor }, ['synergetic']);
    assert.equal(dry.added.students, 3);
    assert.equal(await count('students'), before);
    const real = await call('import', { dir, source: 'fixture', ...actor }, ['synergetic']);
    assert.equal(real.added.families, 2);
    assert.equal(await count('students'), before + 3);
    const sam = (await db.query("select * from students where code = 'SYN-30552'"))[0];
    assert.equal(sam.year_level, 0, 'K maps to Kindergarten');
    assert.equal(sam.date_of_birth, '2017-11-19', 'DD/MM/YYYY dates');
    const opening = (await call('family', {}, ['SYN-20411'])).balance;
    assert.equal(Number(opening.balance_cents), 218000);
    const repeat = await call('import', { dir, source: 'fixture', ...actor }, ['synergetic']);
    assert.equal(repeat.unchanged.students, 3);
    assert.equal(repeat.added.students, 0);
    const changed = path.join(temp, 'changed');
    fs.cpSync(dir, changed, { recursive: true });
    fs.writeFileSync(path.join(changed, 'students.csv'), fs.readFileSync(path.join(dir, 'students.csv'), 'utf8').replace('Ruby,Hartley', 'Rubi,Hartley'));
    await assert.rejects(() => call('import', { dir: changed, source: 'fixture' }, ['synergetic']), /imported before with different values/);
    const bad = path.join(temp, 'bad');
    fs.mkdirSync(bad);
    fs.writeFileSync(path.join(bad, 'families.csv'), 'FamilyID,FamilyName\nBAD-1,Good\n');
    fs.writeFileSync(path.join(bad, 'students.csv'), 'StudentID,FamilyID,Given1,Surname,StudentYearLevel\nBAD-S1,BAD-1,A,B,Year 20\n');
    await assert.rejects(() => call('import', { dir: bad, source: 'bad' }, ['synergetic']), /year level/);
    assert.equal(await count('families', "where code = 'BAD-1'"), 0, 'a failed import rolls back the whole batch');
    assert((await call('import-history')).some((r) => r.code === 'SYN-30551'));
    await assert.rejects(() => call('import', {}, ['hubspot']), /import synergetic/);
  });

  await check('export writes every table as CSV', async () => {
    const out = await call('export', { dir: path.join(temp, 'export') });
    assert(out.tables.students > 0);
    const rows = parseCsv(fs.readFileSync(path.join(out.dir, 'students.csv'), 'utf8'));
    assert.equal(rows.length, out.tables.students);
  });

  await check('drafts are written, never sent', async () => {
    const fee = await call('draft-fee-reminder', {}, ['Te Aho']);
    const text = fs.readFileSync(fee.file, 'utf8');
    assert.match(text, /payment plan/);
    assert.match(text, /hemi\.teaho@example\.com/);
    await assert.rejects(() => call('draft-fee-reminder', {}, ['Singh']), /no balance owing/);
    const abs = await call('draft-absence-letter', {}, ['Ella']);
    assert.match(fs.readFileSync(abs.file, 'utf8'), /no explanation on file/);
    await assert.rejects(() => call('draft-absence-letter', {}, ['Minh']), /no unexplained absences/);
    const offer = await call('draft-offer-letter', {}, ['ENQ-002']);
    assert.match(fs.readFileSync(offer.file, 'utf8'), /Year 7/);
    await assert.rejects(() => call('draft-offer-letter', {}, ['ENQ-001']), /Draft an offer at interview or offered/);
  });

  await check('argument parsing and unknown commands', async () => {
    assert.deepEqual(parseArgs(['family', 'walker', '--json']), { cmd: 'family', o: { json: true }, a: ['walker'] });
    await assert.rejects(() => run(db, 'teleport'), /Unknown command/);
  });

  const missing = commands.filter((c) => !seen.has(c));
  assert.deepEqual(missing, [], `commands never exercised: ${missing.join(', ')}`);
} finally {
  if (testSchema) await db.exec(`drop schema ${testSchema} cascade`);
  await db.close();
}

// The rendered views and documents, through the real scripts, against the same temporary data.
if (!testSchema) {
  const env = { ...process.env };
  for (const script of ['view.mjs', 'docs.mjs']) {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', script)], { env, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    passed++;
    console.log(`ok  ${script} renders`);
  }
  const week = fs.readFileSync(path.join(temp, 'views', 'week.html'), 'utf8');
  assert.match(week, /CHILD-SAFETY-CHECK/);
  assert.match(week, /Harbourside Grammar|business_name/);
  const statements = fs.readdirSync(path.join(temp, 'docs-out', 'fee-statement'));
  assert(statements.length >= 4);
  const cli = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'school.mjs'), 'debtors', '--json'], { env, encoding: 'utf8' });
  assert.equal(cli.status, 0, cli.stderr);
  assert(Array.isArray(JSON.parse(cli.stdout)));
  const bad = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'school.mjs'), 'student', 'Te Aho'], { env, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Ambiguous/);
  passed += 1;
  console.log('ok  CLI exits 1 and lists candidates when a name is ambiguous');
}
fs.rmSync(temp, { recursive: true, force: true });
console.log(`PASS ${passed} checks, ${commands.length} commands`);
