#!/usr/bin/env node
// School Admin for Claude Code: one CLI over the school's database.
//   npm run school -- <command> [args] [--json]
// Every read prints a table (or JSON with --json). Every write is audited.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { parseCsv, pick } from './lib/csv.mjs';
import { table as textTable, money, heading } from './lib/format.mjs';

const STAGES = ['enquiry', 'tour', 'applied', 'interview', 'offered', 'accepted', 'enrolled', 'declined', 'withdrawn'];

const reads = {
  families: "select f.code, f.name, f.status, f.billing_email, (select count(*) from students s where s.family_id = f.id and s.status = 'enrolled') as enrolled, b.balance_cents, b.currency from families f join family_balances b on b.family_id = f.id order by f.code",
  students: "select s.code, s.name, s.year_level, s.house, s.status, f.code as family_code, f.name as family from students s join families f on f.id = s.family_id order by s.status, s.year_level desc, s.name",
  enquiries: "select code, child_name, parent_name, entry_year, entry_level, stage, sibling, last_contact_on, next_step, next_step_due, issue from enquiry_pipeline order by entry_year, entry_level, code",
  pipeline: "select entry_year, entry_level, stage, count(*) as enquiries from enquiries group by entry_year, entry_level, stage order by entry_year, entry_level, array_position(array['enquiry','tour','applied','interview','offered','accepted','enrolled','declined','withdrawn']::text[], stage)",
  waitlist: 'select * from waitlist order by entry_year, year_level',
  fees: "select code, name, category, year_from, year_to, per, basis, amount_cents, gst_free, active, (select currency from setting_values) as currency from fee_items order by active desc, category, year_from",
  invoices: "select t.code, f.name as family, t.period, t.issued_on, t.due_on, t.status, t.total_cents, coalesce(o.outstanding_cents, 0) as outstanding_cents, (select currency from setting_values) as currency from invoice_totals t join families f on f.id = t.family_id left join invoice_outstanding o on o.id = t.id order by t.due_on, t.code",
  payments: "select p.code, f.name as family, p.received_on, p.amount_cents, p.method, p.reference, (select currency from setting_values) as currency from payments p join families f on f.id = p.family_id order by p.received_on desc, p.code",
  'payment-plans': "select pp.code, f.name as family, pp.instalment_cents, pp.frequency, pp.starts_on, pp.status, pp.note, (select currency from setting_values) as currency from payment_plans pp join families f on f.id = pp.family_id order by pp.status, pp.code",
  debtors: 'select * from debtors order by oldest_days_overdue desc, balance_cents desc',
  absences: 'select code, name, year_level, family, on_date, status, days_waiting, past_window from unexplained_absences order by past_window desc, on_date, code',
  attendance: 'select code, name, year_level, school_days, days_absent, days_late_or_partial, attendance_pct from term_attendance order by attendance_pct, code',
  care: 'select code, student_code, student, year_level, kind, detail, action_plan_on, review_due, issue from care_reviews order by issue nulls last, review_due',
  'staff-checks': "select code, name, role, kind, jurisdiction, check_type, check_number, check_expires, check_status, days_left from staff_checks order by array_position(array['expired','missing','due soon','current']::text[], check_status), check_expires",
  excursions: "select x.code, x.name, x.on_date, x.year_level, x.consent_due, (select count(*) from students s where s.year_level = x.year_level and s.status = 'enrolled') as students, (select count(*) from consents c where c.excursion_id = x.id and c.status = 'given') as consents_given, (select count(*) from consent_gaps g where g.excursion = x.code) as outstanding from excursions x order by x.on_date",
  'consent-gaps': 'select * from consent_gaps order by on_date, student',
  gifts: "select code, donor_name, appeal, amount_cents, received_on, receipt_number, tax_deductible, (select currency from setting_values) as currency from gifts order by received_on desc, code",
  appeals: 'select * from appeal_totals order by last_gift_on desc',
  'lapsed-donors': 'select * from lapsed_donors order by lifetime_cents desc',
  attention: "select * from attention order by array_position(array['staff checks','care','attendance','consent','fees','enrolments']::text[], area), days desc nulls last, code",
  compliance: "select * from compliance_checks order by array_position(array['breach','due','check']::text[], severity), rule, code",
  settings: 'select key, value, note from settings order by key',
  activity: 'select actor, kind, operation, record_id, created_at from audit order by created_at desc, id desc limit 100',
  'import-history': 'select source, kind, code, record_id, created_at from import_records order by created_at, kind, code',
};

