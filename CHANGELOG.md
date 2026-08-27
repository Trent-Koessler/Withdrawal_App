# Changelog

Clinical changes are listed first in each release. They are the ones that
change what a clinician does; everything else is housekeeping.

The user-facing version of this lives at `#changelog-page` in the app.

## 0.4.9 - August 2026

### Clinical

- **Transferring a patient from methadone to buprenorphine has its own page**,
  reached from the pharmacotherapy section of the Opioid Treatment Program page.
  The OTP page already converted a daily sublingual dose to a depot dose; this
  is the other question people ask it, and a different kind of answer - a
  procedure run over a week, with a different drug prescribed on each day of it.
- **The route is selected by the methadone dose**, which is the number the
  prescriber already has: 30mg or less transfers directly, above 40mg and up to
  150mg goes by micro-dosing or by bridging with oxycodone, and above 150mg
  needs specialist advice, a reduction to 150mg for bridging, and consideration
  of admission - there are no reported ambulatory micro-dose transfers above
  that dose.
- **The micro-dosing schedule is carried in full**, from `data/otp-transfers.js`
  so the table cannot drift from anything else that reads it. Buprenorphine runs
  0.2mg BD (or 0.4mg mane) on day 1 to 16-32mg on day 7; methadone is unchanged
  through day 5, halved on day 6 and quartered on day 7. **Methadone is not
  stopped on day 7**, and the page says so in its own note: it is the row people
  reconstruct wrongly from memory, and stopping a day early is a day of
  uncovered withdrawal. Buvidal Weekly may be started on day 7 instead.
- **A calculator prints the schedule for a given patient.** The buprenorphine
  column is fixed and the methadone column is the one worked out by hand at the
  end of a clinic, so that is what it does: enter the usual daily dose and it
  gives the days as they would go on the script, each reduced figure labelled
  with the fraction it is - "45mg (half of 90mg)" - so the number can be checked
  against the published table rather than taken on trust. It also names the
  route the dose selects, including the band NSW does not answer: direct
  transfer is published at 30mg or less and micro-dosing above 40, and between
  the two the calculator says the guidance states neither and to seek specialist
  advice, rather than treating the gap as a choice left open. A blank or
  impossible dose prints nothing.
- **The schedule can be run over one week or two.** One week is the NSW
  schedule. Two weeks holds each of its rungs for two days instead of one, so
  every buprenorphine dose and every methadone reduction is still a published
  one and only the duration changes; day 0 is not doubled, because two days of
  no buprenorphine is a delay rather than a gentler start. It is offered because
  a slower transfer is often what is wanted for a high dose or an anxious
  patient and the realistic alternative is a schedule improvised at the bedside,
  but **it is not the NSW schedule**: it carries a LOCAL provenance chip, says
  so on screen, and reminds the prescriber that the methadone authority has to
  cover however long the transfer actually runs. Tests assert that no dose
  appears on it that is not on the published schedule.
- **The printed table and the calculator come out of the same eight rungs**, so
  a change to one is a change to both - the same reason the missed-dose bands
  and their calculator share a module.
- **Missed doses during micro-dosing are answered by a COWS score**, not by the
  step the patient had reached, because after a gap the question has changed.
  One day resumes the schedule. Two to three days: COWS above 24 inducts,
  below 24 resumes. Four to five days: COWS above 13 inducts, below 13 restarts
  the procedure at day 6. Beyond five days the patient is inducted. In every
  band the patient may elect to return to methadone instead, and the page says
  to ask.
- **The oxycodone conversion multiplies, and the page states the direction
  twice.** Total daily oxycodone is three to four times the methadone dose in
  milligrams - 50mg of methadone becomes 150mg of OxyContin daily on day 1, as
  75mg BD; up to 200mg daily on day 2; and on day 3 a 4:1 calculation of which
  one third is given as immediate-release oxycodone immediately before the
  Buvidal injection. Read as a division rather than a multiplication it gives a
  dose roughly ten times too small, which is a patient in full withdrawal with
  two days of takeaway opioid in the house, so every row carries a worked
  example.
- **Bridging is a Buvidal protocol and is not to be used to transfer onto
  Sublocade.** NSW Health advises against it, and it renders as a danger box
  rather than a footnote because the depot substitution is an easy one to make
  at the point of ordering.
- **The Buvidal dose on day 3 depends on which side of 40mg the methadone dose
  was**: 24mg Weekly from above, 16mg Weekly from below, with 8mg top-ups at
  least 24 hours apart to a maximum of 32mg in the first week, and the next dose
  scheduled at 7 days and giveable from 5.
