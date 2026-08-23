# Reviewer document generator

Builds `docs/website-text-for-clinical-review.docx`: every word of clinical text
on the site, laid out so a reviewing clinician can read it away from the app and
mark each statement accurate or not.

```bash
npm install docx        # not a runtime dependency; only this tool needs it
./tools/review-doc/build.sh
```

## Why it is generated rather than written

Most of the site's clinical content does not exist as fixed text anywhere. The
dosing schedules, the calculator items, the severity band beside a score, the
flowchart branches and the symptomatic tables are all assembled at run time from
`data/*.js`. A reviewer reading `index.html` would not see them, and a document
typed out by hand would start drifting from the site the day it was written.

So the document is rebuilt from the same sources the app renders from:

| Script | Reads | Produces |
|---|---|---|
| `extract_html.py` | `index.html` | verbatim text of the static clinical pages |
| `dump.mjs` | `data/*.js` | the clinical data modules as JSON |
| `severity.mjs` | `data/scales.js` | severity bands, by evaluating `severityLogic` across every attainable score |
| `flatten_data.py` | the two above | the generated content, expanded to plain text |
| `build_docx.cjs` | all of the above | the Word document |

`severity.mjs` exists because the band shown next to a calculator total is
produced by a function, not stored as data. Exporting the module drops it, and
the thresholds it encodes — where moderate becomes severe — are exactly the kind
of thing a review has to catch. Evaluating it over `0..max` recovers them.

## What is included

Every clinical page: the alcohol flowchart, inpatient and ambulatory alcohol
withdrawal, all eight other-substance pages, the scales and calculators,
screening, BBV/STI actions, specific populations, capacity and consent,
continuing care, and contacts. The diagnostic-criteria pop-up and the
intended-use gate are appendices, because both make clinical claims.

Navigation and interface wording is left out — button labels, menu items, and
the About, Sources, Contributors and Changelog pages.

## Reference numbers

Each item carries a stable reference (`INP-014`, `SCALE-032`) that reviewers
quote back. Numbering follows document order per page, so **inserting content
renumbers everything after it**. When a review is already out with clinicians,
finish that round before rebuilding, or the numbers in their feedback will point
at the wrong statements.

## Checking a rebuild

`build_docx.cjs` prints the item count per page prefix. The extractors print
their block counts. If a content change lands and a page's count moves in a way
the change does not explain, something was dropped — the likeliest cause is a
new field in `data/*.js` that `flatten_data.py` does not know to render.
