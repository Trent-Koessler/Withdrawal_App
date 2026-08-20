// Extracted verbatim from script.js so this clinical data can be unit tested.
// Content is unchanged; only the surrounding declaration differs.

// Retained as the pointer shown under Mild-Moderate. The dosing table itself
// now lives in one place — the Symptom-Triggered regimen — so the two cannot
// drift apart.
const symptomTriggeredNote = (drugName) => `For unclear alcohol intake, or anticipated mild alcohol withdrawal with unclear benzodiazepine requirements, symptom-triggered dosing is an alternative to this fixed schedule. Monitor the amount of ${drugName} used and reassess requirements regularly. <b>Select the Symptom-Triggered regimen above for the full dosing and monitoring table.</b>`;

// Shown above any oxazepam schedule. The 1:3 ratio is a rough equivalence, and
// the taper *shape* below it was designed around diazepam's self-tapering
// kinetics — which is the part that does not transfer, and the part a converted
// table silently hides.
const OXAZEPAM_CONVERSION_CAVEAT = `<b>Conversion caveat.</b> Diazepam 10mg &asymp; oxazepam 30mg is an <b>approximate</b> ratio, not an equivalence. Oxazepam has no long-acting active metabolites, so it needs <b>more frequent administration and a slower step-down</b> than a diazepam taper of the same shape. Treat the schedule below as a starting point to be <b>titrated against response</b>, not a fixed course to complete. <span class="src-tag src-nswcg-adapted">NSWCG-adapted §5.6.3 - rationale: NSWCG gives the equivalence ratio and advises careful titration for this group, but publishes no oxazepam taper table; converting the diazepam schedule is a local step and the resulting shape is not guideline-derived.</span>`;

// Many NSW wards chart AWS rather than CIWA-Ar, so no band in this app is
// expressed in one scale alone: every band carries both thresholds and the
// Regimens tab renders whichever the ward charts. The toggle chooses a view —
// it never deletes the other scale's threshold from the data, which is what
// this helper exists to make hard to get wrong.
//
// Values are the thresholds only ('10-15'), not the scale name: the renderer
// supplies 'CIWA-Ar' or 'AWS' so a band can never be labelled with the wrong one.
const band = (ciwa, aws) => ({ ciwa, aws });

// NSWCG Table 5.6. Observation frequency is a property of the band, so it
// travels with the band rather than being restated per schedule.
const BAND_MONITORING = { submild: '4-6 hourly', mild: '2-4 hourly', moderate: '2-4 hourly', severe: 'hourly' };

// Stated on the Assessment & Banding tab for every patient commenced on a
// regimen, and repeated in the EMR export so a fixed schedule never pastes with
// a band frequency alone.
export const INITIAL_SCORING_INTERVAL = '2-hourly at least initially';

// Two published sources band the AWS, and they do not have the same shape.
//
//   NSWCG Table 5.6 maps CIWA-Ar <10 / 10-20 / >20 to AWS <4 / 4-14 / >14. That
//   is the mapping this app's bands and observation frequencies are built on,
//   and it is coarser than the local CIWA-Ar bands, so AWS 4-14 covers both
//   fixed schedules and cannot separate them.
//
//   AGTAP p111 characterises the AWS more finely: up to 4 mild, 5-7 moderate,
//   8-14 severe, 15 or more very severe.
//
// They agree at the outer edges and differ inside NSWCG's middle band, which
// AGTAP splits at 7/8. The caveat below states both rather than merging them:
// the finer AGTAP wording is offered as a descriptor of how sick the patient
// is, not as a rule for choosing between the two fixed schedules, because
// neither document maps an AWS score to this site's schedules.
const AGTAP_CITE = `<span class="src-tag src-other">OTHER - Haber PS, Riordan BC, et al. Guidelines for the Treatment of Alcohol Problems, 4th ed (2021), p111 - Specialty of Addiction Medicine, University of Sydney, for the Australian Government Department of Health.</span>`;