- **What has to be true before the first oxycodone dose is handed over** is
  listed with the day-by-day reviews: the methadone script confirmed inactivated
  with the dosing point, take-home naloxone dispensed with an overdose brief
  intervention, SOWS twice daily, and no benzodiazepine added to a regimen that
  already has two opioids in it.
- **The COWS >6 figure on the route table belongs to Buvidal alone.** It works
  because the depot takes 12-24 hours to reach peak plasma levels. The threshold
  for a sublingual first dose is unchanged at COWS >= 8, and the page carries
  that as a warning under the table rather than leaving the two figures to be
  read as rival thresholds.
- **Waiting longer than that for a first Buvidal dose is not the cautious
  option**, and the same warning says so. Deferring until moderate or severe
  withdrawal (COWS >= 12) leaves the patient in withdrawal for the eight to 12
  hours the depot takes to reach effective plasma levels, and makes the transfer
  more uncomfortable rather than safer. The first Buvidal dose after low-dose
  methadone is 16mg Weekly, given once there is mild withdrawal with objective
  signs - often 48-72 hours after the last methadone dose, but as early as 24
  hours if withdrawal is present - and off several days at the low dose rather
  than off a rapid taper.
- **Both methods are marked as what they are**: off-label, specialist-initiated,
  with a developing evidence base, and requiring a PRU authority that covers
  methadone and buprenorphine at the same time - Sections D and E of the
  application. A short closing section names what the methods rest on: the two
  Bernese cases from 2016, and the 2022 systematic review that found 18 studies,
  wildly varied protocols, transfer usually succeeding even from high doses, and
  few designs that compare one approach with another.

- **The OTP page's Buvidal content was checked against LAIB 5.2.1 and gained the
  week it was missing.** The dose column was right; everything around it was
  absent. 16mg Weekly is the licensed starting dose and 24mg is clinical
  experience for higher opioid use, which the cell now distinguishes. Under the
  table: hold the first dose if the patient is intoxicated; be confident there
  has been no recent methadone, prescribed or diverted, with a point-of-care
  urine drug test where it is in doubt, because a positive one moves the patient
  onto the transfer pathway rather than delaying this one; run in on sublingual
  buprenorphine where severe hepatic disease (Child-Pugh B or C) or drug
  interactions make a titratable dose the safer start, since a depot cannot be
  taken back out. And the counselling point that decides whether a good first
  dose is read as a failed one: it may wear off before day 7, felt as withdrawal
  or cravings, and the patient can come in early on day 5 or 6 or have a
  supplementary 8mg - levels accumulate to steady state over three to four
  doses.
- **The transfers page picked up three details from the source tables**: there
  is an addiction medicine specialist or on-call AOD medical officer to ring at
  every review, with intoxication the named example; the afternoon contact is
  structured telehealth between 2 and 4pm and address, contact number and
  emergency contact are taken on day 1; and a transfer driven by a medical
  reason - a long QT interval on ECG, a drug interaction - is more urgent than
  elective and may need to be an inpatient one.

### Housekeeping

- Where the interim guidance reads "up to 24 hours apart" for the supplemental
  8mg Buvidal doses, the app states "at least 24 hours apart" with the LAIB
  guidance, on both pages, and the module says why so it is not corrected back.
- The 2024 LAIB guidance, the 2023 interim transfer guidance and Hammig et al.
  (2016) are named on the Sources page. The first was already being relied on by
  the OTP page without being listed there.
- `data/otp-transfers.js` is added to the service worker precache list, so the
  page works offline like the rest of the app.

## 0.4.8 - August 2026

### Clinical

- **Missed doses on OTP are covered, on a new Opioid Treatment Program page**
  linked from the top of Opioid Withdrawal. The app already carried induction
  and taper protocols for both agents and said nothing about the far commoner
  question: a patient already on a program turns up having missed doses, and
  someone at the dosing point has to decide what may be given today. It is a
  page rather than a section because the reader is different - someone holding
  an established patient's dose, not someone starting a new one - and because
  none of it comes from the guidance the withdrawal page is built on. The bands are 1-3 (review, then the normal
  dose if there is no intoxication, no significant withdrawal and no other
  concern), 4-5 (reduced dose, prescriber contacted, legal prescription to the
  dosing site) and more than 5 (prescriber must review before treatment
  recommences). Two absolutes render above them rather than as a footnote: an
  intoxicated patient is not dosed with either drug, and no prescriber and no
  valid script means no dose.
