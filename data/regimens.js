// Extracted verbatim from script.js so this clinical data can be unit tested.
// Content is unchanged; only the surrounding declaration differs.

const symptomTriggeredNote = (drugName) => `Dose no more frequently than q4hrly. For unclear alcohol intake or anticipated mild alcohol withdrawal with unclear benzodiazepine requirements. Monitor the amount of ${drugName} used and reassess requirements regularly.`;

// Shown above any oxazepam schedule. The 1:3 ratio is a rough equivalence, and
// the taper *shape* below it was designed around diazepam's self-tapering
// kinetics — which is the part that does not transfer, and the part a converted
// table silently hides.
const OXAZEPAM_CONVERSION_CAVEAT = `<b>Conversion caveat.</b> Diazepam 10mg &asymp; oxazepam 30mg is an <b>approximate</b> ratio, not an equivalence. Oxazepam has no long-acting active metabolites, so it needs <b>more frequent administration and a slower step-down</b> than a diazepam taper of the same shape. Treat the schedule below as a starting point to be <b>titrated against response</b>, not a fixed course to complete. <span class="src-tag src-nswcg-adapted">NSWCG-adapted §5.6.3 — rationale: NSWCG gives the equivalence ratio and advises careful titration for this group, but publishes no oxazepam taper table; converting the diazepam schedule is a local step and the resulting shape is not guideline-derived.</span>`;

// TODO(clinical): should the elderly/frail have a separately authored reduced
// oxazepam schedule rather than a converted one? A converted schedule starts
// them at 30mg qid, which is a substantial dose for the population it is aimed
// at, and the conversion caveat may not be enough on its own.