const AWS_BAND_CAVEAT = `<b>If your ward charts AWS.</b> Two published sources band the AWS differently, and both are shown here rather than merged into one number line.<br>
<b>1. NSWCG Table 5.6 - the bands this app runs on.</b> CIWA-Ar &lt; 10 / 10-20 / &gt; 20 map to AWS &lt; 4 / 4-14 / &gt; 14, and the observation frequency for each band follows from that mapping. Those bands are <b>coarser</b> than the CIWA-Ar bands this app uses to separate Mild-Moderate from Moderate-Severe: <b>AWS 4-14</b> spans both. <span class="src-tag src-nswcg">NSWCG Table 5.6</span><br>
<b>2. AGTAP p111 - a finer description of severity.</b> An AWS score of <b>up to 4</b> indicates mild withdrawal, <b>5-7</b> moderate, <b>8-14</b> severe, and <b>15 or more</b> very severe. ${AGTAP_CITE}<br>
<b>Where they meet, and where they do not.</b> The two agree at the edges - mild at the bottom, and NSWCG's &gt; 14 is AGTAP's very severe &ge; 15. They differ in two places: AGTAP calls a score of exactly <b>4</b> mild, where NSWCG's middle band already starts at 4; and AGTAP <b>subdivides</b> NSWCG's single 4-14 band into moderate 5-7 and severe 8-14.<br>
<b>What this does not change.</b> An AWS score alone still will not choose between the two fixed schedules - use reported intake, risk factors and clinical assessment for that, and use AWS to track severity within the schedule you choose. The AGTAP wording tells you <b>how severe the withdrawal is</b>; it is not a published mapping to these schedules, so it is not used here to select one. <span class="src-tag src-nswcg-adapted">NSWCG-adapted Table 5.6, with AGTAP p111 - rationale: NSWCG publishes the three-band AWS mapping but no AWS equivalent for the local CIWA-Ar 10-15 / 15-20 split, and AGTAP's finer bands are a severity description rather than a mapping to any dosing schedule, so the overlap is stated and the two schemes are shown side by side rather than a combined mapping being invented.</span>`;

// TODO(clinical): should AGTAP's 5-7 / 8-14 split be adopted as the operative
// AWS boundary between the Mild-Moderate and Moderate-Severe fixed schedules,
// instead of only describing severity? It is the only published split of
// NSWCG's 4-14 band, but AGTAP does not tie it to any dosing schedule.
// TODO(clinical): a score of exactly 4 is mild under AGTAP and in the middle
// band under NSWCG Table 5.6 - which boundary should the Sub-Mild band use,
// AWS < 4 as now, or AWS <= 4?
// TODO(clinical): the AWS calculator on the Scales page bands <=4 mild /
// <=14 moderate / >14 severe, which now disagrees with the AGTAP wording
// quoted on this page for 8-14 - should the calculator move to AGTAP's four
// bands, or should both schemes be labelled there as they are here?
// TODO(clinical): how should a ward that charts AWS only choose between the
// Mild-Moderate and Moderate-Severe fixed schedules? Both sit inside AWS 4-14.
// Options include defaulting to Mild-Moderate with escalation, or requiring a
// CIWA-Ar at band selection even where AWS is charted thereafter.

// The lowest band in this app starts at CIWA-Ar 10-15 / <=14 standard drinks a
// day, so a genuinely mild withdrawal received 40mg of diazepam on Day 1 with
// nothing gentler available. NSWCG Table 5.5 notes milder cases may respond to
// half the ambulatory regimen doses.
const subMildCell = (drug, halved, extraCaveats = []) => ({
    name: 'Sub-Mild',
    band: band('&lt; 10', '&lt; 4'),
    monitoring: BAND_MONITORING.submild,
    caveat: [...extraCaveats, `<b>Two options, and they are not equivalent.</b> A patient below the Mild-Moderate band does not automatically need a fixed schedule. Decide between supportive care with symptom-triggered dosing, and a halved fixed schedule, before prescribing. <span class="src-tag src-nswcg">NSWCG Table 5.5, §5.4.4</span>`],
    schedule: [
        `<b>Option A - supportive care and symptom-triggered dosing only.</b> No scheduled benzodiazepine. Monitor 4-6 hourly, treat to the score using the Symptom-Triggered regimen, and reassess. This is the NSWCG-preferred approach for uncomplicated withdrawal with frequent review. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
        `<b>Option B - halved fixed schedule.</b> NSWCG Table 5.5 notes that milder cases may respond to <b>half</b> the ambulatory regimen doses. Applied to the schedule used here, that is: ${halved}. <span class="src-tag src-nswcg-adapted">NSWCG-adapted Table 5.5 - rationale: NSWCG states milder cases may respond to half the ambulatory doses but publishes no sub-mild table, so the halved figures are derived from this site's own ambulatory regimen and inherit its local provenance.</span>`,
        `<b>Either way:</b> escalate to the Mild-Moderate schedule if the score enters that band, and review daily. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`
    ]
    // TODO(clinical): which of these two should be the default for CIWA-Ar < 10 —
    // supportive care with symptom-triggered dosing only, or the halved fixed
    // schedule? Both are presented until this is decided; only one should be.
});