- **The restart dose is calculated rather than described.** `restartDose()` in
  `data/otp-missed-doses.js` applies half the usual dose or the agent's floor -
  40mg methadone, 8mg buprenorphine - whichever is higher, and the section
  renders the climb back afterwards: 5-7 days in steps of up to 20mg for
  methadone, 2-3 days in steps of up to 8mg for buprenorphine. The bands and the
  arithmetic come out of one module so the table and the calculator cannot
  disagree.
- **The dose is capped at the patient's usual dose, which the source does not
  say.** "Half the regular dose or 40mg, whichever is higher" is written for the
  doses the guideline assumes. Below the floor it inverts: a patient maintained
  on 30mg of methadone would be given 40mg on the day they return from a gap
  that has cost them tolerance. The cap fires, the calculator says on screen
  that it fired and why, and the departure carries a LOCAL provenance chip.
- **Buvidal is a separate table**, because nothing about it is a count of missed
  daily doses. Weekly may be given on days five to nine, monthly in weeks three
  to five, a missed dose is given as soon as practicable, and re-induction may
  be required beyond 10-14 days between weekly doses or eight weeks between
  monthly ones.
- **The calculator gives no number in the bands where the number is not the
  decision.** At 1-3 it names the usual dose and points at the review; above 5
  it says there is no dose today and states the re-induction position for that
  agent. Only the 4-5 band produces a milligram figure, and it says in the same
  card that the figure cannot be dispensed without the prescriber.
- **Confirming what the patient is currently on leads the OTP page**, because
  the missed-dose bands cannot be counted without it: the number of consecutive
  missed doses and the usual daily dose both come from the dosing point, not
  from the patient and not from the prescription. Check SafeScript NSW, then
  contact the pharmacy or other dosing point for a dosing history before
  prescribing, with the Ministry of Health line as the fallback when the dosing
  point is unknown or unreachable. NSWCG puts the Ministry line first and lists
  SafeScript separately under prescription opioids, so the order here is an
  adaptation and is tagged as one. The same block renders in the withdrawal
  page's regulatory section, so the phone numbers exist in one place.
- **Pain in a patient on buprenorphine moved to the OTP page.** Full agonists
  remain effective for analgesia and the buprenorphine does not need to be
  stopped - which is guidance about a patient already in treatment, and was
  sitting on a page about starting or ending it. The text and its sourcing are
  unchanged.
- **The OTP page gains the program framework: pharmacotherapy, assessment and
  prescribing.** Three medicines in one table - oral methadone, sublingual
  buprenorphine (BNX preferred), and Buvidal Weekly/Monthly - with formulation,
  initiation and target maintenance dose for each. Methadone maintenance is
  60-100mg/day, with specialist review above 150mg and Pharmaceutical Services
  Unit approval above 200mg; Buvidal is 16-32mg Weekly or 64-160mg Monthly, and
  can be started directly from short-acting opioids without a withdrawal run-in
  at 16mg or 24mg Weekly. That last figure carries a warning of its own, because
  it is the one cell of the table a reader can carry to the wrong drug: it does
  not relax the precipitated-withdrawal precautions for sublingual buprenorphine
  and does not apply to someone coming off a long-acting agonist.
- **Buprenorphine induction now states one first-dose rule in both places, and
  the threshold to initiate stays at COWS >= 8.** Below that, do not dose -
  reassess later. The first dose is **8mg**, given either whole or **split as
  4mg with a further 4mg after 1-2 hours**, splitting being the more cautious of
  the two; a **2mg test dose with review at 1 hour, then a further 2-6mg** and
  occasionally up to 12mg, is a further alternative. The wider second increment
  is tagged as adapted - NSWCG publishes the single figure 6mg, not a range.
- **The COWS 4-8 dosing band is gone.** The 2018 guidelines present the 4mg +
  4mg split as what to do in that band, which read as a second, lower threshold
  sitting under the COWS >= 8 one on the same page. Since the app does not
  initiate below COWS 8, the split is carried across as a way of giving the 8mg
  first dose rather than as a band of its own - the cautious technique survives,
  the implied lower threshold does not. Tagged LOCAL, with that reasoning, and a
  test fails if a COWS 4-8 band reappears in clinical text on either page.
