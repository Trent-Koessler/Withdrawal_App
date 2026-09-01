# Implementation Notes — SUDtoolkit revision

Companion to `SUDTOOLKIT_REVISION_SPEC.md`. Records the repo survey required by
**SURVEY-01** and maps each spec task ID to the file and function it actually
touches, correcting the spec's file-path guesses where they were wrong.

Nothing in this file is clinical guidance. Clinical decisions still outstanding
are tracked as `TODO(clinical):` markers in the source and are listed by
`npm run check:todos`.

---

## 1. Repo survey (SURVEY-01)

### 1.1 Shape of the app

Vanilla, build-step-free PWA served straight from the repo root by GitHub Pages.

| File | Role |
|---|---|
| `index.html` | Every page of the app. Pages are `<div class="page">` siblings inside `<main id="main-content">`; only one carries `.active-page`. All content is hardcoded HTML except the flowchart, the regimen panel, and the calculators. |
| `style.css` | Source of truth for styling. **Inlined into `index.html`** by `tools/build-css.py` — see §1.7. |
| `script.js` | All behaviour. One big `DOMContentLoaded` handler; no modules other than the three data imports. |
| `data/flowchart.js` | `FLOWCHART_LOGIC` — the triage decision tree. |
| `data/regimens.js` | `REGIMEN_CONFIG` — the alcohol inpatient benzodiazepine regimens. |
| `data/scales.js` | `SCALES` — every calculator. |
| `sw.js` | Service worker: cache-first from one release snapshot — see §7 for why it is no longer network-first. |
| `test/clinical.test.js` | `node:test` suite, run by `npm test` and by CI on every push. |

There are **no runtime dependencies and no build step** other than the CSS
inliner. `package.json` exists only so the data modules can be unit tested.

### 1.2 Where the alcohol regimen content lives

Split across two places, which matters for almost every P0 task:

- **`data/regimens.js`** holds the four severity sets as data, keyed
  `REGIMEN_CONFIG[benzo][severity]` where `benzo` is `"Diazepam"` or
  `"Oxazepam"` and `severity` is `mild | moderate | severe | unknown`. Each
  entry has `{ title, schedule[], prn[] }`; `mild` additionally has a
  `symptom_triggered` block. `schedule` entries are either `{dose, freq}`
  objects (rendered as "Day N: …") or free-text strings.
- **`index.html` → `#regimens` tab** holds the severity selector buttons, the
  shared header paragraphs (the 6-hour gate, the sedation rule, the delayed
  commencement warning) and an empty `<div id="regimen-display">`.

`script.js → updateRegimenDisplay()` renders the selected `REGIMEN_CONFIG`
entry into `#regimen-display`. **The four tabs are data-driven objects**, so
regimen changes are data changes; the surrounding header text is hardcoded HTML.

> Spec said "alcohol inpatient regimens, Severe tab". Actual: `data/regimens.js`
> for the dosing, `index.html` `#regimens` for the framing text.

### 1.3 Diazepam/oxazepam toggle — **swaps a content set, does not convert** ✅

**This is the finding that scopes `P0-05`.** `REGIMEN_CONFIG` contains two
fully independent, hand-authored content sets. `updateRegimenDisplay()` reads
`REGIMEN_CONFIG[selectedBenzo]` and renders it verbatim — there is no ×3
arithmetic anywhere in `script.js`.

Consequence: the dangerous oxazepam numbers the spec worried about are **already
committed to the repo as literal values**, not generated. Specifically
`REGIMEN_CONFIG.Oxazepam.severe.schedule[0]` reads "Loading Dose: 60mg hourly
until sedated or total dose reaches 240mg". So `P0-05` is a *content* fix in
`data/regimens.js`, not a conversion-logic fix — but it is not merely cosmetic
either, because the rendering loop has no concept of "this cell has no regimen".
A `routing` shape had to be added to the renderer so a cell can present advice
instead of a schedule.

### 1.4 Flowchart

Fully data-driven: `FLOWCHART_LOGIC` is a flat map of node id → node. Nodes are
`type: 'question'` (with `options[].next_step`) or `type: 'outcome'` (with
`emr_summary` and optional `guideline_link` / `ambulatory_guideline_link`).
`script.js → renderFlowchartStep()` walks it and maintains `flowchartHistory`
for breadcrumbs. Adding or re-wiring a step is a pure data change; the test
suite already asserts every `next_step` resolves and every node is reachable.