// NSWCG Table 5.4 / 5.6. The dose is drug-specific; the score bands and the
// monitoring frequency are not, so they are written once here.
//
// A list rather than a four-column table: this is the block clinicians paste
// into the EMR, and a table becomes unreadable pipe-separated rows there. Each
// band still carries both scales - the renderer shows one.
const symptomTriggeredBands = (doses) => [
    { ...band('&lt; 10', '&lt; 4'), dose: doses[0], monitoring: BAND_MONITORING.submild },
    { ...band('10-20', '4-14'), dose: doses[1], monitoring: BAND_MONITORING.mild },
    { ...band('&gt; 20', '&gt; 14'), dose: doses[2], monitoring: BAND_MONITORING.severe }
];

// Symptom-triggered dosing is the regimen NSWCG §5.4.4 calls ideal for
// uncomplicated withdrawal reviewed frequently by skilled clinicians — i.e. the
// one a specialist withdrawal unit would reach for first. It was absent from
// this app entirely, surviving only as a sub-block under Mild-Moderate.
// The drug is not in the name: the renderer appends it, so the panel heading
// and the EMR header cannot end up naming it twice or disagreeing about it.
const symptomTriggeredCell = (drug, doses, reviewMax, extraCaveats = []) => ({
    name: 'Symptom-Triggered',
    caveat: [...extraCaveats, `<b>When this regimen is appropriate.</b> Symptom-triggered dosing suits <b>uncomplicated withdrawal</b> in patients without co-occurring conditions, in an inpatient setting with <b>frequent review by skilled clinicians</b>. Where those conditions do not hold - complex inpatients with co-occurring conditions - a <b>hybrid</b> regimen (a fixed schedule reviewed daily, plus PRN) is often the most appropriate choice. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`],
    bands: symptomTriggeredBands(doses),
    schedule: [
        `Score the patient at the interval shown for their current band, and give the dose for that band. There is no fixed daily total to complete. <span class="src-tag src-nswcg">NSWCG Table 5.4, Table 5.6</span>`,
        `<b>Medical review required</b> for rising scores, or for severe withdrawal not responding to medication. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
        `<b>Medical review required if the total dose exceeds ${reviewMax} in 24 hours.</b> <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
        `Dose no more frequently than q2hrly, unless the patient has <b>delirium tremens</b> and is in a <b>heavily medically monitored environment</b> (HDU, or 1:1 nursing with continuous observation) - see Special Cases &rarr; Alcohol withdrawal delirium for that pathway. <span class="src-tag src-local">LOCAL - rationale: local practice caps dosing frequency to limit stacking of doses whose peak effect has not yet been observed; NSWCG sets a monitoring frequency but no minimum dosing interval. The DT exception matches the more frequent dosing already permitted for delirium in a monitored setting elsewhere in this app.</span>`
    ]
});