- **8-12mg outpatient and 8-16mg inpatient are now labelled as Day 1 totals.**
  Unlabelled, they read as first doses and appeared to contradict the 4-8mg
  first-dose figures elsewhere on the page. That conflation is what made three
  compatible protocols look like three rival ones.
- **Sublingual buprenorphine converts to Buvidal, from LAIB Table 4.** 2-6mg
  daily to 8mg Weekly; 8-10mg to 16mg Weekly or 64mg Monthly; 12-16mg to 24mg or
  96mg; 18-24mg to 32mg or 128mg; 26-32mg to 160mg Monthly. The two blank cells
  are the point of the table as much as the numbers are: a patient on 2-6mg has
  **no Monthly equivalent** and one on 26-32mg has **no Weekly equivalent**, and
  neither can be prescribed around by taking the nearest row. Both are gaps in
  the manufactured range rather than clinical contraindications - the Monthly
  dose is four times the Weekly one throughout, and in each blank the 4x partner
  is a product that is not made.
- **The conversion is guarded structurally rather than by re-typing it.** Tests
  assert the 4x relationship across every row, that the bands cover each
  dispensable 2mg step from 2 to 32mg exactly once with no gap or overlap, that
  the table still ends on the 32mg licensed maximum the pharmacotherapy row
  states, and that each blank cell is where its 4x partner is unmanufactured. A
  single mistyped figure breaks at least one of those.
- **Case flagging sets review frequency and setting**, from monthly clinical and
  2-monthly medical review in a specialist clinic for high need, down to
  3-monthly and 6-monthly in primary care for low need. The guideline lists each
  tier's features across three unrelated axes without saying how to combine
  them, which leaves a housed, stable patient with mild polydrug use classifiable
  two ways; the app states that any single feature flags a patient up, and tags
  that as the local decision it is.
- **Assessment and prescribing framework.** The biopsychosocial assessment and
  what it must document; urine drug screening as corroboration, with treatment
  never delayed for laboratory results. Authority to prescribe in the community
  is applied for through SafeScript NSW, with the Pharmaceutical Services Unit as
  the alternative channel - and the inpatient exception is stated as an
  exception: no authority is needed for an opioid-dependent inpatient, for 14
  days, and it is not a route into ongoing community treatment. Caseload limits
  per prescriber render collapsed, because they bind the prescriber setting up a
  practice rather than the clinician holding a dose.
- **The opioid harm-reduction block now renders on the OTP page too.** It opens
  on reduced tolerance and carries the naloxone brands, which is exactly what
  the missed-dose bands above it are warning about. It is the existing shared
  block, so nothing is duplicated.

### Housekeeping

- **The OTP page carries an under-construction banner.** It ships with known
  holes - takeaway doses and transfer, travel and interstate dosing are not
  covered at all - and the banner says so at the top rather than leaving a
  reader to discover the gap by not finding what they came for.

- `data/otp-missed-doses.js` is added to the service worker precache list and to
  the provenance test's source list, so the page works offline and its chips are
  checked like every other page's.
- The OTP page carries its own review footer naming its two sources - the 2018
  opioid dependence guidelines and the LAIB guidance - rather than borrowing the
  withdrawal page's. The Opioid Withdrawal page's own metadata is unchanged.
- The opioid pathway's section numbering is unchanged: the new content is a
  page, not an insertion.

## 0.4.7 - August 2026

### Safety

- **Seven `data-sd` constants disagreed with the standard-drink formula and are
  corrected.** The wine casks did not scale against each other - 2L of red was
  21.0 and 4L was 43.0 - and the beer slabs were built by multiplying the
  *rounded* per-can figure rather than the formula, so a full-strength carton
  read 33.6 (24 x 1.4) where it is 34.1 (24 x 1.4202), and a mid-strength carton
  read 24.0 where it is 24.9. A 150mL glass of white was 1.4 while an identical
  pour of champagne was 1.5. None of these crosses a banding threshold on its
  own, but they are the rows a heavy drinker's total is built from, and they all
  understated it. Corrected: `b10` 33.6 to 34.1, `b11` 24 to 24.9, `w4` 1.4 to
  1.5, `w6` 7.5 to 7.4, `c1` 21.0 to 21.3, `c2` 43.0 to 42.6, `c3` 19.5 to 19.7,
  `c4` 39.0 to 39.5.