// Writable record kinds: the fields `add` accepts and how references resolve.
const KINDS = {
  families: { prefix: 'FAM', label: 'name', fields: ['code', 'name', 'billing_email', 'phone', 'address', 'status', 'payment_terms_days'], required: ['name'] },
  contacts: { prefix: 'CON', label: 'name', fields: ['code', 'family', 'name', 'relationship', 'email', 'phone', 'receives_billing', 'lives_with_student'], required: ['family', 'name'] },
  students: { prefix: 'STU', label: 'name', fields: ['code', 'family', 'name', 'date_of_birth', 'year_level', 'house', 'status', 'entry_date'], required: ['family', 'name', 'year_level'] },
  enquiries: { prefix: 'ENQ', label: 'child_name', fields: ['code', 'child_name', 'parent_name', 'email', 'phone', 'entry_year', 'entry_level', 'stage', 'sibling_family', 'source', 'last_contact_on', 'next_step', 'next_step_due'], required: ['child_name', 'parent_name', 'entry_year', 'entry_level'] },
  staff: { prefix: 'STF', label: 'name', fields: ['code', 'name', 'role', 'kind', 'jurisdiction', 'check_type', 'check_number', 'check_expires'], required: ['name', 'role', 'jurisdiction', 'check_type'] },
  excursions: { prefix: 'EXC', label: 'name', fields: ['code', 'name', 'on_date', 'year_level', 'staff_lead', 'consent_due'], required: ['name', 'on_date', 'year_level'] },
  care_alerts: { prefix: 'CARE', label: 'detail', fields: ['code', 'student', 'kind', 'detail', 'action_plan_on', 'review_due'], required: ['student', 'kind', 'detail'] },
  gifts: { prefix: 'GFT', label: 'donor_name', fields: ['code', 'donor_name', 'family', 'appeal', 'amount', 'received_on', 'receipt_number', 'tax_deductible'], required: ['donor_name', 'appeal', 'amount', 'received_on'] },
  fee_items: { prefix: 'FEE', label: 'name', fields: ['code', 'name', 'category', 'year_from', 'year_to', 'per', 'basis', 'amount', 'gst_free'], required: ['name', 'category', 'amount'] },
  payment_plans: { prefix: 'PLAN', label: 'code', fields: ['code', 'family', 'instalment', 'frequency', 'starts_on', 'note'], required: ['family', 'instalment', 'frequency', 'starts_on'] },
};
const REFS = { family: ['families', 'family_id'], sibling_family: ['families', 'sibling_family_id'], student: ['students', 'student_id'], staff_lead: ['staff', 'staff_lead_id'] };
const MONEY = { amount: 'amount_cents', instalment: 'instalment_cents' };
const BOOLS = ['receives_billing', 'lives_with_student', 'tax_deductible', 'gst_free'];
const ALIASES = { family: 'families', families: 'families', contact: 'contacts', student: 'students', enquiry: 'enquiries', staff: 'staff', excursion: 'excursions', care: 'care_alerts', 'care-alert': 'care_alerts', gift: 'gifts', fee: 'fee_items', 'fee-item': 'fee_items', plan: 'payment_plans', 'payment-plan': 'payment_plans' };

export const commands = [...Object.keys(reads), 'family', 'student', 'weekly-review', 'add', 'move-enquiry', 'enrol', 'mark-absence', 'explain-absence', 'record-payment', 'fee-run', 'record-check', 'record-consent', 'set', 'import', 'export', 'draft-fee-reminder', 'draft-absence-letter', 'draft-offer-letter', 'help'];

// ---------------------------------------------------------------- validation

function required(v, key) {
  if (v === undefined || v === null || String(v).trim() === '' || v === true) throw Error(`Required: --${key}`);
  return String(v).trim();
}
export function date(v, key = 'date') {
  const s = required(v, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) !== s) throw Error(`--${key} must be a real YYYY-MM-DD date`);
  return s;
}
export function cents(v, key = 'amount') {
  const s = required(v, key).replace(/[$,\s]/g, '');
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) throw Error(`--${key} must be an amount like 1250 or 1250.50`);
  return Math.round(Number(s) * 100);
}
function int(v, key, min, max) {
  const s = required(v, key);
  if (!/^-?\d+$/.test(s) || Number(s) < min || Number(s) > max) throw Error(`--${key} must be a whole number from ${min} to ${max}`);
  return Number(s);
}
function bool(v, key) {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', 'yes', 'y', '1'].includes(s) || v === true) return true;
  if (['false', 'no', 'n', '0'].includes(s)) return false;
  throw Error(`--${key} must be yes or no`);
}
const today = () => new Date().toISOString().slice(0, 10);

// ---------------------------------------------------------------- lookup

export async function resolve(db, kind, value) {
  const k = ALIASES[kind] || kind;
  if (!KINDS[k]) throw Error(`Unknown record kind: ${kind}`);
  const term = required(value, k);
  const exact = await db.query(`select * from ${k} where lower(code) = lower($1) or id::text = $1`, [term]);
  if (exact.length === 1) return exact[0];
  const label = KINDS[k].label;
  const rows = await db.query(`select * from ${k} where starts_with(id::text, lower($1)) or position(lower($1) in lower(${label})) > 0 order by code`, [term]);
  if (rows.length === 1) return rows[0];
  if (!rows.length) throw Error(`No ${k} match "${term}"`);
  throw Error(`Ambiguous ${k} "${term}": ${rows.map((r) => `${r.code} ${r[label]}`).join('; ')}`);
}

async function audit(db, actor, kind, recordId, operation, before, after) {
  await db.query('insert into audit (actor, kind, record_id, operation, before_record, after_record) values ($1, $2, $3, $4, $5, $6)',
    [actor, kind, recordId == null ? null : String(recordId), operation, before ? JSON.stringify(before) : null, after ? JSON.stringify(after) : null]);
}
async function nextCode(db, kind) {
  const prefix = KINDS[kind].prefix;
  const rows = await db.query(`select code from ${kind} where code like $1`, [prefix + '-%']);
  let n = rows.reduce((m, r) => Math.max(m, Number(String(r.code).split('-').pop()) || 0), 0) + 1;
  return `${prefix}-${String(n).padStart(3, '0')}`;
}
function actorOf(o) { return String(o.actor && o.actor !== true ? o.actor : process.env.SCHOOL_ACTOR || 'operator'); }

// Wrap a write so it is all or nothing.
async function tx(db, fn) {
  await db.exec('BEGIN');
  try { const out = await fn(); await db.exec('COMMIT'); return out; } catch (e) { await db.exec('ROLLBACK'); throw e; }
}

// ---------------------------------------------------------------- writes