// Not in NSWCG at all — this protocol is original to this site. NSWCG's own
// answer to uncertain tolerance is symptom-triggered dosing, which yields the
// same information from a smaller first dose, so the reason for preferring a
// test dose locally has to be stated rather than assumed.
const testDoseCell = (drug, testDose, extraCaveats = []) => ({
    name: 'Unknown Tolerance (Test-Dose Protocol)',
    caveat: [...extraCaveats,
        `<b>This protocol is local, not guideline.</b> NSWCG does not describe a test-dose protocol. Its answer to uncertain tolerance is <b>symptom-triggered dosing</b>, which produces the same information about tolerance from a smaller first dose and is the safer default where frequent skilled review is available. <span class="src-tag src-local">LOCAL - rationale: a single observed test dose is preferred locally where review is not frequent enough to run a symptom-triggered regimen safely, because it establishes tolerance at a known time under direct observation rather than across a shift; where frequent review IS available, use symptom-triggered dosing instead. Reassessing at a fixed timeframe also gives the clinician a clear decision point for which subsequent regimen to commence, rather than an open-ended judgement call.</span>`],
    schedule: [
        `<b>Only in consultation</b> with Addiction Medicine or a similar CL service, given the risks of test dosing.`,
        `<b>Test dose:</b> ${drug} ${testDose} orally, once.`,
        `<b>Reassess at 1 hour, and again at 2 hours.</b> Absence of sedation at 1 hour is weak evidence of tolerance on its own: oral absorption is variable and 1 hour is approximately peak, so a patient who is going to be sedated may not be yet. <span class="src-tag src-local">LOCAL - rationale: the original protocol assessed only at 1 hour; the 2-hour reassessment is added locally to catch delayed absorption.</span>`,
        `<b>Assess sedation with a charted scale</b>, not an impression, so the finding is reproducible between assessors and across shifts.`,
        `<b>If sedated</b> (drowsy, slurred speech, ataxia): lower or normal tolerance. Manage cautiously with the Mild-Moderate regimen, or the Sub-Mild option if the score is below that band.`,
        `<b>If not sedated at 2 hours</b>: higher or established tolerance. Consider the Moderate-Severe schedule, or symptom-triggered dosing.`
    ],
    prn: [
        'Monitor the patient closely for signs of toxicity or escalating withdrawal.',
        'Consult a Drug & Alcohol specialist service if withdrawal severity remains unclear.'
    ]
    // TODO(clinical): should the assessment point move to 2 hours only, rather
    // than assessing at both 1 and 2 hours? Oral diazepam peaks at about 1 hour,
    // so a 1-hour reading is at best a partial answer.
    // TODO(clinical): which charted sedation scale should be used to define
    // "sedated" here — e.g. a Ramsay/RASS-style scale, or the local sedation
    // score already charted on the ward? The descriptive list is not reproducible.
});

// TODO(clinical): should the elderly/frail have a separately authored reduced
// oxazepam schedule rather than a converted one? A converted schedule starts
// them at 30mg qid, which is a substantial dose for the population it is aimed
// at, and the conversion caveat may not be enough on its own.

// The three safety lines that travel with every regimen pasted into the EMR.
//
// Plain text, not markup: the EMR export carries no citations by design (the
// app is the source of record and the paste is a prescribing aid), so these are
// the rendered sentences rather than tagged clinical blocks. Each is the
// plain-text twin of a statement already on the page - keeping them here rather
// than inline in script.js is what lets a test assert the two say the same thing.
export const EMR_SAFETY_LINES = {
    // Twin of the symptom-triggered regimen's dosing-interval note (LOCAL, with
    // the DT exception matching NSWCG §5.6.2).
    dosingInterval: 'Do not dose more frequently than 2-hourly, unless the patient has delirium tremens '
        + 'and is in a heavily medically monitored environment (HDU, or 1:1 nursing with continuous observation).',
    // Twin of "De-escalate / withhold if sedated" in the Escalation triggers block.
    sedation: 'DO NOT give a regular or PRN dose if the patient is sedated - withhold the dose and review '
        + 'the regular schedule. If multiple doses are withheld, the schedule is too high.',
    // Twin of the escalation block's review threshold (NSWCG §5.4.4).
    review: (drug, max) => `Medical review if scores are rising, if withdrawal is not responding, or if the `
        + `total ${drug} dose exceeds ${max} in 24 hours.`
};