### 1.5 Scale calculators — one shared component ✅

`script.js → setupCalculator(config)` clones the hidden
`#calculator-template` in `index.html` once per entry in `SCALES`, injects
radio fieldsets, and wires score/severity/EMR-summary/copy/reset. Every scale
goes through it, so **a caveat added to the template or to `setupCalculator`
appears in every calculator at once** — this is what makes `AUTH-05` cheap.

Each scale supports `note` (italic line under the title), `reference`, and
`relatedPage`. `AUTH-05` adds a `caveats` field rather than overloading `note`,
because `note` is scale-specific usage text and the caveats are largely shared.

### 1.6 "Other Substances" content — **code change, not data** ⚠️

Each substance is a hardcoded `<div class="page">` in `index.html`
(`#opioid-withdrawal-page`, `#benzo-withdrawal-page`, …) plus a `big-button`
with `data-page="…"` on `#other-syndromes-page`. Adding a substance therefore
means editing `index.html` in two places. There is no substance registry.

This revision does **not** introduce one — that would be a rewrite rather than
a revision — but it does extract the two pieces of content that were genuinely
duplicated across substance pages into shared data modules rendered by
`script.js` into placeholder elements:

- `data/symptomatic.js` → `<div data-symptomatic="opioid">` (`P2-08`)
- `data/harm-reduction.js` → `<div data-harm-reduction="opioid">` (`P2-06`)

### 1.7 Service worker / cache manifest

`sw.js` holds a hand-maintained `urlsToCache` array. **Any new file that the
app fetches at runtime must be added there or it breaks offline use.** In
practice that means new `data/*.js` modules; new HTML content inside
`index.html` needs nothing, and `style.css` is deliberately absent because it is
inlined.

Two guards already exist in `test/clinical.test.js` and were relied on
throughout this work:

- every ES module imported by `script.js` must appear in `urlsToCache`;
- every precached path must exist on disk.

`CACHE_NAME` must be bumped on every content release or installed users keep
being served the old shell.

**`style.css` is not requested at runtime.** `tools/build-css.py` inlines it
into the `<!-- BEGIN style.css -->` … `<!-- END style.css -->` region of
`index.html`, because the NSW Health web filter answers 403 for a separate
stylesheet request. **Edit `style.css`, then run
`python3 tools/build-css.py`.** `npm test` fails if the two drift.

### 1.8 Existing versioning / changelog / review metadata

Before this revision: almost none.

- `APP_VERSION` in `script.js`, `version` in `package.json`, `CACHE_NAME` in
  `sw.js` — three hand-maintained strings, with a test asserting the first two
  match. The About page renders `APP_VERSION` into `<span class="app-version">`,
  so the "currently-empty version field" in `AUTH-02` is empty only at rest; it
  is populated at runtime. The real gap was **no per-section review metadata and
  no changelog**.
- No content ownership, review dates, or reviewer attribution anywhere.
- `docs/FOUC-DIAGNOSIS.md` is the only prior doc, and is unrelated.

`AUTH-02` adds `data/content-meta.js`, `CHANGELOG.md` and a user-facing
changelog/review page.

---

## 2. Conventions established

### 2.1 Source tags (`AUTH-01`)

Implemented as CSS classes in `style.css`, not ad-hoc markup:

```html
<span class="src-tag src-nswcg">NSWCG §5.4.4</span>
<span class="src-tag src-local">LOCAL — rationale: …</span>
```

| Class | Meaning | Chip |
|---|---|---|
| `src-nswcg` | Directly from NSW Clinical Guidance, with section number | Grey |
| `src-nswcg-adapted` | Based on NSWCG, modified locally — carries a rationale | Blue |
| `src-local` | Local practice, not in any published guideline — carries a rationale | Amber |
| `src-other` | Another named guideline | Grey, italic source name |

The tag text lives in the DOM as real text (not a CSS `content:` string), so it
survives copy/paste and printing; `@media print` forces a visible border on
each chip. A test asserts no `src-local` or `src-nswcg-adapted` chip ships
without the word "rationale".

### 2.2 TODO markers

- `TODO(clinical): <question>` — needs Dr Koessler's decision.
- `TODO(review): <item>` — needs external clinical review sign-off.

