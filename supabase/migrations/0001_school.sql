-- School Admin for Claude Code: the community database, enrolments, fees, attendance,
-- care alerts, staff checks, excursion consent and fundraising for an independent school.
-- Plain Postgres. Runs on PostgreSQL 14+ and PGlite. Money is integer cents.

create or replace function touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- Operating settings the school controls (sibling discounts, the absence explanation window).
create table settings (
  key text primary key,
  value text not null,
  note text not null default '',
  updated_at timestamptz not null default now()
);

create table families (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  billing_email text,
  phone text,
  address text,
  status text not null default 'current' check (status in ('current', 'past', 'prospective')),
  payment_terms_days int not null default 14 check (payment_terms_days between 0 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_id uuid not null references families(id),
  name text not null,
  relationship text not null default 'parent',
  email text,
  phone text,
  receives_billing boolean not null default false,
  lives_with_student boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_id uuid not null references families(id),
  name text not null,
  date_of_birth date,
  year_level int not null check (year_level between 0 and 13),
  house text,
  status text not null default 'enrolled' check (status in ('enrolled', 'left', 'future')),
  entry_date date,
  exit_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Future students: every enquiry from first contact to an enrolled student.
create table enquiries (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  child_name text not null,
  parent_name text not null,
  email text,
  phone text,
  entry_year int not null check (entry_year between 2000 and 2100),
  entry_level int not null check (entry_level between 0 and 13),
  stage text not null default 'enquiry' check (stage in ('enquiry', 'tour', 'applied', 'interview', 'offered', 'accepted', 'enrolled', 'declined', 'withdrawn')),
  sibling_family_id uuid references families(id),
  source text,
  enquired_on date not null default current_date,
  last_contact_on date,
  next_step text,
  next_step_due date,
  offer_expires_on date,
  student_id uuid references students(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table year_places (
  entry_year int not null,
  year_level int not null check (year_level between 0 and 13),
  places int not null check (places >= 0),
  primary key (entry_year, year_level)
);

-- Fees and debtors.
create table fee_items (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category text not null check (category in ('tuition', 'levy', 'activity', 'other')),
  year_from int not null default 0,
  year_to int not null default 13,
  per text not null default 'term' check (per in ('term', 'year', 'once')),
  basis text not null default 'student' check (basis in ('student', 'family')),
  amount_cents bigint not null check (amount_cents >= 0),
  gst_free boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (year_from <= year_to)
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_id uuid not null references families(id),
  period text not null,
  issued_on date not null,
  due_on date not null,
  status text not null default 'issued' check (status in ('issued', 'void')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, period)
);

create table invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id),
  student_id uuid references students(id),
  fee_item_id uuid references fee_items(id),
  description text not null,
  amount_cents bigint not null,
  gst_free boolean not null default true,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_id uuid not null references families(id),
  received_on date not null,
  amount_cents bigint not null check (amount_cents > 0),
  method text not null default 'bank transfer',
  reference text,
  created_at timestamptz not null default now()
);

create table payment_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  family_id uuid not null references families(id),
  instalment_cents bigint not null check (instalment_cents > 0),
  frequency text not null check (frequency in ('weekly', 'fortnightly', 'monthly')),
  starts_on date not null,
  status text not null default 'active' check (status in ('active', 'ended')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Attendance: one row per student per school day that is not a plain present.
create table attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id),
  on_date date not null,
  status text not null check (status in ('present', 'absent', 'late', 'partial')),
  reason text,
  explained boolean not null default false,
  explained_on date,
  explained_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, on_date)
);

create table school_days (
  on_date date primary key,
  term text not null
);

create table care_alerts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_id uuid not null references students(id),
  kind text not null check (kind in ('anaphylaxis', 'asthma', 'medical', 'custody', 'learning', 'other')),
  detail text not null,
  action_plan_on date,
  review_due date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Staff, volunteers and contractors who work with students, and their safety checks.