export async function add(db, kindArg, o) {
  const kind = ALIASES[kindArg] || kindArg;
  const spec = KINDS[kind];
  if (!spec) throw Error(`add needs a kind: ${Object.keys(ALIASES).join(', ')}`);
  for (const r of spec.required) required(o[r], r);
  const cols = [], vals = [];
  for (const f of spec.fields) {
    if (o[f] === undefined) continue;
    let v = o[f];
    if (REFS[f]) { cols.push(REFS[f][1]); vals.push((await resolve(db, REFS[f][0], v)).id); continue; }
    if (MONEY[f]) { cols.push(MONEY[f]); vals.push(cents(v, f)); continue; }
    if (BOOLS.includes(f)) v = bool(v, f);
    else if (/_on$|_date$|_due$|_expires$|date_of_birth/.test(f)) v = date(v, f);
    else if (['year_level', 'entry_level', 'year_from', 'year_to'].includes(f)) v = int(v, f, 0, 13);
    else if (f === 'entry_year') v = int(v, f, 2000, 2100);
    else if (f === 'payment_terms_days') v = int(v, f, 0, 120);
    else if (f === 'stage' && !STAGES.includes(v)) throw Error(`--stage must be one of ${STAGES.join(', ')}`);
    else v = String(v);
    cols.push(f); vals.push(v);
  }
  if (!cols.includes('code')) { cols.push('code'); vals.push(await nextCode(db, kind)); }
  return tx(db, async () => {
    const [row] = await db.query(`insert into ${kind} (${cols.join(', ')}) values (${cols.map((_, i) => '$' + (i + 1)).join(', ')}) returning *`, vals);
    await audit(db, actorOf(o), kind, row.id, 'add', null, row);
    return row;
  });
}

async function update(db, kind, row, patch, o, operation) {
  const keys = Object.keys(patch);
  return tx(db, async () => {
    const [after] = await db.query(`update ${kind} set ${keys.map((k, i) => `${k} = $${i + 2}`).join(', ')} where id = $1 returning *`, [row.id, ...keys.map((k) => patch[k])]);
    await audit(db, actorOf(o), kind, row.id, operation, row, after);
    return after;
  });
}

async function moveEnquiry(db, o, a) {
  const e = await resolve(db, 'enquiries', a[0]);
  const stage = required(o.stage, 'stage');
  if (!STAGES.includes(stage)) throw Error(`--stage must be one of ${STAGES.join(', ')}`);
  if (stage === 'enrolled') throw Error('Use enrol to turn an accepted enquiry into a student');
  const patch = { stage, last_contact_on: o.contacted ? date(o.contacted, 'contacted') : today() };
  if (o['next-step'] !== undefined) patch.next_step = String(o['next-step']);
  if (o.due !== undefined) patch.next_step_due = date(o.due, 'due');
  if (stage === 'offered') patch.offer_expires_on = date(o['offer-expires'], 'offer-expires');
  return update(db, 'enquiries', e, patch, o, `stage ${e.stage} -> ${stage}`);
}

async function enrol(db, o, a) {
  const e = await resolve(db, 'enquiries', a[0]);
  if (e.stage !== 'accepted') throw Error(`${e.code} is ${e.stage}. Only an accepted enquiry can be enrolled.`);
  return tx(db, async () => {
    let familyId = e.sibling_family_id;
    if (o.family) familyId = (await resolve(db, 'families', o.family)).id;
    if (!familyId) {
      const surname = String(o['family-name'] || e.parent_name.split(' ').slice(-1)[0]);
      const [f] = await db.query("insert into families (code, name, billing_email, phone, status) values ($1, $2, $3, $4, 'current') returning *", [await nextCode(db, 'families'), surname, e.email, e.phone]);
      await db.query("insert into contacts (code, family_id, name, email, phone, receives_billing) values ($1, $2, $3, $4, $5, true)", [await nextCode(db, 'contacts'), f.id, e.parent_name, e.email, e.phone]);
      await audit(db, actorOf(o), 'families', f.id, 'add from enquiry ' + e.code, null, f);
      familyId = f.id;
    }
    const entry = o['entry-date'] ? date(o['entry-date'], 'entry-date') : `${e.entry_year}-01-30`;
    const [s] = await db.query("insert into students (code, family_id, name, year_level, status, entry_date) values ($1, $2, $3, $4, 'future', $5) returning *", [await nextCode(db, 'students'), familyId, e.child_name, e.entry_level, entry]);
    const [after] = await db.query("update enquiries set stage = 'enrolled', student_id = $2, last_contact_on = current_date where id = $1 returning *", [e.id, s.id]);
    await audit(db, actorOf(o), 'students', s.id, 'enrol from ' + e.code, null, s);
    await audit(db, actorOf(o), 'enquiries', e.id, 'stage accepted -> enrolled', e, after);
    return { student: s, enquiry: after };
  });
}

async function markAbsence(db, o, a) {
  const s = await resolve(db, 'students', a[0]);
  const on = date(o.date || today(), 'date');
  const status = o.status ? String(o.status) : 'absent';
  if (!['absent', 'late', 'partial', 'present'].includes(status)) throw Error('--status must be absent, late, partial or present');
  return tx(db, async () => {
    const [before] = await db.query('select * from attendance where student_id = $1 and on_date = $2', [s.id, on]);
    const [row] = await db.query(`insert into attendance (student_id, on_date, status, reason) values ($1, $2, $3, $4)
      on conflict (student_id, on_date) do update set status = excluded.status, reason = coalesce(excluded.reason, attendance.reason) returning *`, [s.id, on, status, o.reason ? String(o.reason) : null]);
    await audit(db, actorOf(o), 'attendance', row.id, `mark ${status}`, before || null, row);
    return row;
  });
}

async function explainAbsence(db, o, a) {
  const s = await resolve(db, 'students', a[0]);
  const on = date(o.date, 'date');
  const [row] = await db.query('select * from attendance where student_id = $1 and on_date = $2', [s.id, on]);
  if (!row) throw Error(`${s.name} has no absence recorded on ${on}`);
  return update(db, 'attendance', row, { explained: true, reason: required(o.reason, 'reason'), explained_by: required(o.by, 'by'), explained_on: o.on ? date(o.on, 'on') : today() }, o, 'explain');
}