- **`test/clinical.test.js` now checks every row, not only the single serves.**
  The old parser required a `(NNNml)` volume in the label, so casks, cartons and
  the unparenthesised spirit serves were skipped silently - which is exactly
  where the drift above was sitting, because nothing else recomputes those large
  numbers. `volumeMl()` now reads multipack counts, litres and bare mL, the
  tolerance scales with the size of the value so a 43-drink cask cannot absorb a
  whole drink of error, and a second test fails if any row's label is
  unparseable rather than letting it fall out of the check.
- **Non-beverage alcohol is prompted for before the count.** Mouthwash (~21%),
  hand sanitiser (~70%) and methylated spirits (~95%) are not beverages and are
  not on the list, so they are easy to omit from a history - but they count
  towards the intake that drives severity banding. The prompt directs the entry
  to the Custom Volume & ABV tab rather than listing them as drink options.

### Clinical

- **Twenty drink options were added to the by-type calculator**, all computed
  from volume(L) x ABV x 0.789. The gaps were the containers people actually
  report: beer had no pint (570mL, 2.2), jug (1140mL, 4.3), longneck (750mL,
  2.8), six-pack (8.5) or craft-strength tier (5.5%); cider was absent entirely;
  wine had a 100mL and 150mL serve but not the 250mL kitchen tumbler its own
  caveat describes; fortified wine had a 60mL port serve but no bottle (10.4) or
  2L flagon (27.6), and no sherry; spirits had 700mL and 1L bottles but not
  375mL (11.8) or the 1.125L that sits on the shelf beside them (35.5), and no
  overproof rum (57%); pre-mixes stopped at 7% where 10% cans are sold.
- **The beer cartons are relabelled "Carton / Slab", and the spirits fieldset
  names its spirits.** In both cases the row existed and its arithmetic was
  right; the word most likely to be used to find it was not on it. Gin, vodka,
  whisky and rum are all 40% and so were all already counted by the generic
  "Spirit Nip" and "Spirit Bottle" rows - but nobody scanning for gin found
  them. The legend now reads "Spirits (Gin, Vodka, Whisky, Rum)", and navy
  strength gin shares the 57% overproof rows, where it genuinely differs. No
  `data-sd` changed. A test now fails if a spirit stops being named.

### Housekeeping

- **"Before you count" is 67 words, down from 157.** The three questions are
  unchanged and so is where they route the user; each was carrying two or three
  sentences of justification that a clinician reading a prompt above a form does
  not need. The heading no longer counts its own bullets, which is what let it
  say "two questions" above three of them.

## 0.4.6 - August 2026

### Housekeeping

- **Provenance rationales longer than 25 words collapse to their citation**, with
  a `why` toggle that opens the full sentence. The Sources page promises a
  one-line rationale; fourteen chips ran between 26 and 91 words, and nine of
  them rendered expanded, because the collapsed `<details>` treatment only ever
  applied to caveats and not to the schedule and PRN lists. On the Loading
  regimen an 89-word paragraph sat between the handover instruction and the PRN
  doses. The collapse happens at render time rather than by editing the text, so
  the source files and `test/provenance.test.js` still hold the same sentences,
  the EMR export is unaffected (it strips `.src-tag` entirely), and print shows
  every rationale in full. 606 words move out of the default view.
- **The quick-start preamble on the seven other-substance pages is one line.**
  Each page introduced its quick-start textarea with a 25-to-47-word paragraph
  saying the contents were condensed and citation-free - which the heading and
  the textarea already convey. Opioid and benzodiazepine keep a second clause,
  because theirs names the guidance the condensed version leaves behind. 221
  words to 118.

## 0.4.5 - August 2026

### Housekeeping

- **The "Where the bands come from" note above the selector is now one line**, and
  the AWS derivation appears only when the AWS scale is selected. It was four
  lines and two citation chips shown to everyone, three of which duplicated the
  AWS note already collapsed on each schedule, and none of which applied to a
  ward charting CIWA-Ar. No provenance is lost: the CIWA-Ar statement is kept
  because it is stated nowhere else on the tab, and the AWS derivation is
  unchanged where it actually lives.
- **Labels in both selector rows are aligned to the top of their button.** A grid
  row sizes to its tallest button and a stretched button centres its content, so
  a one-line label floated halfway down a box sized by a four-line neighbour.
  The redundant `<br>` in each button went with it - `small` was already
  `display: block`, and inside a flex container the `<br>` would have generated a
  stray empty item.
- **ASAM's alcohol withdrawal guideline is listed on Sources & Attribution.** It
  is a United States guideline and no dose on this site comes from it; it is
  listed because it will be cited here, and because it states plainly that
  medications such as beta-blockers can mask the signs of withdrawal.