create table staff (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  role text not null,
  kind text not null default 'staff' check (kind in ('staff', 'volunteer', 'contractor')),
  jurisdiction text not null,
  check_type text not null,
  check_number text,
  check_expires date,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table excursions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  on_date date not null,
  year_level int not null check (year_level between 0 and 13),
  staff_lead_id uuid references staff(id),
  consent_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table consents (
  excursion_id uuid not null references excursions(id),
  student_id uuid not null references students(id),
  status text not null check (status in ('given', 'declined')),
  given_by text,
  given_on date not null default current_date,
  primary key (excursion_id, student_id)
);

-- Development office: gifts and appeals.
create table gifts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  donor_name text not null,
  family_id uuid references families(id),
  appeal text not null,
  amount_cents bigint not null check (amount_cents > 0),
  received_on date not null,
  receipt_number text,
  tax_deductible boolean not null default true,
  created_at timestamptz not null default now()
);

create table audit (
  id bigserial primary key,
  actor text not null,
  kind text not null,
  record_id text,
  operation text not null,
  before_record jsonb,
  after_record jsonb,
  created_at timestamptz not null default now()
);

create table import_records (
  id bigserial primary key,
  source text not null,
  kind text not null,
  code text not null,
  record_id text not null,
  original jsonb not null,
  created_at timestamptz not null default now(),
  unique (source, kind, code)
);

create trigger families_touch before update on families for each row execute function touch_updated_at();
create trigger contacts_touch before update on contacts for each row execute function touch_updated_at();
create trigger students_touch before update on students for each row execute function touch_updated_at();
create trigger enquiries_touch before update on enquiries for each row execute function touch_updated_at();
create trigger fee_items_touch before update on fee_items for each row execute function touch_updated_at();
create trigger invoices_touch before update on invoices for each row execute function touch_updated_at();
create trigger plans_touch before update on payment_plans for each row execute function touch_updated_at();
create trigger attendance_touch before update on attendance for each row execute function touch_updated_at();
create trigger care_touch before update on care_alerts for each row execute function touch_updated_at();
create trigger staff_touch before update on staff for each row execute function touch_updated_at();
create trigger excursions_touch before update on excursions for each row execute function touch_updated_at();

create index on students (family_id);
create index on invoices (family_id);
create index on invoice_lines (invoice_id);
create index on payments (family_id);
create index on attendance (on_date);
create index on enquiries (entry_year, entry_level);

-- ------------------------------------------------------------------ views

create view setting_values as
select
  coalesce((select value::int from settings where key = 'absence_explanation_days'), 7) as absence_explanation_days,
  coalesce((select value::int from settings where key = 'attendance_threshold_pct'), 90) as attendance_threshold_pct,
  coalesce((select value::int from settings where key = 'check_warning_days'), 60) as check_warning_days,
  coalesce((select value::int from settings where key = 'care_review_warning_days'), 30) as care_review_warning_days,
  coalesce((select value::int from settings where key = 'enquiry_quiet_days'), 14) as enquiry_quiet_days,
  coalesce((select value from settings where key = 'currency'), 'AUD') as currency;

create view invoice_totals as
select i.id, i.code, i.family_id, i.period, i.issued_on, i.due_on, i.status,
  coalesce(sum(l.amount_cents), 0)::bigint as total_cents
from invoices i left join invoice_lines l on l.invoice_id = i.id
group by i.id;

-- Payments clear the oldest invoice first, so every invoice has its own outstanding amount.
create view invoice_outstanding as
with paid as (
  select family_id, sum(amount_cents)::bigint as paid_cents from payments group by family_id
), running as (
  select t.*, coalesce(p.paid_cents, 0) as paid_cents,
    sum(t.total_cents) over (partition by t.family_id order by t.due_on, t.code rows unbounded preceding) as cumulative_cents
  from invoice_totals t left join paid p on p.family_id = t.family_id
  where t.status = 'issued'
)
select id, code, family_id, period, issued_on, due_on, total_cents,
  greatest(0, least(total_cents, cumulative_cents - paid_cents))::bigint as outstanding_cents,
  greatest(0, current_date - due_on) as days_overdue
from running;

create view family_balances as
select f.id as family_id, f.code, f.name, f.status,
  coalesce((select sum(total_cents) from invoice_totals t where t.family_id = f.id and t.status = 'issued'), 0)::bigint as invoiced_cents,
  coalesce((select sum(amount_cents) from payments p where p.family_id = f.id), 0)::bigint as paid_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id), 0)::bigint as balance_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id and o.days_overdue = 0), 0)::bigint as current_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id and o.days_overdue between 1 and 30), 0)::bigint as overdue_1_30_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id and o.days_overdue between 31 and 60), 0)::bigint as overdue_31_60_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id and o.days_overdue between 61 and 90), 0)::bigint as overdue_61_90_cents,
  coalesce((select sum(outstanding_cents) from invoice_outstanding o where o.family_id = f.id and o.days_overdue > 90), 0)::bigint as overdue_90_plus_cents,
  (select max(days_overdue) from invoice_outstanding o where o.family_id = f.id and o.outstanding_cents > 0) as oldest_days_overdue,
  (select max(received_on) from payments p where p.family_id = f.id) as last_payment_on,
  exists (select 1 from payment_plans pp where pp.family_id = f.id and pp.status = 'active') as on_payment_plan,
  (select currency from setting_values) as currency
