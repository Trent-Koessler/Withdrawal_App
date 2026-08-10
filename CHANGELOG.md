# Changelog

Clinical changes are listed first in each release. They are the ones that
change what a clinician does; everything else is housekeeping.

The user-facing version of this lives at `#changelog-page` in the app.

## 0.4.0 — August 2026

Revision against NSW Health, *Management of Withdrawal from Alcohol and Other
Drugs: Clinical Guidance* (August 2022, SHPN (CAOD) 220739), referred to below
as NSWCG. Task IDs refer to `SUDTOOLKIT_REVISION_SPEC.md`; see
`IMPLEMENTATION_NOTES.md` for the survey and the task-to-file map.

### Safety — these alter clinical meaning

| Task | Change |
|---|---|
| P0-01 | The Severe alcohol regimen no longer stacks a second 80 mg day behind the loading dose. The loading day is Day 1; handover is on Day 2, preferably to symptom-triggered dosing, or to the Mod-Sev schedule at its **Day 2** row. |
| P0-02 | The 6-hour gate before starting CIWA-Ar or benzodiazepines is removed and replaced with guidance on interpreting an early score. Withdrawal may begin before the BAL reaches zero, and the gate made the Severe band unreachable. |
| P0-03 | The ambulatory pathway states the NSWCG App 6 initiation rule: intoxication or consumption within 8 hours contraindicates commencing that day. |
| P0-04 | Escalation and de-escalation triggers added. The regimens previously had entry points and no exit criteria. |
| P0-05 | Oxazepam loading removed entirely. Severe + oxazepam routes to titration (15-30 mg) and specialist advice instead of rendering a 240 mg load. Converted schedules carry a conversion caveat. |
| P0-06 | DASAS Sydney metropolitan number **(02) 8382 1006** added everywhere the regional 1800 number appeared. |
| P0-07 | Thiamine prefers IV over IM, given alcohol-associated thrombocytopenia and coagulopathy. |
| P0-08 | 80 mg diazepam presented as a medical officer review threshold rather than a ceiling, with the 120 mg maximum above it and specialist advice above that. |
| P1-06 | Loading rate aligned to 2-hourly. Hourly loading retained but restricted to monitored settings and tagged LOCAL. |
| P2-08 | Psychostimulant symptomatic medications now carry daily maxima; the opioid clonidine regimen corrected to 75-150 microgram 6-8 hourly with its test-dose protocol. |

### New clinical content

- **P1-01** Symptom-triggered alcohol regimen, previously absent.
- **P1-04** Sub-mild option for CIWA-Ar < 10.
- **P1-02, P1-03** AWS bands throughout; monitoring frequency table, observation set and minimum investigations.
- **P1-05** NSWCG risk factors as band modifiers.
- **P1-07, P1-08** Setting decisions moved to the top of the Severe regimen; delirium, seizure and severe chronic airflow limitation content built out.
- **P1-09** Test-dose protocol refined and labelled as local.
- **P1-10** Staged supply where the taper is incomplete at discharge.
- **P2-01** Gabapentinoid withdrawal page.
- **P2-02** GHB expanded from a stub to a management pathway.
- **P2-03** Benzodiazepine framework: ODDE, equivalence table, unplanned inpatient withdrawal, taper rate, UDS interpretation.
- **P2-04** "Before you prescribe" — assessment, risk, confidentiality, planning, principles.
- **P2-05** Continuing care and relapse-prevention pharmacotherapy.
- **P2-06** Harm reduction on every substance page.
- **P2-07** BBV/STI results-to-actions table.
- **P2-09, P2-10, P2-11** Opioid, psychostimulant and cannabis pathways built out.
- **P2-12** Specific population groups.
- **P2-13, P2-14** Screening, and a consumption history method beside the standard drinks calculator.

### Authority and provenance

- **AUTH-01** Source tags on every clinical statement: NSWCG, NSWCG-adapted, LOCAL, OTHER. Local and adapted content states its rationale. `npm run check:todos` surfaces every unresolved clinical decision.
- **AUTH-02** Per-page review metadata, this changelog, and a user-facing changelog page.
- **AUTH-03** Contributors and clinical review register.
- **AUTH-04** Sources and attribution page; the copyright notice now covers original content and site code rather than derived clinical material.
- **AUTH-05** Scale caveats rendered inside each calculator, above the score.
- **AUTH-06** The EMR copy function exports a whole plan, with source tags intact.
- **AUTH-07** Capacity, consent and involuntary pathways scaffolded — deliberately not written.

### Not resolved

Fourteen `TODO(clinical)` decisions are outstanding and are listed by
`npm run check:todos`. The most consequential:

- Which Day 2 handover should be the default after a loading day.
- Whether hourly loading should be retained at all.
- Which sub-mild option should be the default.
- The buprenorphine COWS threshold: NSWCG says 8, this site has used >12.
  Both currently ship, tagged.
- How an AWS-only ward should choose between the two fixed schedules.

### Infrastructure

- Version, `package.json` and the service worker cache name bumped in step.
- New data modules (`symptomatic`, `harm-reduction`, `benzo-equivalence`,
  `content-meta`) added to the service worker precache list; a test asserts
  every imported module is precached, or offline use would break.
- Test suite grown from 29 to 200+ assertions, including safety invariants
  that must fail if a P0 defect is reintroduced.

## 0.3.2 and earlier

Offline mode, disclaimer gate and back-button routing fixes; clinical data
extracted into testable modules with a CI-gated test suite; stylesheet inlined
so the NSW Health web filter cannot break the app; application icon rebuilt
from vector; renamed to SUD Toolkit.