- **The fixed-schedule button states its indication in clinical terms** rather
  than listing "ambulatory" first - ambulatory withdrawal has its own pathway in
  this app and is not a choice made on the inpatient tab.

### Safety - these alter clinical meaning

**The regimen selector now asks two questions instead of one.** The row of six
buttons mixed two different kinds of answer: *regimen type* (Symptom-Triggered,
Unknown Tolerance) sat beside *predicted severity* (Sub-Mild to Severe) as
though a clinician were choosing between peers. They are now two rows - type
first, decided by the patient; intensity second, decided by the score - and the
intensity row is hidden for the types that do not take one.

| Change | Why |
|---|---|
| **Loading is a regimen type, and its indication is broader than a score.** It is offered for severe withdrawal, a withdrawal complication, **or a history of withdrawal seizures at any current score**. | AGTAP Figure 8.2 asks "is a loading regimen required?" before anything else, and 8.27 (Grade B) answers it from three things, only one of which is a score. This app reached loading only through the Severe band, so a patient scoring 12 with a past withdrawal seizure was offered a fixed taper - while the site's own Special Cases panel said to load them (NSWCG §5.6.1). The clinical content of the cell is unchanged; what changed is who is routed to it. |
| **The Severe intensity no longer carries a schedule.** It explains that severe withdrawal is managed by loading, and offers a control that switches the type axis. | For diazepam the severe regimen *was* the loading regimen, which now lives on the type axis. Leaving Severe in place, rather than deleting it, means anyone looking for it still finds an answer. |
| **Sub-Mild carries one option, not two.** The halved fixed schedule stays here; supportive care with symptom-triggered dosing is now reached by selecting that regimen type, and the cell says so. | The cell previously held two alternatives and could not present either as the default without contradicting the other - recorded as an open `TODO(clinical)`. On two axes they stop being alternatives inside one cell, so the question no longer arises. That TODO is resolved and removed. |
| **Symptom-Triggered carries an amber top edge and a one-line legend** naming AGTAP's three exclusions. | Per-button rather than a rule spanning a group: the selector reflows at several breakpoints and a group-spanning bar would land mid-row at some of them. |
| **The default handover after a loading day is the Moderate-Severe schedule from its Day 2 row** (diazepam 15mg qid), with symptom-triggered dosing as the alternative. The two were previously offered the other way round. | NSWCG §5.4.4 names symptom-triggered dosing as its preferred post-loading handover, so this is a **local** departure and is tagged as one: a patient who has just required loading has usually declared a history, a complication or a comorbidity, which are the same features that make scale-driven dosing unreliable. AGTAP p122 treats a fixed reducing regimen and as-needed dosing as equally acceptable after loading. Resolves the open `TODO(clinical)`. |
| **The "Alternative: Symptom-Triggered Regimen" pointer at the foot of Mild-Moderate is gone.** | It told the reader to press a button that is now visible directly above the panel. The dose table it pointed at is unchanged and still exists in exactly one place. |
| **The test-dose protocol has moved to the Assessment & Banding tab**, with a pointer left on the regimen type axis. Its content, dosing and LOCAL tag are unchanged, and it still follows the benzodiazepine choice. | It is not a regimen - it ends by naming which regimen to start. It answers the banding question that tab is otherwise asking you to answer from the reported intake, which is exactly the situation where the intake is unusable. |

### Housekeeping

- `REGIMEN_CONFIG` gains a `loading` cell per drug (the former `severe` content)
  and `severe` becomes a routing cell. Oxazepam's refusal to offer any loading
  regimen at any severity is unchanged, and now answers the Loading button
  directly.
- The EMR export, the band labels and the scale toggle all follow the resolved
  cell rather than a severity key, so switching type re-targets the paste.


**The alcohol pages were cross-checked against the national guideline.** The
*Guidelines for the Treatment of Alcohol Problems* (4th ed, 2021 - AGTAP) was
already the source of the AWS bands but was not listed as a source document, and
three of its positions were not reflected. Where it is now cited beside NSWCG,
the chip carries AGTAP's own grade of recommendation, because a reader weighing
two documents cannot do it without knowing which is a Grade A finding and which
is consensus.

