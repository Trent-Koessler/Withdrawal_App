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
| `sw.js` | Service worker: network-first with a 5 s timeout, falling back to cache. |
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
| AUTH-06 | `script.js` (`buildPlanSummary`), `index.html` `#regimens` | Copies the rendered regimen, monitoring, escalation and thiamine plan. |
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