Both are authored as HTML comments (so they never render to clinicians) and are
surfaced by `npm run check:todos` (`tools/check-todos.py`), which prints every
marker with its file and line. It exits 0 by default (these are expected to
exist during the revision) and exits 1 under `--strict`, which is how a
production build should invoke it. CI runs the warning form.

---

## 3. Task → file map

Where the spec's guess was wrong, the actual location is given in bold.

### P0

| Task | Files touched | Notes |
|---|---|---|
| P0-01 | `data/regimens.js` | Severe schedule rewritten; hands over on Day 2. Spec said "Severe tab" — the tab is only a button; **the text is in `data/regimens.js`**. |
| P0-02 | `index.html` `#regimens`, `#prerequisites` | 6-hour gate replaced with an interpretation caveat. |
| P0-03 | `index.html` `#ambulatory-selection`, `#ambulatory-protocol` | 8-hour rule stated at initiation. No "6 hours" existed on the ambulatory pathway; the distinctness the spec asks for is now explicit rather than accidental. |
| P0-04 | `index.html` `#regimens` | Escalation block sits **above** `#regimen-display`, so it renders on all four tabs by construction rather than being repeated four times in data. |
| P0-05 | `data/regimens.js`, `script.js` (`updateRegimenDisplay`) | New `routing` regimen shape; oxazepam loading removed entirely. |
| P0-06 | `index.html` `#contacts-page` + every inline DASAS mention | Metro number added with `tel:` links. |
| P0-07 | `index.html` `#thiamine` | IV preferred over IM. |
| P0-08 | `index.html` `#special-cases`, `data/regimens.js` severe PRN | Two-stage ladder, surfaced in the Severe tab itself. |

### P1

| Task | Files touched | Notes |
|---|---|---|
| P1-01 | `index.html` `#regimens` (new severity button), `data/regimens.js` (new `symptom` severity key) | Added as a `regimen-severity-btn`, not a fifth `.tab-button`: the four "tabs" the spec refers to are severity buttons inside the single `#regimens` tab. The selector now has six. |
| P1-02 | `data/regimens.js`, `index.html` | AWS bands alongside every CIWA-Ar band. |
| P1-03 | `index.html` `#regimens` | Monitoring table. |
| P1-04 | `data/regimens.js` (`submild` severity) | Both options ship — supportive care only, and a halved schedule — with `TODO(clinical):` on which should be the default. |
| P1-05 | `index.html` `#regimens` | Risk modifiers; drink count tagged `LOCAL`. |
| P1-06 | `data/regimens.js` | 2-hourly, with the hourly option retained as an explicitly-tagged local variant. |
| P1-07 | `data/regimens.js` severe (setting block first), `index.html` `#special-cases` | |
| P1-08 | `index.html` `#special-cases` | Delirium / seizure / CAL content. |
| P1-09 | `data/regimens.js` unknown | `LOCAL` tag + rationale + reduced test dose. |
| P1-10 | `index.html` `#regimens`, `#ambulatory-meds` | Staged supply at discharge. |

### P2

| Task | Files touched | Notes |
|---|---|---|
| P2-01 | `index.html` (new `#gabapentinoid-withdrawal-page` + button), `data/symptomatic.js` | |
| P2-02 | `index.html` `#ghb-withdrawal-page` | |
| P2-03 | `index.html` `#benzo-withdrawal-page` | Equivalence table also exported from `data/benzo-equivalence.js` so HyperTaper can consume one source. |
| P2-04 | `index.html` (new `#assessment-page` + home button) | |
| P2-05 | `index.html` (new `#continuing-care-page`) | |
| P2-06 | `data/harm-reduction.js`, `script.js`, `index.html` placeholders | |
| P2-07 | `index.html` (new `#bbv-sti-page`), `#contacts-page` | |
| P2-08 | `data/symptomatic.js`, `script.js`, `index.html` placeholders | Replaces four hand-maintained lists. |
| P2-09 | `index.html` `#opioid-withdrawal-page` | |
| P2-10 | `index.html` `#stimulant-withdrawal-page`, `data/scales.js` (AWQ caveat) | |
| P2-11 | `index.html` `#cannabis-withdrawal-page` | |
| P2-12 | `index.html` (new `#populations-page`), `#std-drinks` prompts | |
| P2-13 | `index.html` (new `#screening-page`) | |
| P2-14 | `index.html` `#std-drinks` | Consumption-history method paired with the calculator. |