from families f;

create view debtors as
select code, name, balance_cents, overdue_1_30_cents, overdue_31_60_cents, overdue_61_90_cents, overdue_90_plus_cents,
  oldest_days_overdue, last_payment_on, on_payment_plan, currency
from family_balances
where balance_cents > 0 and oldest_days_overdue > 0;

create view term_attendance as
with term_now as (
  select term from school_days where on_date <= current_date order by on_date desc limit 1
), days as (
  select d.on_date from school_days d, term_now t where d.term = t.term and d.on_date <= current_date
)
select s.id as student_id, s.code, s.name, s.year_level,
  (select count(*) from days) as school_days,
  (select count(*) from attendance a join days d on d.on_date = a.on_date where a.student_id = s.id and a.status = 'absent') as days_absent,
  (select count(*) from attendance a join days d on d.on_date = a.on_date where a.student_id = s.id and a.status in ('late', 'partial')) as days_late_or_partial,
  case when (select count(*) from days) = 0 then null else
    round(100.0 * ((select count(*) from days) - (select count(*) from attendance a join days d on d.on_date = a.on_date where a.student_id = s.id and a.status = 'absent')
      - 0.5 * (select count(*) from attendance a join days d on d.on_date = a.on_date where a.student_id = s.id and a.status = 'partial'))
      / (select count(*) from days), 1) end as attendance_pct
from students s
where s.status = 'enrolled';

create view unexplained_absences as
select s.code, s.name, s.year_level, a.on_date, a.status,
  current_date - a.on_date as days_waiting,
  (current_date - a.on_date) > (select absence_explanation_days from setting_values) as past_window,
  f.name as family
from attendance a
join students s on s.id = a.student_id
join families f on f.id = s.family_id
where a.status in ('absent', 'late', 'partial') and not a.explained and s.status = 'enrolled';

create view enquiry_pipeline as
select e.code, e.child_name, e.parent_name, e.entry_year, e.entry_level, e.stage,
  e.sibling_family_id is not null as sibling,
  e.last_contact_on, e.next_step, e.next_step_due, e.offer_expires_on,
  case
    when e.stage = 'offered' and e.offer_expires_on < current_date then 'offer lapsed'
    when e.next_step_due < current_date then 'next step overdue'
    when coalesce(e.last_contact_on, e.enquired_on) < current_date - (select enquiry_quiet_days from setting_values) then 'gone quiet'
    when e.next_step is null then 'no next step'
  end as issue
from enquiries e
where e.stage not in ('enrolled', 'declined', 'withdrawn');

create view waitlist as
with demand as (
  select entry_year, entry_level,
    count(*) filter (where stage in ('accepted', 'enrolled')) as confirmed,
    count(*) filter (where stage = 'offered') as offers_out,
    count(*) filter (where stage in ('enquiry', 'tour', 'applied', 'interview')) as in_pipeline,
    count(*) filter (where stage in ('enquiry', 'tour', 'applied', 'interview') and sibling_family_id is not null) as siblings_waiting
  from enquiries group by entry_year, entry_level
)
select p.entry_year, p.year_level, p.places,
  coalesce(d.confirmed, 0) as confirmed, coalesce(d.offers_out, 0) as offers_out,
  coalesce(d.in_pipeline, 0) as in_pipeline, coalesce(d.siblings_waiting, 0) as siblings_waiting,
  p.places - coalesce(d.confirmed, 0) - coalesce(d.offers_out, 0) as places_left
from year_places p
left join demand d on d.entry_year = p.entry_year and d.entry_level = p.year_level;

