# Compliance checks

Sources checked 8 November 2026. `/compliance` runs `npm run school -- compliance`, which reads the `compliance_checks` view. Each rule below says where it comes from, what a breach looks like in the records, and what the check does not do.

Nothing here is legal advice. The school's principal and registration authority decide what applies. The defaults are set for a New South Wales independent school; change them with `npm run school -- set <key> <value>` or `/customise`.

## CHILD-SAFETY-CHECK: Working With Children Checks

Source: [NSW Office of the Children's Guardian, Role of an employer](https://ocg.nsw.gov.au/working-children-check/organisation/role-employer). Employers in child-related work verify a worker's or volunteer's clearance online, keep a record of the verification, and verify again when the check is renewed. In the education sector a clearance number is required. The Department of Education's information for applicants says a clearance is valid for five years unless cancelled. Under the [Child Protection (Working with Children) Act 2012 (NSW)](https://legislation.nsw.gov.au/view/html/inforce/current/act-2012-051) the Children's Guardian can cancel a clearance at any time, so a future expiry date is not proof a clearance is still current: online verification is.

What the check finds: active staff, volunteers and contractors with no check number or expiry recorded (breach), an expiry date that has passed (breach), and an expiry within `check_warning_days` (60 by default, due).

Other jurisdictions: record the right `check_type` and `jurisdiction` per person (Victoria's Working with Children Check, Queensland's blue card). An interstate check does not meet NSW requirements. New Zealand schools record safety checks under the [Children's Act 2014](https://www.legislation.govt.nz/act/public/2014/0040/latest/whole.html) and its regulations, with the periodic re-check date as `check_expires`.

## ABSENCE-FOLLOW-UP: explanations for absences

Source: [NSW Department of Education, School attendance policy (PD-2005-0259)](https://education.nsw.gov.au/policy-library/policies/pd-2005-0259). Parents must explain an absence within 7 calendar days of the first day of the absence; without an explanation the absence is recorded as unjustified. The policy applies to government schools. Non-government schools follow the attendance requirements of their registration with NESA and their own policy; many use the same window, some use 7 school days.

What the check finds: absences, late arrivals and partial days with no explanation recorded that are older than `absence_explanation_days` (7 by default). The window is counted from each recorded day, in calendar days. The check does not decide whether an explanation is accepted: that is the principal's call, recorded in `reason`.

## ANAPHYLAXIS-PLAN: action plans for anaphylaxis and asthma

Source: [ASCIA resources for schools and childcare](https://www.allergy.org.au/schools-childcare). ASCIA's guidance is that a student at risk of anaphylaxis has an ASCIA Action Plan completed by their doctor, kept with their adrenaline injector, and updated when the plan or medication changes.

What the check finds: an active anaphylaxis or asthma alert with no action plan date on file, or a review date that has passed. The review date is the school's own policy (many schools review every year); it is not a legal deadline. This check reads records only. It does not replace the school's anaphylaxis management policy or staff training.

## EXCURSION-CONSENT: consent before an excursion

Source: the school's own excursion policy. Schools ask a parent's written consent before taking a student off site.

What the check finds: enrolled students in an upcoming excursion's year group with no consent recorded. Past the excursion's `consent_due` date it is a breach; before it, it is due. A declined consent clears the gap: the student is not going.

## GST-FREE-TUITION: tuition shown as GST-free

Source: [A New Tax System (Goods and Services Tax) Act 1999, Subdivision 38-C (education)](https://www.legislation.gov.au/C2004A00446/latest/text). Supplies of education courses, including primary and secondary courses, are GST-free.

What the check finds: invoice lines from a tuition fee item that are marked as taxable. Levies, activities and other charges have their own GST treatment: ask your accountant, then set `gst_free` on each fee item.

## Internal rules, not law

The sibling discounts (10% for the second child, 20% for the third), the 90% attendance flag, the 60-day check warning, the 30-day care review warning and the 14-day quiet enquiry rule are demo operating settings. Set your own with `npm run school -- settings` and `set`.

Keep exports, drafts and generated documents private: they contain student, medical and custody information. Collect only the care detail the school needs to keep the student safe.