async function recordPayment(db, o, a) {
  const f = await resolve(db, 'families', a[0]);
  const amount = cents(o.amount, 'amount');
  if (amount <= 0) throw Error('--amount must be more than zero');
  return tx(db, async () => {
    const code = o.code ? String(o.code) : await nextPaymentCode(db);
    const [row] = await db.query('insert into payments (code, family_id, received_on, amount_cents, method, reference) values ($1, $2, $3, $4, $5, $6) returning *',
      [code, f.id, o.date ? date(o.date, 'date') : today(), amount, o.method ? String(o.method) : 'bank transfer', o.ref ? String(o.ref) : null]);
    await audit(db, actorOf(o), 'payments', row.id, 'record payment', null, row);
    return row;
  });
}
async function nextPaymentCode(db) {
  const rows = await db.query("select code from payments where code like 'PAY-%'");
  const n = rows.reduce((m, r) => Math.max(m, Number(String(r.code).split('-').pop()) || 0), 0) + 1;
  return `PAY-${String(n).padStart(3, '0')}`;
}

// The termly fee run: one invoice per current family for the period, sibling discounts on tuition.
export async function feeRun(db, o) {
  const period = required(o.period, 'period');
  const issued = o.issued ? date(o.issued, 'issued') : today();
  const setting = async (k, d) => Number((await db.query('select value from settings where key = $1', [k]))[0]?.value ?? d);
  const d2 = await setting('sibling_discount_2_pct', 0), d3 = await setting('sibling_discount_3_pct', 0);
  const items = await db.query("select * from fee_items where active and per = 'term' order by category, year_from");
  const families = await db.query("select f.* from families f where f.status = 'current' and exists (select 1 from students s where s.family_id = f.id and s.status = 'enrolled') order by f.code");
  const plan = [];
  for (const f of families) {
    const exists = (await db.query('select code from invoices where family_id = $1 and period = $2', [f.id, period]))[0];
    if (exists) { plan.push({ family: f.name, code: exists.code, skipped: 'already invoiced', lines: [], total_cents: 0 }); continue; }
    const kids = await db.query("select * from students where family_id = $1 and status = 'enrolled' order by year_level desc, date_of_birth nulls last, code", [f.id]);
    const lines = [];
    kids.forEach((s, i) => {
      for (const it of items.filter((x) => x.basis === 'student' && s.year_level >= x.year_from && s.year_level <= x.year_to)) {
        lines.push({ student_id: s.id, fee_item_id: it.id, description: `${it.name}: ${s.name}`, amount_cents: Number(it.amount_cents), gst_free: it.gst_free });
        const pct = it.category === 'tuition' ? (i === 1 ? d2 : i >= 2 ? d3 : 0) : 0;
        if (pct) lines.push({ student_id: s.id, fee_item_id: it.id, description: `Sibling discount ${pct}%: ${s.name}`, amount_cents: -Math.round(Number(it.amount_cents) * pct / 100), gst_free: it.gst_free });
      }
    });
    for (const it of items.filter((x) => x.basis === 'family')) lines.push({ student_id: null, fee_item_id: it.id, description: it.name, amount_cents: Number(it.amount_cents), gst_free: it.gst_free });
    const due = new Date(Date.parse(issued + 'T00:00:00Z') + f.payment_terms_days * 86400000).toISOString().slice(0, 10);
    plan.push({ family: f.name, family_id: f.id, code: `INV-${period}-${f.code}`, issued_on: issued, due_on: due, lines, total_cents: lines.reduce((t, l) => t + l.amount_cents, 0) });
  }
  if (o['dry-run']) return { period, dry_run: true, invoices: plan };
  await tx(db, async () => {
    for (const p of plan.filter((x) => !x.skipped)) {
      const [inv] = await db.query('insert into invoices (code, family_id, period, issued_on, due_on) values ($1, $2, $3, $4, $5) returning *', [p.code, p.family_id, period, p.issued_on, p.due_on]);
      for (const l of p.lines) await db.query('insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents, gst_free) values ($1, $2, $3, $4, $5, $6)', [inv.id, l.student_id, l.fee_item_id, l.description, l.amount_cents, l.gst_free]);
      await audit(db, actorOf(o), 'invoices', inv.id, 'fee run ' + period, null, { ...inv, total_cents: p.total_cents });
    }
  });
  return { period, dry_run: false, invoices: plan };
}

async function recordCheck(db, o, a) {
  const s = await resolve(db, 'staff', a[0]);
  return update(db, 'staff', s, { check_number: required(o.number, 'number'), check_expires: date(o.expires, 'expires') }, o, 'record check');
}

async function recordConsent(db, o, a) {
  const x = await resolve(db, 'excursions', a[0]);
  const s = await resolve(db, 'students', a[1]);
  const status = o.status ? String(o.status) : 'given';
  if (!['given', 'declined'].includes(status)) throw Error('--status must be given or declined');
  return tx(db, async () => {
    const [row] = await db.query(`insert into consents (excursion_id, student_id, status, given_by, given_on) values ($1, $2, $3, $4, $5)
      on conflict (excursion_id, student_id) do update set status = excluded.status, given_by = excluded.given_by, given_on = excluded.given_on returning *`,
      [x.id, s.id, status, required(o.by, 'by'), o.on ? date(o.on, 'on') : today()]);
    await audit(db, actorOf(o), 'consents', `${x.code}/${s.code}`, 'consent ' + status, null, row);
    return row;
  });
}

async function setSetting(db, o, a) {
  const key = required(a[0], 'key'), value = required(a[1], 'value');
  const known = (await db.query('select * from settings where key = $1', [key]))[0];
  if (!known) throw Error(`Unknown setting ${key}. See: npm run school -- settings`);
  if (key !== 'currency' && !/^\d+$/.test(value)) throw Error(`${key} takes a whole number`);
  return tx(db, async () => {
    const [after] = await db.query('update settings set value = $2, updated_at = now() where key = $1 returning *', [key, value]);
    await audit(db, actorOf(o), 'settings', key, 'set', known, after);
    return after;
  });
}