create view staff_checks as
select s.code, s.name, s.role, s.kind, s.jurisdiction, s.check_type, s.check_number, s.check_expires,
  case
    when s.check_number is null or s.check_expires is null then 'missing'
    when s.check_expires < current_date then 'expired'
    when s.check_expires <= current_date + (select check_warning_days from setting_values) then 'due soon'
    else 'current'
  end as check_status,
  s.check_expires - current_date as days_left
from staff s
where s.active;

create view care_reviews as
select c.code, st.code as student_code, st.name as student, st.year_level, c.kind, c.detail, c.action_plan_on, c.review_due,
  case
    when c.kind in ('anaphylaxis', 'asthma') and c.action_plan_on is null then 'no action plan on file'
    when c.review_due is null then 'no review date'
    when c.review_due < current_date then 'review overdue'
    when c.review_due <= current_date + (select care_review_warning_days from setting_values) then 'review due soon'
  end as issue
from care_alerts c join students st on st.id = c.student_id
where c.active and st.status = 'enrolled';

create view consent_gaps as
select x.code as excursion, x.name, x.on_date, x.consent_due, s.code as student_code, s.name as student, s.year_level,
  case when x.consent_due < current_date then 'consent overdue' else 'consent outstanding' end as issue
from excursions x
join students s on s.year_level = x.year_level and s.status = 'enrolled'
left join consents c on c.excursion_id = x.id and c.student_id = s.id
where x.on_date >= current_date and c.student_id is null;

create view attention as
select 'fees' as area, code, name as who, 'overdue ' || oldest_days_overdue || ' days' || case when on_payment_plan then ' (on a plan)' else '' end as issue, oldest_days_overdue as days
from debtors
union all
select 'attendance', code, name, 'unexplained ' || status || ' on ' || on_date::text, days_waiting
from unexplained_absences where past_window
union all
select 'attendance', code, name, 'attendance ' || attendance_pct || '% this term', null
from term_attendance, setting_values where attendance_pct < attendance_threshold_pct
union all
select 'enrolments', code, child_name, issue || ' (' || stage || ', ' || entry_year || ' Year ' || entry_level || ')', null
from enquiry_pipeline where issue is not null
union all
select 'staff checks', code, name, check_type || ' ' || check_status, days_left
from staff_checks where check_status <> 'current'
union all
select 'care', student_code, student, kind || ': ' || issue, null
from care_reviews where issue is not null
union all
select 'consent', student_code, student, issue || ' for ' || name || ' on ' || on_date::text, null
from consent_gaps;

-- The rules docs/compliance.md cites, checked against the records.
create view compliance_checks as
select 'CHILD-SAFETY-CHECK' as rule, code, name as who,
  check_type || ' ' || check_status || coalesce(' (' || check_expires::text || ')', '') as finding,
  case check_status when 'expired' then 'breach' when 'missing' then 'breach' else 'due' end as severity
from staff_checks where check_status <> 'current'
union all
select 'ABSENCE-FOLLOW-UP', code, name, 'no explanation for ' || on_date::text || ' after ' || days_waiting || ' days', 'breach'
from unexplained_absences where past_window
union all
select 'ANAPHYLAXIS-PLAN', student_code, student, issue, case when issue in ('no action plan on file', 'review overdue') then 'breach' else 'due' end
from care_reviews where kind in ('anaphylaxis', 'asthma') and issue is not null
union all
select 'EXCURSION-CONSENT', student_code, student, 'no consent for ' || name || ' on ' || on_date::text, case when issue = 'consent overdue' then 'breach' else 'due' end
from consent_gaps
union all
select 'GST-FREE-TUITION', i.code, f.name, 'tuition line marked as taxable: ' || l.description, 'check'
from invoice_lines l join invoices i on i.id = l.invoice_id join families f on f.id = i.family_id
join fee_items fi on fi.id = l.fee_item_id
where fi.category = 'tuition' and not l.gst_free;

create view appeal_totals as
select appeal, count(*) as gifts, count(distinct donor_name) as donors, sum(amount_cents)::bigint as raised_cents,
  max(received_on) as last_gift_on, (select currency from setting_values) as currency
from gifts group by appeal;

-- Donors who gave in the previous twelve to twenty-four months and not in the last twelve.
create view lapsed_donors as
select donor_name, max(received_on) as last_gift_on, sum(amount_cents)::bigint as lifetime_cents, count(*) as gifts,
  (select currency from setting_values) as currency
from gifts
group by donor_name
having max(received_on) < current_date - 365 and max(received_on) >= current_date - 730;