export const REGIMEN_CONFIG = {
    "Diazepam": {
        name: "Diazepam",
        // The 24-hour total at which a medical officer must review. Held at drug
        // level because it applies to every regimen for that drug, not only to
        // symptom-triggered dosing where it was previously stated.
        reviewMax: '80mg',
        mild: {
            name: 'Mild-Moderate',
            band: band('10-15', '4-14'),
            monitoring: BAND_MONITORING.mild,
            caveat: [AWS_BAND_CAVEAT],
            schedule: [{ dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 10, freq: 'bd' }, { dose: 5, freq: 'bd' }, { dose: 5, freq: 'nocte' }],
            prn: [{ range: '10-15', aws: '4-14', dose: 10 }, { range: '15-20', aws: '4-14', dose: 20 }],
            symptom_triggered: {
                title: 'Alternative: Symptom-Triggered Regimen',
                note: symptomTriggeredNote('diazepam')
            }
        },
        submild: subMildCell('diazepam', 'diazepam 5mg qid on Day 1, 5mg tds on Day 2, 5mg bd on Day 3, 2.5mg bd on Day 4, then 2.5mg nocte on Day 5'),
        symptom: symptomTriggeredCell('diazepam', ['0-5mg diazepam', '10mg diazepam', '20mg diazepam'], '80mg'),
        moderate: { name: 'Moderate-Severe', band: band('15-20', '4-14'), monitoring: BAND_MONITORING.moderate, caveat: [AWS_BAND_CAVEAT], schedule: [{ dose: 20, freq: 'qid' }, { dose: 15, freq: 'qid' }, { dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 5, freq: 'tds' }, { dose: 5, freq: 'bd', note: 'Further doses beyond day 6 are generally not required for diazepam' }], prn: [{ range: '10-15', aws: '4-14', dose: 10 }, { range: '15-20', aws: '4-14', dose: 20 }] },
        // TODO(clinical): confirm the preferred Day 2 default after a loading day —
        // symptom-triggered dosing, or the Moderate-Severe fixed schedule from its
        // Day 2 row? Both are offered below because NSWCG §5.4.4 prefers the former
        // while local practice has used the latter; only one should be the default.
        severe: {
            name: 'Severe',
            band: band('&gt; 20', '&gt; 14'),
            monitoring: BAND_MONITORING.severe,
            // Setting is a first-order decision — it was previously buried under
            // PRN dosing, where it read as an afterthought to the drug chart.
            setting: [
                `<b>Decide the setting before the drug chart.</b> Severe withdrawal is managed in <b>HDU</b>. Escalate to <b>ICU</b> for severe withdrawal with major complications, or with severe intercurrent illness. <span class="src-tag src-nswcg">NSWCG §5.4.2, §5.6.2</span>`,
                `<b>Indications for specialist inpatient care:</b> predicted moderate-severe withdrawal; a history of alcohol-related delirium or seizures; multiple drug dependencies; significant other medical problems; repeated inability to complete community withdrawal. <span class="src-tag src-nswcg">NSWCG §5.4.2</span>`
            ],
            schedule: [
                `<b>Day 1 - loading.</b> Diazepam 20mg <b>2-hourly</b> until the patient is lightly sedated and easily rousable, or until a total of 80mg is reached. <b>The loading day is Day 1.</b> Medical officer review is required before exceeding 80mg in 24 hours. <span class="src-tag src-nswcg">NSWCG §5.4.4, Table 5.4</span>`,
                `<b>Delirium tremens - hourly loading, monitored settings only.</b> For withdrawal delirium specifically, diazepam 20mg hourly to a total of 80mg/24h may be used in a monitored setting (HDU, or 1:1 nursing with continuous observation) - see Special Cases &rarr; Alcohol withdrawal delirium. Do not use hourly loading for severe withdrawal without delirium: oral diazepam peaks at around one hour, so hourly dosing outside DT stacks doses whose effect has not yet been observed. <span class="src-tag src-nswcg">NSWCG §5.6.2</span>`,
                `<b>Day 2 onward - do not repeat a loading day.</b> Following loading, no further loading diazepam is generally needed once the patient is settled: diazepam's long-acting active metabolites are the reason loading works, and a fixed 80mg day behind the load is double dosing. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Preferred handover:</b> symptom-triggered dosing in a reducing regimen (see the Symptom-Triggered regimen). <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Alternative handover:</b> if a fixed schedule is preferred, commence at the <b>Day 2 row</b> of the Moderate-Severe schedule - diazepam 15mg qid - and taper from there as written. Do not start that schedule at its Day 1 row. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`
            ],
            prn: [
                `<b>80mg in 24 hours - medical officer review required.</b> This is a review threshold, not a ceiling. Assess for other pathology before giving more (see Special Cases &rarr; alcohol withdrawal delirium is a diagnosis of exclusion). <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>If no other cause is found and withdrawal persists</b> - consider diazepam 10-20mg 2-hourly PRN, to a <b>maximum of 120mg in 24 hours</b>. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Persistent agitation or hallucinations, or more than 120mg in 24 hours</b> - specialist advice required: DASAS <a href="tel:1800023687">1800 023 687</a> (regional, rural and remote NSW) or <a href="tel:0283821006">(02) 8382 1006</a> (Sydney metropolitan area), or the on-call addiction medicine specialist or addiction psychiatrist. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`
            ]
        },
        unknown: testDoseCell('Diazepam', '10mg')
    },
    "Oxazepam": {
        name: "Oxazepam",
        // 240mg = the 80mg diazepam review point at the 1:3 conversion ratio,
        // carried over from the symptom-triggered regimen where it already applied.
        reviewMax: '240mg',
        mild: {
            name: 'Mild-Moderate',
            band: band('10-15', '4-14'),
            monitoring: BAND_MONITORING.mild,
            caveat: [OXAZEPAM_CONVERSION_CAVEAT, AWS_BAND_CAVEAT],
            schedule: [{ dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 30, freq: 'bd' }, { dose: 15, freq: 'bd' }, { dose: 15, freq: 'nocte' }],
            prn: [{ range: '10-15', aws: '4-14', dose: 30 }, { range: '15-20', aws: '4-14', dose: 60 }],
            symptom_triggered: {
                title: 'Alternative: Symptom-Triggered Regimen',
                note: symptomTriggeredNote('oxazepam')
            }
        },
        submild: subMildCell('oxazepam', 'oxazepam 15mg qid on Day 1, 15mg tds on Day 2, 15mg bd on Day 3, 7.5mg bd on Day 4, then 7.5mg nocte on Day 5', [OXAZEPAM_CONVERSION_CAVEAT]),
        symptom: symptomTriggeredCell('oxazepam', ['0-15mg oxazepam', '30mg oxazepam', '60mg oxazepam'], '240mg', [OXAZEPAM_CONVERSION_CAVEAT]),
        moderate: { name: 'Moderate-Severe', band: band('15-20', '4-14'), monitoring: BAND_MONITORING.moderate, caveat: [OXAZEPAM_CONVERSION_CAVEAT, AWS_BAND_CAVEAT], schedule: [{ dose: 60, freq: 'qid' }, { dose: 45, freq: 'qid' }, { dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 15, freq: 'tds' }, { dose: 15, freq: 'bd', note: 'Further doses beyond day 6 are discretionary and not in NSW Health guidelines for diazepam-based withdrawals. However, a day 7 dose for oxazepam (e.g. 15mg nocte) is sometimes indicated due to the shorter half-life.' }], prn: [{ range: '10-15', aws: '4-14', dose: 30 }, { range: '15-20', aws: '4-14', dose: 60 }] },
        // Deliberately has no schedule. The population that needs oxazepam —
        // decompensated liver disease, respiratory insufficiency, elderly/frail,
        // cerebral trauma — is precisely the population NSWCG §5.6.3 says must not
        // receive a loading regimen, so a severe-withdrawal oxazepam regimen is a
        // combination that should never render as a set of numbers to follow.
        severe: {
            name: 'Severe',
            band: band('&gt; 20', '&gt; 14'),
            monitoring: BAND_MONITORING.severe,
            routing: [
                `<b>There is no oxazepam regimen for severe withdrawal.</b> Loading is a diazepam concept: it works because of diazepam's long-acting active metabolites, which oxazepam does not have. Converting a diazepam loading dose would give roughly 240mg of oxazepam to the patients least able to tolerate it. <span class="src-tag src-nswcg">NSWCG §5.6.3</span>`,
                `<b>This is not specific to severe withdrawal.</b> The situations that favour oxazepam over diazepam - significant liver impairment, respiratory insufficiency, elderly or frail patients, cerebral trauma - are the same situations in which a loading regimen would not be appropriate. Loading regimens for oxazepam have therefore been omitted entirely, at every severity. <span class="src-tag src-nswcg">NSWCG §5.6.3</span>`,
                `<b>Instead:</b> titrate oxazepam <b>15-30mg</b> carefully against response - do not follow a fixed schedule. <span class="src-tag src-nswcg">NSWCG §5.6.3</span>`,
                `<b>Consider HDU.</b> Where escalation is needed, NSWCG options are an <b>IV midazolam infusion monitored in HDU</b>, or <b>IM lorazepam</b> where no HDU is available. <span class="src-tag src-nswcg">NSWCG §5.6.2</span>`,
                `<b>Contact specialist advice now:</b> DASAS <a href="tel:1800023687">1800 023 687</a> (regional, rural and remote NSW) or <a href="tel:0283821006">(02) 8382 1006</a> (Sydney metropolitan), or the on-call addiction medicine specialist or addiction psychiatrist. <span class="src-tag src-nswcg">NSWCG §2.6, §5.6.2</span>`
            ]
        },
        unknown: testDoseCell('Oxazepam', '30mg', [OXAZEPAM_CONVERSION_CAVEAT])
    }
};