### P3

| Task | Files touched | Notes |
|---|---|---|
| AUTH-01 | `style.css` → rebuilt into `index.html`; retrofit across pages | |
| AUTH-02 | `data/content-meta.js`, `CHANGELOG.md`, `index.html` (`#changelog-page`), `script.js` | |
| AUTH-03 | `index.html` (`#contributors-page`) | |
| AUTH-04 | `index.html` (`#sources-page`), `#about-page` copyright | |
| AUTH-05 | `data/scales.js` (`caveats`), `script.js` (`setupCalculator`) | Rendered inside each calculator, above the results grid. |
| AUTH-06 | `script.js` (`buildRegimenSummary`), `index.html` `#regimens` | Superseded in 0.4.1 — see §6. Originally copied the rendered regimen, monitoring, escalation and thiamine plan with source tags bracketed inline. |
| AUTH-07 | `index.html` (`#capacity-page`) | Scaffold only — every clinical/legal statement is a `TODO(clinical):`. |

---

## 4. What shipped

Every task in the spec is implemented. Summary of the end state:

- **41 commits**, one per task ID, in the order SURVEY-01, AUTH-01, P0, P1, P2, P3.
- **226 source tags**: 205 `NSWCG`, 13 `LOCAL`, 5 `NSWCG-adapted`, 3 `OTHER`.
- **17 `TODO(clinical)`** and **5 `TODO(review)`** markers outstanding, all
  listed by `npm run check:todos`.
- **Test suite grown from 29 to 215 assertions** across four files:
  - `test/clinical.test.js` — the pre-existing characterisation tests, updated
    where a shape changed (the `routing` cell, the new severities).
  - `test/alcohol-safety.test.js` — new. One `describe` per P0/P1 task,
    asserting the defect cannot return.
  - `test/content.test.js` — new. Coverage assertions for the P2/P3 content.
  - `test/provenance.test.js` — new. The rules of the tagging convention.
- **New data modules**: `symptomatic.js`, `harm-reduction.js`,
  `benzo-equivalence.js`, `content-meta.js`. All four added to the service
  worker precache list; `CACHE_NAME` bumped to v27 and the app version to
  0.4.0 across all three hand-maintained strings.
- **New pages**: assessment, screening, populations, capacity (scaffold),
  continuing care, BBV/STI, gabapentinoids, sources, contributors, changelog.
- **New regimen severities**: sub-mild and symptom-triggered, taking the
  selector from four to six.

Verified in Chromium at 390 px in both themes: every page activates and
renders, no page scrolls horizontally, every calculator builds, all twelve
benzodiazepine × severity cells render, and there are no console errors.

---

## 5. Deviations from the spec, and why

1. **"Four tabs" / "fifth tab" (P0-04, P1-01).** The alcohol regimens are not
   four tabs — they are four severity *buttons* inside one `#regimens` tab.
   The escalation block is therefore placed once, above `#regimen-display`,
   which is strictly better than the spec's "repeat on all four tabs": it
   cannot drift between tabs, and it also covers the two new severities.
2. **P0-05 scope.** Reduced from "fix the conversion logic" to "fix the
   authored oxazepam content + add a routing shape", per §1.3.
3. **AUTH-01 ordering.** The spec lists it under P3 but calls it a
   prerequisite. It was implemented **first**, before P0, so P0 content could
   be tagged as it was written rather than retrofitted twice.
4. **No clinical numbers were invented.** Every dose, threshold and interval
   added came from the spec text. Where the spec left a decision open, the
   content carries a `TODO(clinical):` and the app either states the
   uncertainty or offers both options — it does not pick one silently.
5. **P2 build order.** The spec says "build in this order". Three tasks were
   moved earlier because later ones depend on them: `P2-08` (shared
   symptomatic table) and `P2-06` (shared harm reduction) before `P2-01`,
   which consumes both; and `P2-05`, `P2-07`, `P2-13` before `P2-04`, which
   links to all three. Building `P2-04` first would have shipped a commit
   with dangling navigation, which the existing `data-page` test correctly
   rejects.