// ---------------------------------------------------------------- detail reads

async function family(db, a) {
  const f = await resolve(db, 'families', a[0]);
  return {
    family: f,
    balance: (await db.query('select * from family_balances where family_id = $1', [f.id]))[0],
    contacts: await db.query('select code, name, relationship, email, phone, receives_billing, lives_with_student from contacts where family_id = $1 order by code', [f.id]),
    students: await db.query('select code, name, year_level, house, status from students where family_id = $1 order by year_level desc', [f.id]),
    outstanding: await db.query("select code, period, due_on, total_cents, outstanding_cents, days_overdue, (select currency from setting_values) as currency from invoice_outstanding where family_id = $1 and outstanding_cents > 0 order by due_on", [f.id]),
    payments: await db.query("select code, received_on, amount_cents, method, reference, (select currency from setting_values) as currency from payments where family_id = $1 order by received_on desc", [f.id]),
    plans: await db.query("select code, instalment_cents, frequency, starts_on, status, note, (select currency from setting_values) as currency from payment_plans where family_id = $1", [f.id]),
  };
}

async function student(db, a) {
  const s = await resolve(db, 'students', a[0]);
  return {
    student: s,
    family: (await db.query('select code, name, billing_email, phone from families where id = $1', [s.family_id]))[0],
    care: await db.query('select code, kind, detail, action_plan_on, review_due, active from care_alerts where student_id = $1 order by code', [s.id]),
    attendance: (await db.query('select school_days, days_absent, days_late_or_partial, attendance_pct from term_attendance where student_id = $1', [s.id]))[0] || null,
    absences: await db.query('select on_date, status, reason, explained, explained_by from attendance where student_id = $1 and status <> $2 order by on_date desc', [s.id, 'present']),
    consents: await db.query('select x.code, x.name, x.on_date, c.status, c.given_by from excursions x join consents c on c.excursion_id = x.id where c.student_id = $1 order by x.on_date', [s.id]),
  };
}

async function weeklyReview(db) {
  return {
    compliance: await db.query(reads.compliance),
    debtors: await db.query(reads.debtors),
    absences: await db.query('select code, name, on_date, days_waiting from unexplained_absences where past_window order by on_date'),
    enrolments: await db.query('select code, child_name, entry_year, entry_level, stage, issue from enquiry_pipeline where issue is not null order by entry_year, entry_level'),
    waitlist: await db.query(reads.waitlist),
  };
}

// ---------------------------------------------------------------- import from Synergetic

// Synergetic has no single fixed export. Schools pull tables through Microsoft Query or
// reports into CSV. These aliases cover the common Synergetic column names and plain ones;
// add your own headings here (or ask Claude Code to) before the first real import.
export const IMPORT_COLUMNS = {
  families: { code: ['FamilyID', 'DebtorID', 'ID', 'code'], name: ['FamilyName', 'Surname', 'name'], billing_email: ['BillingEmail', 'DefaultEmail', 'Email'], phone: ['HomePhone', 'Phone'], address: ['Address', 'AddressFull'], status: ['Status'] },
  students: { code: ['StudentID', 'ID', 'code'], family: ['FamilyID', 'DebtorID', 'family'], given: ['Given1', 'PreferredName', 'FirstName'], surname: ['Surname', 'LastName'], name: ['Name', 'FullName'], date_of_birth: ['BirthDate', 'DOB', 'DateOfBirth'], year_level: ['StudentYearLevel', 'YearLevel', 'Year'], house: ['StudentHouse', 'House'], status: ['Status', 'StudentStatus'], entry_date: ['EntryDate', 'StartDate'] },
  contacts: { code: ['ContactID', 'ID', 'code'], family: ['FamilyID', 'DebtorID', 'family'], name: ['Name', 'FullName'], given: ['Given1', 'FirstName'], surname: ['Surname', 'LastName'], relationship: ['Relationship', 'RelationshipDesc'], email: ['Email', 'DefaultEmail'], phone: ['MobilePhone', 'Phone'], receives_billing: ['ReceivesBilling', 'DebtorContactFlag'] },
  debtors: { family: ['FamilyID', 'DebtorID', 'family'], balance: ['Balance', 'OutstandingBalance', 'Amount'], due_on: ['DueDate', 'OldestDueDate', 'due_on'] },
  enquiries: { code: ['FutureStudentID', 'EnquiryID', 'ID', 'code'], child_name: ['StudentName', 'ChildName'], parent_name: ['ParentName', 'ContactName'], email: ['Email'], phone: ['Phone'], entry_year: ['EntryYear', 'ProposedEntryYear'], entry_level: ['EntryYearLevel', 'ProposedYearLevel'], stage: ['Stage', 'Status'], enquired_on: ['EnquiryDate', 'CreatedDate'] },
  staff: { code: ['StaffID', 'ID', 'code'], name: ['Name', 'FullName'], role: ['Role', 'PositionDescription', 'Position'], kind: ['Kind', 'StaffType'], jurisdiction: ['State', 'Jurisdiction'], check_type: ['CheckType', 'WWCType'], check_number: ['WWCNumber', 'CheckNumber'], check_expires: ['WWCExpiryDate', 'CheckExpires'] },
};
const STAGE_MAP = { enquiry: 'enquiry', enquired: 'enquiry', tour: 'tour', toured: 'tour', applied: 'applied', application: 'applied', interview: 'interview', offered: 'offered', offer: 'offered', accepted: 'accepted', enrolled: 'enrolled', declined: 'declined', withdrawn: 'withdrawn', cancelled: 'withdrawn' };