export const REGIMEN_CONFIG = {
    "Diazepam": {
        name: "Diazepam",
        mild: {
            title: 'Mild-Moderate (CIWA 10-15)',
            schedule: [{ dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 10, freq: 'bd' }, { dose: 5, freq: 'bd' }, { dose: 5, freq: 'nocte' }],
            prn: [{ range: '10-15', dose: 10 }, { range: '15-20', dose: 20 }],
            symptom_triggered: {
                title: 'Symptom-Triggered Regimen',
                note: symptomTriggeredNote('diazepam'),
                doses: [
                    'CIWA-Ar score < 10 or AWS score < 4: 0-5 mg diazepam',
                    'CIWA-Ar 10-20 or AWS 4-14: 10 mg diazepam',
                    'CIWA-Ar > 20 or AWS > 14: 20 mg diazepam'
                ],
                review: 'Medical review required if total dose exceeds 80mg in 24 hours.'
            }
        },
        moderate: { title: 'Moderate-Severe (CIWA 15-20)', schedule: [{ dose: 20, freq: 'qid' }, { dose: 15, freq: 'qid' }, { dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 5, freq: 'tds' }, { dose: 5, freq: 'bd', note: 'Further doses beyond day 6 are generally not required for diazepam' }], prn: [{ range: '10-15', dose: 10 }, { range: '15-20', dose: 20 }] },
        // TODO(clinical): confirm the preferred Day 2 default after a loading day —
        // symptom-triggered dosing, or the Moderate-Severe fixed schedule from its
        // Day 2 row? Both are offered below because NSWCG §5.4.4 prefers the former
        // while local practice has used the latter; only one should be the default.
        severe: {
            title: 'Severe (CIWA > 20)',
            schedule: [
                `<b>Day 1 — loading.</b> Diazepam 20mg hourly until the patient is lightly sedated and easily rousable, or until a total of 80mg is reached. <b>The loading day is Day 1.</b> Medical officer review is required before exceeding 80mg in 24 hours. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Day 2 onward — do not repeat a loading day.</b> Following loading, no further loading diazepam is generally needed once the patient is settled: diazepam's long-acting active metabolites are the reason loading works, and a fixed 80mg day behind the load is double dosing. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Preferred handover:</b> symptom-triggered dosing in a reducing regimen (see the Symptom-Triggered regimen). <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`,
                `<b>Alternative handover:</b> if a fixed schedule is preferred, commence at the <b>Day 2 row</b> of the Moderate-Severe schedule — diazepam 15mg qid — and taper from there as written. Do not start that schedule at its Day 1 row. <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`
            ],
            prn: ["Manage in HDU.", "Review if total > 80mg diazepam equivalent."]
        },
        unknown: {
            title: 'Unknown Tolerance (Test-Dose Protocol)',
            schedule: [
                'NOTE: Should only be used in consultation with Addiction Medicine or similar CL service due to risks of test dosing. Administer test-dose: Diazepam 20mg orally once.',
                'Monitor the patient closely for sedation and clinical response after 1 hour.',
                'If patient shows signs of sedation (e.g. drowsy, slurred speech, ataxia): the patient has lower/normal tolerance. Manage cautiously with the Mild-Moderate regimen.',
                'If patient is NOT sedated after 1 hour: the patient has higher/established tolerance. Consider Moderate-Severe schedule or standard CIWA-Ar-based PRN dosing.'
            ],
            prn: [
                'Monitor patient closely for signs of toxicity or escalating withdrawal.',
                'Consult Drug & Alcohol specialist service if withdrawal severity is unclear.'
            ]
        }
    },
    "Oxazepam": {
        name: "Oxazepam",
        mild: {
            title: 'Mild-Moderate (CIWA 10-15)',
            caveat: OXAZEPAM_CONVERSION_CAVEAT,
            schedule: [{ dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 30, freq: 'bd' }, { dose: 15, freq: 'bd' }, { dose: 15, freq: 'nocte' }],
            prn: [{ range: '10-15', dose: 30 }, { range: '15-20', dose: 60 }],
            symptom_triggered: {
                title: 'Symptom-Triggered Regimen',
                note: symptomTriggeredNote('oxazepam'),
                doses: [
                    'CIWA-Ar score < 10 or AWS score < 4: 0-15 mg oxazepam',
                    'CIWA-Ar 10-20 or AWS 4-14: 30 mg oxazepam',
                    'CIWA-Ar > 20 or AWS > 14: 60 mg oxazepam'
                ],
                review: 'Medical review required if total dose exceeds 240mg in 24 hours.'
            }
        },
        moderate: { title: 'Moderate-Severe (CIWA 15-20)', caveat: OXAZEPAM_CONVERSION_CAVEAT, schedule: [{ dose: 60, freq: 'qid' }, { dose: 45, freq: 'qid' }, { dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 15, freq: 'tds' }, { dose: 15, freq: 'bd', note: 'Further doses beyond day 6 are discretionary and not in NSW Health guidelines for diazepam-based withdrawals. However, a day 7 dose for oxazepam (e.g. 15mg nocte) is sometimes indicated due to the shorter half-life.' }], prn: [{ range: '10-15', dose: 30 }, { range: '15-20', dose: 60 }] },
        // Deliberately has no schedule. The population that needs oxazepam —
        // decompensated liver disease, respiratory insufficiency, elderly/frail,
        // cerebral trauma — is precisely the population NSWCG §5.6.3 says must not
        // receive a loading regimen, so a severe-withdrawal oxazepam regimen is a
        // combination that should never render as a set of numbers to follow.
        severe: {
            title: 'Severe (CIWA > 20) — oxazepam',
            routing: [
                `<b>There is no oxazepam regimen for severe withdrawal.</b> Loading is a diazepam concept: it works because of diazepam's long-acting active metabolites, which oxazepam does not have. Converting a diazepam loading dose would give roughly 240mg of oxazepam to the patients least able to tolerate it. <span class="src-tag src-nswcg">NSWCG §5.6.3</span>`,
                `<b>Instead:</b> titrate oxazepam <b>15-30mg</b> carefully against response — do not follow a fixed schedule. <span class="src-tag src-nswcg">NSWCG §5.6.3</span>`,
                `<b>Consider HDU.</b> Where escalation is needed, NSWCG options are an <b>IV midazolam infusion monitored in HDU</b>, or <b>IM lorazepam</b> where no HDU is available. <span class="src-tag src-nswcg">NSWCG §5.6.2</span>`,
                `<b>Contact specialist advice now:</b> DASAS <a href="tel:1800023687">1800 023 687</a> (regional, rural and remote NSW) or <a href="tel:0283821006">(02) 8382 1006</a> (Sydney metropolitan), or the on-call addiction medicine specialist or addiction psychiatrist. <span class="src-tag src-nswcg">NSWCG §2.6, §5.6.2</span>`
            ]
        },
        unknown: {
            title: 'Unknown Tolerance (Test-Dose Protocol)',
            caveat: OXAZEPAM_CONVERSION_CAVEAT,
            schedule: [
                'NOTE: Should only be used in consultation with Addiction Medicine or similar CL service due to risks of test dosing. Administer test-dose: Oxazepam 60mg orally once.',
                'Monitor the patient closely for sedation and clinical response after 1 hour.',
                'If patient shows signs of sedation (e.g. drowsy, slurred speech, ataxia): the patient has lower/normal tolerance. Manage cautiously with the Mild-Moderate regimen.',
                'If patient is NOT sedated after 1 hour: the patient has higher/established tolerance. Consider Moderate-Severe schedule or standard CIWA-Ar-based PRN dosing.'
            ],
            prn: [
                'Monitor patient closely for signs of toxicity or escalating withdrawal.',
                'Consult Drug & Alcohol specialist service if withdrawal severity is unclear.'
            ]
        }
    }
};
