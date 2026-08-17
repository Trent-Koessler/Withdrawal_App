# Changelog

Clinical changes are listed first in each release. They are the ones that
change what a clinician does; everything else is housekeeping.

The user-facing version of this lives at `#changelog-page` in the app.

## 0.4.2 — August 2026

A caching defect that let one page load mix two releases, and a guard so it
cannot happen silently again. No clinical content changed.

### Safety — these alter clinical meaning

| Change | Why |
|---|---|
| The service worker serves one release at a time (cache-first from the snapshot it installed) instead of deciding network-vs-cache per file. | Per-file network-first meant a single page load could take `index.html` from the network and `script.js` from the previous release's cache, because that one request exceeded the 5s timeout. The app then rendered the new markup against old code: controls that were present but wired to nothing, and the previous release's dosing content. Observed on a ward phone — new selector visible, old CIWA/AWS table and old EMR export beneath it. |
| `index.html` and `script.js` each declare their release, and the app checks they match on load. | The mismatch above rendered as a working app. It now retries the update once and, if still mismatched, says so in a banner rather than presenting stale dosing content as current. |
| A precached file whose content type does not match its URL is rejected at install. | Previously only checked when caching a live response; a web filter's HTML block page could be precached under `script.js`. |

### Infrastructure

- Cache name, `APP_VERSION`, `package.json` and the new `app-build` meta move
  together, with tests asserting all four agree and that the fetch path never
  writes into the release snapshot.
- Recovery deliberately does **not** clear caches: offline, that would trade a
  mismatched app for no app at all.

## 0.4.1 — August 2026

How the inpatient alcohol regimens are presented, and what the EMR copy
exports. No dose, band threshold or monitoring frequency changed.

### Safety — these alter clinical meaning

| Change | Why |
|---|---|
| Symptom-triggered dosing renders as a list, one line per band, instead of a four-column CIWA-Ar/AWS table. | The table was the block clinicians paste into the EMR, where it degraded into pipe-separated rows. |
| The Regimens tab carries a CIWA-Ar / AWS toggle; bands, PRN triggers and the EMR copy render in the selected scale only. | Showing every band in both scales was clutter at the drug chart. Both thresholds are still held in the data — the toggle picks a view, and a test asserts no band can exist in one scale alone. |
| Under AWS, the two Mild-Mod PRN triggers name their CIWA-Ar sub-band as well. | NSWCG's AWS mapping is coarser than the CIWA-Ar split this app uses, so both triggers sit in AWS 4-14 at different doses. Rendering "AWS 4-14" twice with two doses would be an instruction a nurse cannot follow. |
| The EMR copy exports a prescribing block (~10-17 lines) rather than the whole tab (~120 lines): doses, scoring frequency, the 2-hourly dosing floor, the withhold-if-sedated caution, and the 24-hour review total. | The whole-tab export was too long to paste, so the parts that matter at the drug chart were buried. Band selection, escalation, discharge and thiamine remain on the page. |
| Source tags are no longer carried into any EMR paste. | Reverses part of AUTH-06. The app is the source of record; a prescribing block is read at the drug chart, not audited. |
| Advice held in a cell's PRN slot (the test-dose protocol's monitoring instructions) is headed "Additional advice", not "PRN dosing". | The old heading read as an instruction to give something. |

### Readability on a phone

The app is mostly read on a ward phone, and the inpatient tab did not fit one.

- **The severity selector is a grid**, two columns on a phone and three on a
  tablet. Six equal flex children never wrapped — they compressed, leaving each
  button 47px wide with its band label cut mid-word.
- **The selected regimen and the selected benzodiazepine now look selected.**
  Neither had any active state; on a phone, once scrolled to the doses, nothing
  on screen said which regimen was showing.
- **The footer disclaimer collapses to one line on a phone**, expanding on tap,
  and opens automatically on a wider screen. It was taking 130px — a seventh of
  the screen — on every page. Wording unchanged.
- **Tab strips fade at whichever edge has more tabs**, so a clipped label reads
  as "scroll this way" rather than as broken text. The two longest inpatient tab
  labels also shorten below 768px.

### Infrastructure

- The EMR export is built from `REGIMEN_CONFIG` rather than scraped from the
  rendered page, and the preview textarea is rebuilt whenever drug, severity or
  scale changes — a routing cell previously left the previous regimen's doses
  sitting in the box.
- Band thresholds moved into the data as `{ ciwa, aws }` pairs without scale
  names, so a band cannot render under the wrong scale's label.
- The three safety sentences in the paste live in `EMR_SAFETY_LINES`, with a
  test asserting they still match the statements on the page.

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
- **AUTH-06** The EMR copy function exports a whole plan, with source tags intact. *(Superseded in 0.4.1: the export is now a short prescribing block and drops citations.)*
- **AUTH-07** Capacity, consent and involuntary pathways scaffolded — deliberately not written.

### Not resolved

Seventeen `TODO(clinical)` decisions are outstanding and are listed by
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