6. **Where existing content conflicted with NSWCG, both are shown.** Two
   cases: the buprenorphine COWS threshold (NSWCG 8 vs the site's >12) and
   the loading rate (NSWCG 2-hourly vs the site's hourly). Neither was
   silently overwritten. Both are tagged, the trade-off is stated at the
   point of use, and a `TODO(clinical):` records the decision.
7. **Carried-forward content with no established source is tagged `LOCAL`,
   not left bare.** Six symptomatic medication entries (metoclopramide,
   ondansetron, hyoscine butylbromide, loperamide, paracetamol/ibuprofen,
   promethazine) were in the app before this revision with no citation. They
   are unchanged in dose but now say their provenance is unconfirmed, with a
   `TODO(review):` to establish it. Giving them an NSWCG tag they had not
   earned would have been the easier and worse option.

---

## 6. 0.4.1 — regimen presentation and the EMR export

Bedside feedback after the revision: the symptom-triggered regimen would not
paste into an EMR field, and the plan export was too long to use. Both are
presentation problems, and neither is fixed by changing what the app says.

**Symptom-triggered dosing is a list.** The four-column
`CIWA-Ar | AWS | Dose | Monitoring` table became pipe-separated rows in a
plain-text field. It is now one line per band. `symptomTriggeredTable` became
`symptomTriggeredBands`, and a test asserts no cell carries a `table` again.

**One scale at a time, chosen on the Regimens tab.** Every band previously
rendered both scales, doubling the width of the line a nurse reads at the drug
chart. Bands are now stored as `{ ciwa, aws }` threshold pairs with no scale
name in them — the renderer supplies the label — and a toggle picks which is
shown. Two guards keep the original P1-02 invariant intact: a band must carry
both thresholds, and a threshold must not bake in a scale name.

The toggle is scoped to the Regimens tab. The Monitoring tab still shows both
scales, because its table *is* the mapping between them. The AWS band caveat
still renders on the fixed schedules under either selection: AWS 4-14 spans
both, and hiding CIWA-Ar makes that more important to state, not less.

**PRN under AWS.** The Mild-Mod PRN triggers (CIWA-Ar 10-15 → 10mg,
15-20 → 20mg) are both AWS 4-14. Rendering that band twice at two doses would
be unfollowable, so under AWS the CIWA-Ar sub-band is named alongside it.

**The export is a prescribing block.** `buildPlanSummary` scraped seven blocks
out of the DOM — about 120 lines, 9,300 characters. `buildRegimenSummary`
builds from `REGIMEN_CONFIG` and emits 10-17 lines: the doses, how often to
score, the 2-hourly floor, the withhold-if-sedated caution, and the 24-hour
review total. Everything else stays on the page.

Three consequences worth naming:

1. **Citations are dropped from every EMR paste, not bracketed.** This reverses
   the AUTH-06 decision. The reasoning that survives: the app is the source of
   record, and a block read at a drug chart is not audited from the paste.
2. **The tail lines are suppressed where the regimen already states them.** The
   severe cell sets its own 2-hourly interval and its own 80mg review point;
   appending generic versions underneath would read as two different rules.
3. **The preview rebuilds with the panel.** Previously the textarea was filled
   on click, and a routing cell returned before filling it — so switching to
   severe/oxazepam left the previous regimen's doses in the box.

Not done, and deliberately: the scale choice is not persisted between visits
(it resets to CIWA-Ar on load), and the selected severity and benzodiazepine
buttons still have no active-state styling — the new scale toggle does.

### 6.1 Phone layout

The app is read on a ward phone. Four fixes, all in `style.css` except where
noted:

**The severity selector was six flex children with `flex: 1; min-width: 0`.**
That combination never wraps — it compresses. Measured at 412px: each button
47px wide, all six clipping their labels mid-word. It is now a grid: two
columns on a phone, three from 600px, six from 992px. Nothing clips at any
width, because `overflow-wrap: break-word` is on the button rather than being
implied by the layout.

**Nothing showed which regimen or drug was selected.** `.regimen-severity-btn`
and `.benzo-choice-btn` had no `.active` rule at all — the only signal was the
heading below the selector, which is off-screen on a phone once you have
scrolled to the doses. Both now take the same filled treatment as the scale
toggle.

**The footer disclaimer was 130px — a seventh of a phone screen, on every
page.** It is a `<details>` collapsed to one line, opened by `matchMedia` at
768px and above (`script.js`). CSS cannot do this: `open` is not settable from
CSS, and a closed `<details>` is not laid out even if its children are forced
visible — verified in Chromium before writing the script.

**Tab strips clipped their last label with no affordance.** The pure-CSS
scroll-shadow technique (`background-attachment: local` covering layers over
`scroll` shadow layers) does not work here: the tab buttons are opaque and
paint over the container's background. It is a mask on the strip instead,
toggled by `.can-scroll-left` / `.can-scroll-right`, which `script.js` sets
from the real scroll position via a `scroll` listener and a `ResizeObserver` —
the observer matters because a strip inside a hidden page has no width to
measure until its page is shown. The two longest inpatient tab labels also
carry a short form for widths below 768px, swapped with `display`, so only one
is ever in the accessibility tree.

---

## 7. 0.4.2 — the app could run two releases at once

Reported from a phone: the 0.4.1 selector was on screen, the AWS button did
nothing, the symptom-triggered regimen was still a table, and the EMR export
was still the whole-tab version with bracketed citations. The footer read
"Version 0.4.0".

That combination is diagnostic rather than confusing. The collapsed footer
disclaimer only exists in 0.4.1's `index.html`; `APP_VERSION`, the
`=== REGIMEN ===` export and the dose table all come from `script.js` and
`data/regimens.js`. So the page was running **new markup with old code** — not
a failed deploy, and not a bug in the 0.4.1 work.

**Cause.** `sw.js` was network-first *per request* with a 5s timeout. The
decision was taken independently for every file, so a fast, small `index.html`
could come from the network while `script.js` exceeded the timeout and fell
back to the previous release's cache. Nothing anywhere checked that the files
agreed. For a clinical tool this is the worst failure mode available: it does
not look broken, it looks like the app, and the doses shown are a release out
of date.

**Fix, in two layers.**

1. *Cache-first from one snapshot.* Everything in a cache was fetched by one
   install, so serving only from the current `CACHE_NAME` makes a mixed load
   structurally impossible. Nothing is written into the cache outside install —
   an opportunistic `cache.put` at fetch time is exactly how a snapshot stops
   being one version. Updates arrive the standard way: changed `sw.js` → new
   cache name → precache the release → `skipWaiting` → `clients.claim` → the
   next load is entirely the new version.
2. *Check rather than trust.* `index.html` carries `<meta name="app-build">`
   and `script.js` publishes `window.SUD_BUILD` before it can throw. A guard in
   the HTML compares them after load. The guard lives in the markup because the
   markup is the file that arrives fresh in a skew — recovery cannot depend on
   the script that may be the stale one. It asks the worker to update and
   reloads once; if the mismatch survives, it shows a banner. It does **not**
   clear caches: offline, that trades a mismatched app for no app.

Verified by simulation rather than by reasoning: serving `origin/main` until its
worker was in control, deploying 0.4.2 over the top, and reloading three times —
every load was a single consistent release. And by serving 0.4.2's HTML with
`origin/main`'s `script.js` deliberately: one retry, then the banner, no loop.

Four tests now pin this: the four version strings agree, the build is published
before startup, and the fetch path contains no `cache.put`.

## 8. 0.5.1 — the access gate and the usage log

The trial needs two things the app did not have: a boundary saying the app is
for clinicians, and a record of how it is actually used. Both shipped together
because they share a decision.

### 8.1 Why the gate is inside the app, not in front of it

The obvious answer was Cloudflare Access, and it was wrong twice over.

Its free tier is 50 seats, and a seat is consumed on any authentication and
held until manually removed — so the meter counts everyone who has *ever*
logged in. Past 50 the choice is blocking the 51st clinician or $7 per user per
month with no cap. For an audience meant to grow across an LHD, both are the
wrong failure.

The second reason survives any pricing change. `sw.js` is cache-first and
answers every navigation from the cached shell (§1.7). After the first install
the app never asks the network for permission again, so **any gate at the edge
runs exactly once per device and then goes quiet** — and reports no logins at
all, which defeats the other half of the purpose. Netlify, Vercel and a Worker
sitting in front of the site all have this same shape.

So the gate is in the app: it re-checks on launch, works with no signal, and is
the only place that can emit a countable event.

### 8.2 Three questions, remembered for three different lengths of time

| | Asks about | Remembered? |
| --- | --- | --- |
| Password | the **device** — was the app given to it | once, in `localStorage` |
| Attestation | the **person** holding it — are they qualified | never, every launch |
| Role and location | the person **and the moment** — who, where, now | asked every launch, last answers pre-selected |

The attestation's per-launch behaviour predates this release and the comment
above `#disclaimer-modal` explains why: a ward terminal has more than one user,
and a stored attestation would speak for people who never gave it. This release
added storage right next to it, so `access.test.js` asserts the acceptance
handler still persists nothing of the attestation itself.

Role and location sit in the middle, and the pre-selection is the whole design.
Ask them fresh every time and a clinician on their own phone pays a tax for
data they already gave; store them silently and a night registrar's ED session
is filed under whoever set the device up. Pre-selected but visible costs the
common case one glance and lets the uncommon case correct itself.

The panel to show is chosen by an inline script before first paint, next to the
theme script. Deciding it in `script.js` would flash the password prompt on
every launch for a device that is already set up, which reads as "it forgot me".

### 8.3 What the password is, and what it is not

One shared password for the district, stored as a SHA-256 in
`data/access-config.js` and set by `tools/set-password.py`.

Be exact about what the hash buys. A shared word falls to a dictionary attack
immediately, and it will be on a ward whiteboard within a week. It keeps the app
out of a search result and makes entry a deliberate act. It is **not** protecting
anything — nothing in this app is patient data, and the content is
guideline-derived reference material. Anyone describing this as securing
something has misread it.

It also identifies no site, which is why role and location are asked at all: with
a shared credential they are the only grouping variables the study has, and they
are self-reported. That is a limitation for the write-up, not a defect.

Normalisation (fold case, drop spaces and punctuation) exists in two languages,
so a test runs the Python and the JavaScript over the same inputs and compares.
Divergence would break the password for everyone at once with no symptom beyond
"it says my password is wrong".

Changing the password does not re-prompt devices already unlocked: the stored
flag is "unlocked", not the password. That is deliberate — a password rotation
should not lock out the whole district mid-shift — but it does mean a rotation
only affects new devices.

### 8.4 Why events are queued rather than sent

A real share of ward use happens with no signal. Sending directly would produce
a dataset showing only the clinicians who happened to be near an access point —
the opposite of the finding the project exists to test. So `metrics.js` writes to
a bounded `localStorage` queue and drains it on reconnect, and the `queued` flag
survives to the database because the online/offline split is itself a result.

Three consequences that each cost a bug before they were understood:

1. **Role and location belong on the event, not the upload.** The queue is in
   `localStorage`, so it is shared by every tab and outlives the launch that
   wrote it. An event recorded by a registrar in ED is routinely uploaded by
   whoever opens the app next. Stamping at flush time reassigned it to them —
   silently, on exactly the shared ward terminal this design exists for. Each
   event now carries the context it happened in, and the worker validates per
   event.
2. **Resends are normal, not exceptional.** A flush that succeeded on the server
   but died before the response arrived is the ordinary case on hospital wifi.
   Every event carries a `crypto.randomUUID()` and the worker uses
   `INSERT OR IGNORE` against a `UNIQUE` column, so a resend lands as zero rows
   rather than a second copy. Without that the denominator is a guess.
3. **Nothing is recorded until `ENDPOINT` is set.** Not sent — *recorded*. An
   empty endpoint makes `record()` return immediately rather than queue. If it
   queued, the day collection was switched on would upload a backlog from before
   anyone was told the app was being monitored.

`scale_complete` fires on the first scoring interaction per calculator per
launch. "All items answered" is not detectable — every fieldset starts with its
zero option selected — so the operational definition is "this clinician scored
this patient on this scale". Abandonment is derived in analysis (a scales
`page_view` with no `scale_complete`) rather than instrumented.

### 8.5 What is deliberately not collected

No IP addresses, no user agents, no names, no emails, no scores, nothing typed
into a calculator. `detail` is a fixed vocabulary of page and scale ids, and the
worker drops anything not matching it — enforcement in two places, so widening
what is collected takes a deliberate change in both. `device_id` is a random
per-install identifier: pseudonymous, not anonymous, and the ethics application
should say so rather than calling it anonymous.

Verified end to end rather than by reasoning: the app served locally against the
real worker code and driven through first unlock, a wrong password, a correct one
typed in lower case with spaces, both dropdowns left unanswered, a relaunch with
the answers pre-selected and then corrected, going offline mid-session, and
reconnecting — checking at each step what reached the database and what the queue
still held. Both bugs in §8.4.1 and the invisible validation message were found
that way, not by review.