| Change | Why |
|---|---|
| **The symptom-triggered regimen now states AGTAP's exclusions.** Do not dose to the score where there is a **history of withdrawal seizures**, concurrent withdrawal from other drugs, or significant medical or psychiatric comorbidity; use a fixed schedule instead. | AGTAP 8.10 and 8.26 (both Grade B) rule scale-driven dosing out in these groups, and 8.28 sends them to a fixed schedule. NSWCG only cautions. The seizure exclusion was stated nowhere at the point of regimen choice, and it is the one that matters most: a seizure can arrive before the score rises. |
| **Carbamazepine is no longer grouped with phenytoin and valproate.** The panel now leads with anticonvulsants not being a *reliable alternative* to benzodiazepines, none having evidence for preventing a recurrent seizure in the same episode; phenytoin and valproate do not prevent withdrawal seizures at all; carbamazepine does prevent a first seizure but the evidence does not extend to a recurrent one. | The previous blanket "no benefit" line contradicted AGTAP 8.29 (Grade A), which rates carbamazepine an effective alternative to benzodiazepines. The advice at the bedside is unchanged - do not add an anticonvulsant, assess the seizure for other causes - but the stated reason was wrong, and stating it as an absence of evidence for recurrent seizures is both softer and closer to what the trials show. |
| **Continuing Care points at AGTAP Chapter 10 rather than the guideline's front page**, and carries two things across: that 3 to 6 months is a **starting** course rather than a stopping point, and that naltrexone is unsuitable in opioid dependence or where opioid analgesia is needed. | A reader sent to a homepage to find dosing for three drugs will not find it. AGTAP frames the duration as "at least" 3 to 6 months with continuation assessed individually (10.4, 10.8, 10.9), so a bare "3 to 6 months" invites stopping at the floor. The naltrexone contraindication (10.6) is the one most likely to matter on a ward where patients are also on opioids. |
| **The BAL at which to start dosing is given as a range, `0.05% to 0.10%`, naming both sources.** | The page gave a single figure of `< 0.1 g/dL` from NSWCG; AGTAP p110 puts it at `0.05%`. Neither is wrong, and a reader who checks the national guideline against a single number would find a disagreement they cannot account for. The range covers both, and says which end each source sits at. |
| **AGTAP is now listed on Sources & Attribution and on Helpful Contacts.** | It was cited on the Regimens tab but appeared in neither list, and the Helpful Contacts heading reads "State & National" while listing no national guideline. Sources & Attribution now carries the full citation once, which is what lets the inline chips shrink to `AGTAP 8.26 (B)`. |

### Safety - these alter clinical meaning

**The AWS bands on the two fixed inpatient schedules have changed.** A ward
charting AWS previously saw `AWS 4-14` on both Mild-Moderate and Moderate-Severe
and had to pick between them on other grounds. The bands are now `4-7` and
`8-14`. No dose, schedule or observation frequency changed - only which score
points at which schedule.

| Change | Why |
|---|---|
| Mild-Moderate is `AWS 4-7`, Moderate-Severe is `AWS 8-14`. Sub-Mild stays `< 4` and Severe stays `> 14`. PRN triggers and the severity buttons follow. | NSW Health Clinical Guidance Table 5.6 leaves `4-14` as one band, so an AWS score could not select a schedule - while a CIWA-Ar score could. AWS-charting wards were held to a stricter standard than CIWA-Ar wards for no stated reason. |
| The boundaries come from the *Guidelines for the Treatment of Alcohol Problems* (4th ed, 2021): `4-7` is a published band in Table 8.4, and the break at 7/8 appears in both Table 8.4 (severe above 7) and p111 (severe 8-14). `15` is p111's very severe and matches NSWCG's `> 14`. | These are the only published subdivisions of the range the two schedules share. `4-7` and `8-14` union to NSWCG's `4-14` exactly, so NSWCG is subdivided rather than contradicted. |
| **Observation frequency deliberately does not follow AGTAP.** The app keeps NSWCG's 2-4 hourly across `4-14`; the caveat states that AGTAP Table 8.4 rescores 1-2 hourly above AWS 7, and that more frequent observation in the `8-14` band is reasonable. | Taking the bands from one document and the monitoring from another, silently, is how a reader ends up trusting a mapping that no source published. Keeping NSWCG also stops the AWS and CIWA-Ar views of the same band disagreeing about monitoring. |
| The symptom-triggered regimen keeps NSWCG's `< 4 / 4-14 / > 14` dose bands. | That is a published dose-per-score table, not a local banding choice. Subdividing it would mean inventing doses. Noted as an open question: at AWS 8-14 it gives 10mg where AGTAP Table 8.4 gives 20mg. |
| The Regimens tab cites the document, and the inpatient page names it as a second source. | The page's bands now come from it. |