function normDate(v, what) {
  const s = String(v || '').trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return date(s.slice(0, 10), what);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); // Synergetic reports print day/month/year
  if (m) return date(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`, what);
  throw Error(`${what}: "${s}" is not a date (use YYYY-MM-DD or DD/MM/YYYY)`);
}
function yearLevel(v) {
  const s = String(v || '').trim().toUpperCase();
  if (['K', 'KG', 'KINDY', 'KINDERGARTEN', 'P', 'PREP', 'R', 'RECEPTION', '0'].includes(s)) return 0;
  const n = Number(s.replace(/^Y(EAR)?\s*/, ''));
  if (!Number.isInteger(n) || n < 0 || n > 13) throw Error(`year level "${v}" is not 0 to 13`);
  return n;
}
function mapRow(kind, row) {
  const out = {};
  for (const [field, names] of Object.entries(IMPORT_COLUMNS[kind])) out[field] = pick(row, ...names);
  if ((kind === 'students' || kind === 'contacts') && !out.name) out.name = [out.given, out.surname].filter(Boolean).join(' ');
  delete out.given; delete out.surname;
  return out;
}

const canon = (r) => JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]));
export async function importSynergetic(db, o) {
  const dir = path.resolve(required(o.dir, 'dir'));
  const source = o.source ? String(o.source) : 'synergetic';
  const files = Object.keys(IMPORT_COLUMNS).filter((k) => fs.existsSync(path.join(dir, `${k}.csv`)));
  if (!files.length) throw Error(`No CSV files in ${dir}. Expected any of: ${Object.keys(IMPORT_COLUMNS).map((k) => k + '.csv').join(', ')}`);
  const summary = { source, dry_run: !!o['dry-run'], added: {}, unchanged: {}, files };
  await db.exec('BEGIN');
  try {
    for (const kind of ['families', 'contacts', 'students', 'staff', 'enquiries', 'debtors']) {
      if (!files.includes(kind)) continue;
      const rows = parseCsv(fs.readFileSync(path.join(dir, `${kind}.csv`), 'utf8'));
      summary.added[kind] = 0; summary.unchanged[kind] = 0;
      for (const [i, raw] of rows.entries()) {
        const where = `${kind}.csv row ${i + 2}`;
        const r = mapRow(kind, raw);
        const code = kind === 'debtors' ? `OPEN-${required(r.family, where + ' family')}` : r.code;
        if (!code) throw Error(`${where}: no ID column`);
        const prior = (await db.query('select original from import_records where source = $1 and kind = $2 and code = $3', [source, kind, code]))[0];
        if (prior) {
          if (canon(prior.original) === canon(raw)) { summary.unchanged[kind]++; continue; }
          throw Error(`${where}: ${code} was imported before with different values. Nothing was saved. Update it with a command instead.`);
        }
        let rec;
        const fam = async () => { const f = (await db.query('select id from families where code = $1', [required(r.family, where + ' family')]))[0]; if (!f) throw Error(`${where}: family ${r.family} is not in families.csv or the database`); return f.id; };
        if (kind === 'families') {
          const status = /past|left|former/i.test(r.status) ? 'past' : 'current';
          [rec] = await db.query('insert into families (code, name, billing_email, phone, address, status) values ($1, $2, $3, $4, $5, $6) returning id', [code, required(r.name, where + ' name'), r.billing_email || null, r.phone || null, r.address || null, status]);
        } else if (kind === 'contacts') {
          [rec] = await db.query('insert into contacts (code, family_id, name, relationship, email, phone, receives_billing) values ($1, $2, $3, $4, $5, $6, $7) returning id', [code, await fam(), required(r.name, where + ' name'), r.relationship || 'parent', r.email || null, r.phone || null, ['y', 'yes', 'true', '1'].includes(String(r.receives_billing).toLowerCase())]);
        } else if (kind === 'students') {
          const status = /left|past|former/i.test(r.status) ? 'left' : /future/i.test(r.status) ? 'future' : 'enrolled';
          [rec] = await db.query('insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id', [code, await fam(), required(r.name, where + ' name'), normDate(r.date_of_birth, where + ' birth date'), yearLevel(r.year_level), r.house || null, status, normDate(r.entry_date, where + ' entry date')]);
        } else if (kind === 'staff') {
          [rec] = await db.query('insert into staff (code, name, role, kind, jurisdiction, check_type, check_number, check_expires) values ($1, $2, $3, $4, $5, $6, $7, $8) returning id', [code, required(r.name, where + ' name'), r.role || 'staff', ['volunteer', 'contractor'].includes(String(r.kind).toLowerCase()) ? String(r.kind).toLowerCase() : 'staff', required(r.jurisdiction, where + ' state'), r.check_type || 'Working With Children Check', r.check_number || null, normDate(r.check_expires, where + ' check expiry')]);
        } else if (kind === 'enquiries') {
          const stage = STAGE_MAP[String(r.stage).trim().toLowerCase()] || 'enquiry';
          [rec] = await db.query('insert into enquiries (code, child_name, parent_name, email, phone, entry_year, entry_level, stage, enquired_on, last_contact_on) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9) returning id', [code, required(r.child_name, where + ' student name'), required(r.parent_name, where + ' parent name'), r.email || null, r.phone || null, int(r.entry_year, where + ' entry year', 2000, 2100), yearLevel(r.entry_level), stage, normDate(r.enquired_on, where + ' enquiry date') || today()]);
        } else if (kind === 'debtors') {
          const amount = cents(r.balance, where + ' balance');
          const due = normDate(r.due_on, where + ' due date') || today();
          [rec] = await db.query("insert into invoices (code, family_id, period, issued_on, due_on, note) values ($1, $2, 'OPENING', $3, $3, 'Opening balance brought across from Synergetic') returning id", [code, await fam(), due]);
          await db.query('insert into invoice_lines (invoice_id, description, amount_cents) values ($1, $2, $3)', [rec.id, 'Opening balance from Synergetic', amount]);
        }
        await db.query('insert into import_records (source, kind, code, record_id, original) values ($1, $2, $3, $4, $5)', [source, kind, code, rec.id, JSON.stringify(raw)]);
        await audit(db, actorOf(o), kind, rec.id, 'import ' + source, null, raw);
        summary.added[kind]++;
      }
    }
    await db.exec(o['dry-run'] ? 'ROLLBACK' : 'COMMIT');
  } catch (e) {
    await db.exec('ROLLBACK');
    throw e;
  }
  return summary;
}

// ---------------------------------------------------------------- export

const csvCell = (v) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export async function exportAll(db, o) {
  const dir = path.resolve(o.dir && o.dir !== true ? String(o.dir) : path.join(process.env.OUTPUT_DIR || REPO_ROOT, 'exports'));
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const out = {};
  for (const t of ['families', 'contacts', 'students', 'enquiries', 'fee_items', 'invoices', 'invoice_lines', 'payments', 'payment_plans', 'attendance', 'care_alerts', 'staff', 'excursions', 'consents', 'gifts', 'settings']) {
    const rows = await db.query(`select * from ${t}`);
    const cols = rows.length ? Object.keys(rows[0]) : [];
    fs.writeFileSync(path.join(dir, `${t}.csv`), [cols.join(','), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(','))].join('\r\n') + '\r\n', { mode: 0o600 });
    out[t] = rows.length;
  }
  return { dir, tables: out };
}

// ---------------------------------------------------------------- drafts (never sent)

function writeDraft(name, text) {
  const dir = path.resolve(process.env.OUTPUT_DIR || REPO_ROOT, 'drafts');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const file = path.join(dir, `${today()}-${name}.md`);
  fs.writeFileSync(file, text, { mode: 0o600 });
  return file;
}
const schoolName = () => { try { return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'brand.json'), 'utf8')).business_name || 'the school'; } catch { return 'the school'; } };

async function draftFeeReminder(db, o, a) {
  const d = await family(db, a);
  if (!(d.balance.balance_cents > 0)) throw Error(`${d.family.name} has no balance owing`);
  const cur = d.balance.currency;
  const billing = d.contacts.find((c) => c.receives_billing) || d.contacts[0];
  const lines = d.outstanding.map((i) => `- ${i.period} (invoice ${i.code}, due ${i.due_on}): ${money(i.outstanding_cents, cur)} outstanding`).join('\n');
  const plan = d.plans.find((p) => p.status === 'active');
  const text = `To: ${billing?.email || d.family.billing_email || '(no billing email on file)'}
Subject: ${d.family.name} family account

Dear ${billing?.name || d.family.name + ' family'},

Our records show ${money(d.balance.balance_cents, cur)} outstanding on the ${d.family.name} family account:

${lines}

${plan ? `Thank you for the payment plan of ${money(plan.instalment_cents, cur)} ${plan.frequency}. The instalments received so far are on your account. Please let the bursar know if the plan needs to change.` : 'If you have already paid, thank you, and please send us the payment reference so we can match it. If you would like to arrange a payment plan, reply to this email and the bursar will set one up with you.'}

Kind regards,
The Bursar
${schoolName()}
`;
  return { file: writeDraft(`fee-reminder-${d.family.code}`, text), family: d.family.code, balance_cents: d.balance.balance_cents };
}

async function draftAbsenceLetter(db, o, a) {
  const s = await resolve(db, 'students', a[0]);
  const rows = await db.query('select on_date, status from unexplained_absences where code = $1 order by on_date', [s.code]);
  if (!rows.length) throw Error(`${s.name} has no unexplained absences`);
  const fam = (await db.query('select f.name, f.billing_email, (select c.name from contacts c where c.family_id = f.id and c.lives_with_student order by c.receives_billing desc, c.code limit 1) as contact from families f where f.id = $1', [s.family_id]))[0];
  const text = `To: ${fam.billing_email || '(no email on file)'}
Subject: Explanation needed for ${s.name}'s absence

Dear ${fam.contact || fam.name + ' family'},

We have no explanation on file for ${s.name} on these days:

${rows.map((r) => `- ${r.on_date} (${r.status})`).join('\n')}

Please reply with the reason for each day, or call the school office. If ${s.name.split(' ')[0]} was unwell, a short note is enough.

Kind regards,
Student Services
${schoolName()}
`;
  return { file: writeDraft(`absence-${s.code}`, text), student: s.code, days: rows.length };
}

async function draftOfferLetter(db, o, a) {
  const e = await resolve(db, 'enquiries', a[0]);
  if (!['interview', 'offered'].includes(e.stage)) throw Error(`${e.code} is at ${e.stage}. Draft an offer at interview or offered.`);
  const fee = (await db.query("select name, amount_cents, (select currency from setting_values) as currency from fee_items where active and category = 'tuition' and $1 between year_from and year_to order by year_from limit 1", [e.entry_level]))[0];
  const expires = e.offer_expires_on || (o['offer-expires'] ? date(o['offer-expires'], 'offer-expires') : null);
  const level = e.entry_level === 0 ? 'Kindergarten' : `Year ${e.entry_level}`;
  const text = `To: ${e.email || '(no email on file)'}
Subject: Offer of a place for ${e.child_name}, ${level} ${e.entry_year}

Dear ${e.parent_name},

We are delighted to offer ${e.child_name} a place in ${level} at ${schoolName()} from the start of ${e.entry_year}.

${expires ? `To accept, please return the acceptance form by ${expires}.` : 'To accept, please return the acceptance form by the date the enrolments office gives you.'}${fee ? ` Current tuition for this year group is ${money(fee.amount_cents, fee.currency)} a term (${fee.name}). Fees for ${e.entry_year} are confirmed in the fee schedule.` : ''}

We look forward to welcoming ${e.child_name.split(' ')[0]} and your family.

Kind regards,
Enrolments
${schoolName()}
`;
  return { file: writeDraft(`offer-${e.code}`, text), enquiry: e.code };
}

// ---------------------------------------------------------------- dispatch

const HELP = [
  ['families | students | enquiries | pipeline | waitlist', 'the community, enrolments and year group places'],
  ['family <name> | student <name>', 'one record with balance, contacts, care alerts and attendance'],
  ['fees | invoices | payments | payment-plans | debtors', 'fee schedule, billing and who owes what, aged'],
  ['absences | attendance', 'unexplained absences and term attendance rates'],
  ['care | staff-checks | excursions | consent-gaps', 'care plans, Working With Children Checks and consent'],
  ['gifts | appeals | lapsed-donors', 'the development office'],
  ['attention | compliance | weekly-review', 'what needs a person this week'],
  ['add <kind> --field=value', 'add a family, contact, student, enquiry, staff, excursion, care, gift, fee or plan'],
  ['move-enquiry <enquiry> --stage=', 'move an enquiry along (offered needs --offer-expires)'],
  ['enrol <enquiry> [--family=]', 'turn an accepted enquiry into a future student'],
  ['mark-absence <student> [--date= --status=] | explain-absence <student> --date= --reason= --by=', 'attendance'],
  ['record-payment <family> --amount= [--date= --method= --ref=]', 'a payment received (this records, it does not charge)'],
  ['fee-run --period=2027-T1 [--issued=] [--dry-run]', 'the termly invoices with sibling discounts'],
  ['record-check <staff> --number= --expires= | record-consent <excursion> <student> --by=', 'checks and consent'],
  ['set <key> <value> | settings', 'the school\'s operating settings'],
  ['import synergetic --dir= [--dry-run] | export [--dir=]', 'bring records in, take everything out'],
  ['draft-fee-reminder <family> | draft-absence-letter <student> | draft-offer-letter <enquiry>', 'drafts to drafts/, never sent'],
  ['activity | import-history', 'who changed what'],
];

export async function run(db, cmd, o = {}, a = []) {
  if (reads[cmd]) return db.query(reads[cmd]);
  switch (cmd) {
    case 'family': return family(db, a);
    case 'student': return student(db, a);
    case 'weekly-review': return weeklyReview(db);
    case 'add': return add(db, a[0], o);
    case 'move-enquiry': return moveEnquiry(db, o, a);
    case 'enrol': return enrol(db, o, a);
    case 'mark-absence': return markAbsence(db, o, a);
    case 'explain-absence': return explainAbsence(db, o, a);
    case 'record-payment': return recordPayment(db, o, a);
    case 'fee-run': return feeRun(db, o);
    case 'record-check': return recordCheck(db, o, a);
    case 'record-consent': return recordConsent(db, o, a);
    case 'set': return setSetting(db, o, a);
    case 'import': if (a[0] !== 'synergetic') throw Error('Usage: import synergetic --dir=<folder of CSVs>'); return importSynergetic(db, o);
    case 'export': return exportAll(db, o);
    case 'draft-fee-reminder': return draftFeeReminder(db, o, a);
    case 'draft-absence-letter': return draftAbsenceLetter(db, o, a);
    case 'draft-offer-letter': return draftOfferLetter(db, o, a);
    case 'help': return HELP.map(([command, what]) => ({ command, what }));
    default: throw Error(`Unknown command "${cmd}". Run: npm run school -- help`);
  }
}

export function parseArgs(argv) {
  const o = {}, a = [];
  for (const arg of argv) {
    const m = arg.match(/^--([^=]+)(?:=(.*))?$/s);
    if (m) o[m[1]] = m[2] === undefined ? true : m[2];
    else a.push(arg);
  }
  return { cmd: a.shift() || 'help', o, a };
}

function show(rows) {
  if (!Array.isArray(rows)) return console.log(JSON.stringify(rows, null, 2));
  if (!rows.length) return console.log('  (none)');
  const keys = Object.keys(rows[0]).filter((k) => !['currency', 'id', 'created_at', 'updated_at'].includes(k) && !k.endsWith('_id'));
  console.log(textTable(rows, keys.map((k) => ({
    key: k, label: k.replace(/_cents$/, ''), width: 48,
    align: /_cents$|_pct$|days|^places|^confirmed|^offers|^in_pipeline|^siblings|enrolled|students|consents|outstanding|^gifts$|^donors$/.test(k) ? 'right' : 'left',
    format: k.endsWith('_cents') ? (v, r) => (v === null || v === undefined ? '' : money(v, r.currency || 'AUD')) : (v) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : v instanceof Date ? v.toISOString().slice(0, 10) : v),
  }))));
}

function print(cmd, result) {
  if (cmd === 'help') return console.log(['npm run school -- <command> [--json]', '', ...result.map((r) => `  ${r.command}\n      ${r.what}`)].join('\n'));
  if (Array.isArray(result)) return show(result);
  if (cmd === 'fee-run') {
    console.log(heading(`Fee run ${result.period}${result.dry_run ? ' (dry run, nothing saved)' : ''}`));
    return show(result.invoices.map((i) => ({ code: i.code, family: i.family, due_on: i.due_on || '', lines: i.lines.length, total_cents: i.total_cents, note: i.skipped || '' })));
  }
  if (result && typeof result === 'object' && Object.values(result).some(Array.isArray)) {
    for (const [k, v] of Object.entries(result)) {
      console.log(heading(k.replace(/_/g, ' ')));
      if (Array.isArray(v)) show(v);
      else if (v && typeof v === 'object') show([v]);
      else console.log('  ' + v);
    }
    return;
  }
  if (result && result.file) return console.log(`draft: ${path.relative(process.cwd(), result.file)} (not sent)`);
  console.log(JSON.stringify(result, null, 2));
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMain) {
  const { cmd, o, a } = parseArgs(process.argv.slice(2));
  const db = await getDb();
  try {
    const result = await run(db, cmd, o, a);
    if (o.json) console.log(JSON.stringify(result, null, 2));
    else print(cmd, result);
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exitCode = 1;
  } finally {
    await db.close();
  }
}
