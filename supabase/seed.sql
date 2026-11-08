-- Demo data for Harbourside Grammar, a fictional independent school in New South Wales.
-- Every date is relative to today, so the demo always has overdue fees, unexplained absences,
-- an expired staff check, an overdue care review and an enquiry that has gone quiet.
-- Idempotent: a second run does nothing.
do $$
declare
  yr int := extract(year from current_date)::int;
  nxt int := extract(year from current_date)::int + 1;
  f1 uuid; f2 uuid; f3 uuid; f4 uuid; f5 uuid;
  s_linh uuid; s_minh uuid; s_ella uuid; s_mere uuid; s_tama uuid; s_aria uuid; s_chidi uuid; s_finn uuid;
  t_junior uuid; t_middle uuid; t_senior uuid; levy uuid;
  inv uuid;
  st2 uuid;
begin
  if exists (select 1 from families where code = 'FAM-001') then return; end if;

  insert into settings (key, value, note) values
    ('currency', 'AUD', 'Currency shown on statements and reports'),
    ('sibling_discount_2_pct', '10', 'Tuition discount for the second child, eldest pays full tuition'),
    ('sibling_discount_3_pct', '20', 'Tuition discount for the third and later children'),
    ('absence_explanation_days', '7', 'Days a family has to explain an absence before it is followed up'),
    ('attendance_threshold_pct', '90', 'Term attendance below this is flagged for the year coordinator'),
    ('check_warning_days', '60', 'Days before a staff check expires that it shows as due soon'),
    ('care_review_warning_days', '30', 'Days before a care plan review that it shows as due soon'),
    ('enquiry_quiet_days', '14', 'Days without contact before an enquiry counts as gone quiet');

  insert into families (code, name, billing_email, phone, address, status) values
    ('FAM-001', 'Nguyen', 'thao.nguyen@example.com', '0400 111 201', '12 Ferry Rd, Balmain NSW', 'current') returning id into f1;
  insert into families (code, name, billing_email, phone, address, status) values
    ('FAM-002', 'Walker', 'sarah.walker@example.com', '0400 111 202', '4 Ridge St, Rozelle NSW', 'current') returning id into f2;
  insert into families (code, name, billing_email, phone, address, status) values
    ('FAM-003', 'Te Aho', 'hemi.teaho@example.com', '0400 111 203', '88 Darling St, Balmain NSW', 'current') returning id into f3;
  insert into families (code, name, billing_email, phone, address, status) values
    ('FAM-004', 'Okafor', 'ngozi.okafor@example.com', '0400 111 204', '2 Mort Bay Ln, Birchgrove NSW', 'current') returning id into f4;
  insert into families (code, name, billing_email, phone, address, status) values
    ('FAM-005', 'Fraser', 'iain.fraser@example.com', '0400 111 205', '19 Wharf Rd, Annandale NSW', 'past') returning id into f5;

  insert into contacts (code, family_id, name, relationship, email, phone, receives_billing, lives_with_student) values
    ('CON-001', f1, 'Thao Nguyen', 'mother', 'thao.nguyen@example.com', '0400 111 201', true, true),
    ('CON-002', f1, 'Bao Nguyen', 'father', 'bao.nguyen@example.com', '0400 111 211', false, true),
    ('CON-003', f2, 'Sarah Walker', 'mother', 'sarah.walker@example.com', '0400 111 202', true, true),
    ('CON-004', f2, 'Mark Walker', 'father', null, '0400 111 212', false, false),
    ('CON-005', f3, 'Hemi Te Aho', 'father', 'hemi.teaho@example.com', '0400 111 203', true, true),
    ('CON-006', f4, 'Ngozi Okafor', 'mother', 'ngozi.okafor@example.com', '0400 111 204', true, true),
    ('CON-007', f5, 'Iain Fraser', 'father', 'iain.fraser@example.com', '0400 111 205', true, true);

  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-001', f1, 'Linh Nguyen', make_date(yr - 15, 3, 14), 9, 'Banks', 'enrolled', make_date(yr - 3, 1, 30)) returning id into s_linh;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-002', f1, 'Minh Nguyen', make_date(yr - 12, 8, 2), 6, 'Banks', 'enrolled', make_date(yr - 6, 1, 30)) returning id into s_minh;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-003', f2, 'Ella Walker', make_date(yr - 17, 5, 21), 11, 'Cook', 'enrolled', make_date(yr - 5, 1, 30)) returning id into s_ella;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-004', f3, 'Mere Te Aho', make_date(yr - 18, 2, 9), 12, 'Flinders', 'enrolled', make_date(yr - 6, 1, 30)) returning id into s_mere;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-005', f3, 'Tama Te Aho', make_date(yr - 14, 10, 30), 8, 'Flinders', 'enrolled', make_date(yr - 2, 1, 30)) returning id into s_tama;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-006', f3, 'Aria Te Aho', make_date(yr - 9, 6, 17), 3, 'Flinders', 'enrolled', make_date(yr - 3, 1, 30)) returning id into s_aria;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date) values
    ('STU-007', f4, 'Chidi Okafor', make_date(yr - 13, 1, 5), 7, 'Cook', 'enrolled', current_date - 40) returning id into s_chidi;
  insert into students (code, family_id, name, date_of_birth, year_level, house, status, entry_date, exit_date) values
    ('STU-008', f5, 'Finn Fraser', make_date(yr - 11, 4, 11), 5, 'Banks', 'left', make_date(yr - 4, 1, 30), current_date - 120) returning id into s_finn;

  insert into fee_items (code, name, category, year_from, year_to, per, basis, amount_cents, gst_free) values
    ('FEE-TJ', 'Tuition, Kindergarten to Year 6', 'tuition', 0, 6, 'term', 'student', 420000, true) returning id into t_junior;
  insert into fee_items (code, name, category, year_from, year_to, per, basis, amount_cents, gst_free) values
    ('FEE-TM', 'Tuition, Years 7 to 10', 'tuition', 7, 10, 'term', 'student', 560000, true) returning id into t_middle;
  insert into fee_items (code, name, category, year_from, year_to, per, basis, amount_cents, gst_free) values
    ('FEE-TS', 'Tuition, Years 11 and 12', 'tuition', 11, 12, 'term', 'student', 640000, true) returning id into t_senior;
  insert into fee_items (code, name, category, year_from, year_to, per, basis, amount_cents, gst_free) values
    ('FEE-LV', 'Capital levy', 'levy', 0, 12, 'term', 'family', 35000, true) returning id into levy;
  insert into fee_items (code, name, category, year_from, year_to, per, basis, amount_cents, gst_free, active) values
    ('FEE-CAMP', 'Year 9 outdoor camp', 'activity', 9, 9, 'once', 'student', 48000, false, false);

  -- Nguyen: two terms, both paid.
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1001', f1, yr || '-T3', current_date - 89, current_date - 75) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_linh, t_middle, 'Tuition, Years 7 to 10: Linh Nguyen', 560000),
    (inv, s_minh, t_junior, 'Tuition, Kindergarten to Year 6: Minh Nguyen', 420000),
    (inv, s_minh, t_junior, 'Sibling discount 10%: Minh Nguyen', -42000),
    (inv, null, levy, 'Capital levy', 35000);
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1101', f1, yr || '-T4', current_date - 40, current_date - 26) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_linh, t_middle, 'Tuition, Years 7 to 10: Linh Nguyen', 560000),
    (inv, s_minh, t_junior, 'Tuition, Kindergarten to Year 6: Minh Nguyen', 420000),
    (inv, s_minh, t_junior, 'Sibling discount 10%: Minh Nguyen', -42000),
    (inv, null, levy, 'Capital levy', 35000);

  -- Walker: nothing paid on either term.
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1002', f2, yr || '-T3', current_date - 89, current_date - 75) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_ella, t_senior, 'Tuition, Years 11 and 12: Ella Walker', 640000),
    (inv, null, levy, 'Capital levy', 35000);
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1102', f2, yr || '-T4', current_date - 40, current_date - 26) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_ella, t_senior, 'Tuition, Years 11 and 12: Ella Walker', 640000),
    (inv, null, levy, 'Capital levy', 35000);

  -- Te Aho: three children, on a fortnightly plan, behind on this term.
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1003', f3, yr || '-T3', current_date - 89, current_date - 75) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_mere, t_senior, 'Tuition, Years 11 and 12: Mere Te Aho', 640000),
    (inv, s_tama, t_middle, 'Tuition, Years 7 to 10: Tama Te Aho', 560000),
    (inv, s_tama, t_middle, 'Sibling discount 10%: Tama Te Aho', -56000),
    (inv, s_aria, t_junior, 'Tuition, Kindergarten to Year 6: Aria Te Aho', 420000),
    (inv, s_aria, t_junior, 'Sibling discount 20%: Aria Te Aho', -84000),
    (inv, null, levy, 'Capital levy', 35000);
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1103', f3, yr || '-T4', current_date - 40, current_date - 26) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_mere, t_senior, 'Tuition, Years 11 and 12: Mere Te Aho', 640000),
    (inv, s_tama, t_middle, 'Tuition, Years 7 to 10: Tama Te Aho', 560000),
    (inv, s_tama, t_middle, 'Sibling discount 10%: Tama Te Aho', -56000),
    (inv, s_aria, t_junior, 'Tuition, Kindergarten to Year 6: Aria Te Aho', 420000),
    (inv, s_aria, t_junior, 'Sibling discount 20%: Aria Te Aho', -84000),
    (inv, null, levy, 'Capital levy', 35000);

  -- Okafor: joined this term, invoice not yet due.
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-1104', f4, yr || '-T4', current_date - 9, current_date + 5) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_chidi, t_middle, 'Tuition, Years 7 to 10: Chidi Okafor', 560000),
    (inv, null, levy, 'Capital levy', 35000);

  -- Fraser: left the school with a balance.
  insert into invoices (code, family_id, period, issued_on, due_on) values ('INV-0905', f5, yr || '-T2', current_date - 144, current_date - 130) returning id into inv;
  insert into invoice_lines (invoice_id, student_id, fee_item_id, description, amount_cents) values
    (inv, s_finn, t_junior, 'Tuition, Kindergarten to Year 6: Finn Fraser', 420000),
    (inv, null, levy, 'Capital levy', 35000);

  insert into payments (code, family_id, received_on, amount_cents, method, reference) values
    ('PAY-001', f1, current_date - 80, 973000, 'bank transfer', 'NGUYEN T3'),
    ('PAY-002', f1, current_date - 30, 973000, 'bank transfer', 'NGUYEN T4'),
    ('PAY-003', f3, current_date - 76, 1515000, 'bank transfer', 'TE AHO T3'),
    ('PAY-004', f3, current_date - 24, 300000, 'direct debit', 'PLAN TEAHO'),
    ('PAY-005', f3, current_date - 10, 300000, 'direct debit', 'PLAN TEAHO'),
    ('PAY-006', f5, current_date - 128, 200000, 'card', 'FRASER PART');

  insert into payment_plans (code, family_id, instalment_cents, frequency, starts_on, status, note) values
    ('PLAN-01', f3, 300000, 'fortnightly', current_date - 24, 'active', 'Agreed with the bursar after the T3 account was cleared');

  insert into school_days (on_date, term)
  select d::date, yr || '-T4' from generate_series(current_date - 27, current_date, interval '1 day') d
  where extract(isodow from d) < 6;

  insert into attendance (student_id, on_date, status, reason, explained, explained_on, explained_by)
  select s_ella, d.on_date, 'absent', null, false, null, null
  from school_days d where d.on_date between current_date - 13 and current_date - 9 order by d.on_date limit 3;
  insert into attendance (student_id, on_date, status, reason, explained, explained_on, explained_by)
  select s_chidi, max(d.on_date), 'absent', null, false, null, null
  from school_days d where d.on_date <= current_date - 9;
  insert into attendance (student_id, on_date, status, reason, explained, explained_on, explained_by)
  select s_linh, max(d.on_date), 'absent', 'medical appointment', true, max(d.on_date) + 1, 'Thao Nguyen'
  from school_days d where d.on_date <= current_date - 5;
  insert into attendance (student_id, on_date, status, reason, explained, explained_on, explained_by)
  select s_tama, max(d.on_date), 'late', null, false, null, null
  from school_days d where d.on_date <= current_date - 1;

  insert into care_alerts (code, student_id, kind, detail, action_plan_on, review_due) values
    ('CARE-01', s_minh, 'anaphylaxis', 'Peanut and tree nut allergy. Adrenaline injector in the junior school office.', current_date - 400, current_date - 35),
    ('CARE-02', s_aria, 'asthma', 'Asthma, reliever before sport.', null, current_date + 120),
    ('CARE-03', s_ella, 'custody', 'Court order on file: only Sarah Walker may collect Ella. Check with reception before release.', null, current_date + 200),
    ('CARE-04', s_chidi, 'learning', 'Reading support plan, extra time in assessments.', current_date - 30, current_date + 20);

  insert into staff (code, name, role, kind, jurisdiction, check_type, check_number, check_expires) values
    ('STF-01', 'Hannah Brooks', 'Year 9 teacher', 'staff', 'NSW', 'Working With Children Check', 'WWC0123456E', current_date + 400),
    ('STF-03', 'Priya Shah', 'Canteen volunteer', 'volunteer', 'NSW', 'Working With Children Check', 'WWC0345678V', current_date + 40),
    ('STF-04', 'Tom Hale', 'Bus driver', 'contractor', 'NSW', 'Working With Children Check', null, null),
    ('STF-05', 'Rachel Moore', 'Science teacher', 'staff', 'NSW', 'Working With Children Check', 'WWC0456789E', current_date + 900);
  insert into staff (code, name, role, kind, jurisdiction, check_type, check_number, check_expires) values
    ('STF-02', 'Daniel Reyes', 'Rowing coach', 'contractor', 'NSW', 'Working With Children Check', 'WWC0234567E', current_date - 10) returning id into st2;

  insert into excursions (code, name, on_date, year_level, staff_lead_id, consent_due) values
    ('EXC-01', 'Science centre visit', current_date + 6, 9, (select id from staff where code = 'STF-01'), current_date + 2),
    ('EXC-02', 'Biology field trip', current_date + 3, 12, (select id from staff where code = 'STF-05'), current_date - 1),
    ('EXC-03', 'Rowing regatta', current_date + 20, 8, st2, current_date + 14);
  insert into consents (excursion_id, student_id, status, given_by, given_on)
  values ((select id from excursions where code = 'EXC-03'), s_tama, 'given', 'Hemi Te Aho', current_date - 2);

  insert into year_places (entry_year, year_level, places) values (nxt, 0, 22), (nxt, 7, 3), (nxt, 11, 4);

  insert into enquiries (code, child_name, parent_name, email, phone, entry_year, entry_level, stage, sibling_family_id, source, enquired_on, last_contact_on, next_step, next_step_due, offer_expires_on) values
    ('ENQ-001', 'Sophie Martin', 'Claire Martin', 'claire.martin@example.com', '0400 222 301', nxt, 0, 'tour', null, 'open day', current_date - 45, current_date - 20, 'Book a tour', current_date - 6, null),
    ('ENQ-002', 'Oliver Grant', 'James Grant', 'james.grant@example.com', '0400 222 302', nxt, 7, 'applied', null, 'website', current_date - 30, current_date - 3, 'Interview with the Head of Middle School', current_date + 4, null),
    ('ENQ-003', 'Isla Te Aho', 'Hemi Te Aho', 'hemi.teaho@example.com', '0400 111 203', nxt, 0, 'enquiry', f3, 'sibling', current_date - 25, current_date - 25, null, null, null),
    ('ENQ-004', 'Noah Kim', 'Grace Kim', 'grace.kim@example.com', '0400 222 304', nxt, 7, 'offered', null, 'referral', current_date - 70, current_date - 16, 'Wait for acceptance', current_date + 3, current_date - 2),
    ('ENQ-005', 'Zara Patel', 'Anil Patel', 'anil.patel@example.com', '0400 222 305', nxt, 7, 'accepted', null, 'website', current_date - 90, current_date - 8, 'Send uniform and orientation pack', current_date + 10, null),
    ('ENQ-006', 'Leo Brown', 'Kate Brown', 'kate.brown@example.com', '0400 222 306', nxt, 11, 'declined', null, 'agent', current_date - 60, current_date - 40, null, null, null),
    ('ENQ-007', 'Ava Chen', 'Wei Chen', 'wei.chen@example.com', '0400 222 307', nxt, 0, 'interview', null, 'open day', current_date - 21, current_date - 2, 'Orientation morning', current_date + 7, null);

  insert into gifts (code, donor_name, family_id, appeal, amount_cents, received_on, receipt_number, tax_deductible) values
    ('GFT-001', 'Nguyen family', f1, 'Library Building Appeal', 100000, current_date - 30, 'R-2041', true),
    ('GFT-002', 'Margaret Hollis', null, 'Library Building Appeal', 500000, current_date - 60, 'R-2033', true),
    ('GFT-003', 'Te Aho family', f3, 'Annual Giving', 25000, current_date - 20, 'R-2045', true),
    ('GFT-004', 'David Ross', null, 'Annual Giving', 200000, current_date - 500, 'R-1702', true),
    ('GFT-005', 'Fraser family', f5, 'Annual Giving', 50000, current_date - 420, 'R-1760', true),
    ('GFT-006', 'Margaret Hollis', null, 'Annual Giving', 300000, current_date - 400, 'R-1777', true),
    ('GFT-007', 'Walker family', f2, 'Rowing Shed Appeal', 15000, current_date - 300, null, false);
end $$;