### Recorded as open, not resolved

- AGTAP Table 8.4's note expands AWS as "Alcohol Withdrawal Symptoms - Rating
  Scale", where this app uses the NSW Health (2000) **Alcohol Withdrawal
  Scale**. Almost certainly the same instrument - both documents map it against
  the same CIWA-Ar bands - but unconfirmed against the source, and the bands do
  not transfer if it is not.
- AGTAP contradicts itself on a score of exactly 4: mild on p111, moderate in
  Table 8.4. This app follows Table 8.4 and puts 4 in Mild-Moderate.
- The AWS calculator on the Scales page still bands `<= 4 / <= 14 / > 14`, which
  disagrees with both AGTAP tables at 8-14.

### Tests

The guard asserting that "AWS 4-14 spans both" fixed schedules is retired - it
enforced the honesty of a state that no longer exists. Three replace it: the two
bands must partition NSWCG's `4-14` with no gap and no overlap, PRN triggers must
carry the same bands as the schedules they belong to, and the caveat must cite
both AGTAP tables and state AGTAP's monitoring position.

## 0.4.4 — August 2026

Intended purpose, the entry gate, and a privacy statement. No clinical content
changed.

### Safety — these alter clinical meaning

None. What changed is what the site says about itself and who it lets in.

### Intended purpose and the gate

| Change | Why |
|---|---|
| The entry modal asks "are you a qualified health professional?" and offers a real second answer. Declining swaps the gate for ADIS, the national AOD hotline, Lifeline and 000, and does not dismiss the modal. | A site that states it is for clinicians but admits everyone equally has its intended purpose decided by whoever opens it. Asking the question, and turning away the answer that does not qualify, is what makes the stated purpose the actual one. The answer is deliberately **not** remembered: a shared ward terminal has more than one user, and a stored attestation would speak for all of them. |
| "It is not a medical device" is gone from the modal, the About page and the README, replaced by a positive statement of intended purpose: decision support for qualified health professionals, supporting and not replacing clinical judgement, not diagnosing, not directing treatment, not analysing medical images or signals. | The old sentence asserted a regulatory conclusion the author is not in a position to reach, and asserting it wrongly is worse than not asserting it. The replacement states the facts that bear on the question and leaves the conclusion to whoever is entitled to draw it. |
| Three statements move from inner pages onto the opening screen: no section has completed independent clinical review; the site is not produced, authorised or endorsed by NSW Health; the source guideline governs where this site disagrees with it. | All three were already on the site and all three were reachable only by someone who went looking. The absence of external review is the site's largest single limitation, and a warning of limitations that the user never sees is not a warning. NSW phone numbers, NSW terminology and citations to NSW Clinical Guidance make the site look official; the denial has to arrive before the content does, not after. |
| The footer disclaimer summary leads with "Health professionals only". | It is the one piece of disclaimer text present on every page. |

### Privacy

- A privacy statement on the About page: calculator inputs are processed in the
  browser and never transmitted, there is no server-side application, no
  accounts, no analytics, no third-party requests and no cookies.
- It also states what *does* leave or persist, since a partial disclosure is
  the kind that gets picked apart: GitHub Pages logs requests including IP
  addresses under GitHub's own privacy statement and the author cannot see
  them; localStorage holds the theme preference and the build-skew marker and
  no clinical content; the offline cache holds app files only; and the Feedback
  button opens the user's own mail client to a personal address, so feedback
  must not carry patient-identifying detail.

## 0.4.3 — August 2026

### Safety — these alter clinical meaning

| Change | Why |
|---|---|
| Every EMR paste ends with a provenance line naming the release that produced it and how far it is guideline-derived. | 0.4.1 stripped citations from the paste. A regimen sitting in a patient record with no attribution cannot be checked back against its basis by whoever reads the note next, and regimens change between releases — the version says which one produced those numbers. |
| The line says "NSW Health-derived **with local adaptations**" wherever the regimen carries content this app does not trace to NSWCG. | True of every cell except the severe regimens. The test-dose protocol is local outright, the oxazepam schedules are converted, the sub-mild options derive from this site's own ambulatory doses. A flat NSWCG claim on those would put a false attribution in a patient record — the failure the line exists to prevent. Computed from the cell's own source tags, so it cannot drift from the content. |

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
