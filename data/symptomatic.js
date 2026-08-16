// Shared symptomatic medication content (P2-08).
//
// These regimens used to be copied into the opioid, benzodiazepine, cannabis
// and psychostimulant pages by hand, and had already drifted apart: the same
// symptom carried different doses on different pages, and several entries had
// no daily maximum at all. One structure, rendered per substance, removes the
// class of bug where fixing a dose on one page leaves three others wrong.
//
// PROVENANCE. Entries the August 2022 NSW Clinical Guidance specifies are
// tagged with their table. Entries carried forward from the previous site
// content, whose source was not established during this revision, say so
// rather than borrowing the credibility of the tagged ones.

const UNSOURCED = `<span class="src-tag src-local">LOCAL - rationale: carried forward unchanged; source not yet confirmed.</span>`;

// TODO(review): establish the provenance of promethazine for cannabis
// withdrawal insomnia, currently carried-forward local practice, and re-tag
// it against whichever guideline it came from. The rest of the entries this
// note used to cover (metoclopramide, ondansetron, hyoscine butylbromide,
// loperamide, paracetamol/ibuprofen) have since been resolved against
// NSWCG per substance, or dropped as not relevant to that substance.

// Common to every substance. Same words everywhere, because they are the rules
// a clinician most often skips when reading a symptomatic table. The NRT line
// that used to sit here was cannabis-specific wording ("mixed cannabis with
// tobacco") rendering on every substance's page, including ones with no
// connection to cannabis — it now lives with cannabis's own items instead.
export const SYMPTOMATIC_UNIVERSAL = [
    `Symptomatic medications are <b>generally not continued beyond 7 days</b> without medical review and a clear indication. <span class="src-tag src-nswcg">NSWCG §6.3.4, §8.3.4</span>`,
    `For inpatient or residential withdrawal, <b>cease symptomatic medication 1-2 days before discharge</b> to assess how the patient copes without it. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`,
    `<b>Supervise access</b> - daily dispensing, or supervision by a carer. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`,
    `Use <b>caution with any psychoactive medication</b> in a patient with a substance use disorder. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`
];

// NSWCG Table 8.6, p.53 — verified against the published table, opioid
// section. Doses and frequencies are quoted as the table states them, not as
// the site's old generic GI/analgesic block had them (several differed: see
// the frequency of metoclopramide, ondansetron and ibuprofen below). That
// generic block is gone now — cannabis and gabapentinoid got their own
// verified equivalents (below), and benzodiazepine and psychostimulant
// dropped it as not relevant enough to their withdrawal syndromes to carry.
const OPIOID_GENERAL_SYMPTOMS = [
    {
        symptom: 'Muscle aches and pains',
        lines: [`Paracetamol 1g oral every 4 hours PRN, <b>maximum 4g in 24 hours</b>, <b>or</b> ibuprofen 400mg oral every 6 hours PRN (avoid if history of peptic ulcer or gastritis). <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
    },
    {
        symptom: 'Nausea',
        lines: [`Metoclopramide 10mg oral every 4-6 hours PRN, <b>or</b> prochlorperazine 5mg every 4-6 hours PRN, <b>or</b> ondansetron 4-8mg every 12 hours PRN. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
    },
    {
        symptom: 'Abdominal cramps',
        lines: [`Hyoscine butylbromide 20mg oral every 6 hours PRN. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
    },
    {
        symptom: 'Diarrhoea',
        lines: [
            `Kaomagma, <b>or</b> loperamide 2mg PRN. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`,
            `Standard loperamide dosing: after each loose bowel action, <b>maximum 16mg in 24 hours</b>. <span class="src-tag src-local">LOCAL - rationale: NSWCG states the 2mg dose but not a maximum; this is standard loperamide prescribing information.</span>`
        ]
    },
    {
        symptom: 'Dehydration or electrolyte disturbance',
        lines: [`Fluid and electrolyte replacement. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
    }
];

// NSWCG Table 6.2 — verified against the published table, cannabis section.
// Diarrhoea is deliberately absent: it is not a symptom row in this table.
// Nausea and the headache/pain row name the drug classes but the table
// gives no doses for either; the doses stated here are a separately-tagged
// local addition, not implied by the NSWCG citation on the drug-choice
// line.
const CANNABIS_SYMPTOMATIC = [
    {
        symptom: 'Nausea',
        lines: [
            `Metoclopramide, <b>or</b> ondansetron. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`,
            `Standard dosing: metoclopramide 10mg oral up to TDS PRN, <b>or</b> ondansetron 4-8mg oral up to TDS PRN. <span class="src-tag src-local">LOCAL - rationale: NSWCG names the drugs but gives no dose for this row; these are standard prescribing doses.</span>`
        ]
    },
    {
        symptom: 'Stomach pains',
        lines: [`Hyoscine butylbromide (e.g. Buscopan) 20mg oral TDS PRN. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`]
    },
    {
        symptom: 'Physical pain, headaches',
        lines: [
            `Paracetamol, <b>or</b> non-steroidal anti-inflammatory agents. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`,
            `Standard dosing: paracetamol 1g oral every 4 hours PRN, <b>maximum 4g in 24 hours</b>, <b>or</b> ibuprofen 400mg oral every 6 hours PRN (avoid if history of peptic ulcer or gastritis). <span class="src-tag src-local">LOCAL - rationale: NSWCG names the drug classes but gives no dose for this row; these are the same standard doses used for the equivalent opioid entry (NSWCG Table 8.6).</span>`
        ]
    }
];

// NSWCG Table 10.2 — verified against the published table, gabapentinoid
// section. Content is identical to Table 6.2 (cannabis) except the stomach
// pains row, which does not name a brand here. Diarrhoea is again absent —
// not a symptom row in this table either.
const GABAPENTINOID_SYMPTOMATIC = [
    {
        symptom: 'Nausea',
        lines: [
            `Metoclopramide, <b>or</b> ondansetron. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`,
            `Standard dosing: metoclopramide 10mg oral up to TDS PRN, <b>or</b> ondansetron 4-8mg oral up to TDS PRN. <span class="src-tag src-local">LOCAL - rationale: NSWCG names the drugs but gives no dose for this row; these are standard prescribing doses.</span>`
        ]
    },
    {
        symptom: 'Stomach pains',
        lines: [`Hyoscine butylbromide 20mg oral TDS PRN. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`]
    },
    {
        symptom: 'Physical pain, headaches',
        lines: [
            `Paracetamol, <b>or</b> non-steroidal anti-inflammatory agents. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`,
            `Standard dosing: paracetamol 1g oral every 4 hours PRN, <b>maximum 4g in 24 hours</b>, <b>or</b> ibuprofen 400mg oral every 6 hours PRN (avoid if history of peptic ulcer or gastritis). <span class="src-tag src-local">LOCAL - rationale: NSWCG names the drug classes but gives no dose for this row; these are the same standard doses used for the equivalent opioid entry (NSWCG Table 8.6).</span>`
        ]
    }
];

export const SYMPTOMATIC = {
    opioid: {
        title: 'Symptomatic medications - opioid withdrawal',
        items: [
            {
                symptom: 'Autonomic symptoms (sweating, anxiety, restlessness)',
                lines: [
                    `Clonidine <b>75-150 microgram every 6-8 hours</b> as tolerated, with regular blood pressure monitoring. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`,
                    `<b>Test dose protocol.</b> Give 75 microgram. Check lying and standing blood pressure at 30 minutes. <b>Do not use</b> if the patient is hypotensive (systolic &lt; 90 or diastolic &lt; 50), heart rate &lt; 50, or there is clinical evidence of impaired circulation. If tolerated, give a second 75 microgram dose and continue. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`,
                    `<b>Taper after prolonged use</b> to avoid rebound hypertension. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`
                ]
            },
            ...OPIOID_GENERAL_SYMPTOMS,
            {
                symptom: 'Severe continued gastrointestinal symptoms (second line)',
                lines: [`Octreotide 0.05-0.1mg subcutaneously every 8-12 hours PRN. <b>Hospital setting only.</b> <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
            },
            {
                symptom: 'Insomnia',
                lines: [`Temazepam 10-20mg nocte, ceasing after 3-5 nights. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
            },
            {
                symptom: 'Agitation or anxiety',
                lines: [`Diazepam 5mg oral QID PRN. Taper/cease the dose over 3-5 days. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
            }
        ]
    },

    cannabis: {
        title: 'Symptomatic medications - cannabis withdrawal',
        intro: `Medications are typically only required for severe symptoms.`,
        items: [
            ...CANNABIS_SYMPTOMATIC,
            {
                symptom: 'Restlessness, anxiety, irritability',
                lines: [
                    `Diazepam 5-10mg oral BD or TDS PRN, short course only. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`,
                    `<b>Or</b> olanzapine 2.5-5mg oral BD PRN. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`
                ]
            },
            {
                symptom: 'Insomnia',
                lines: [
                    `Diazepam 5-10mg oral nocte, <b>or</b> z-drugs: zolpidem 10-20mg nocte, or zopiclone 7.5-15mg nocte. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`,
                    `Promethazine 25mg oral nocte PRN. ${UNSOURCED}`
                ]
            },
            {
                symptom: 'Nicotine co-use',
                lines: [`Offer <b>NRT</b> to patients who mixed cannabis with tobacco, or who smoke. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`]
            }
        ]
    },

    gabapentinoid: {
        title: 'Symptomatic medications - gabapentinoid withdrawal',
        intro: `The taper is the mainstay of treatment; these are adjuncts, for no more than 7 days.`,
        items: [
            ...GABAPENTINOID_SYMPTOMATIC,
            {
                symptom: 'Restlessness, anxiety, irritability',
                lines: [
                    `Diazepam 5-10mg oral BD or TDS PRN, short course only. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`,
                    `<b>Or</b> olanzapine 2.5-5mg oral BD PRN. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`
                ]
            },
            {
                symptom: 'Insomnia',
                lines: [`Diazepam 5-10mg oral nocte, <b>or</b> z-drugs: zolpidem 10-20mg nocte, or zopiclone 7.5-15mg nocte. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`]
            }
        ]
    },

    psychostimulant: {
        title: 'Symptomatic medications - psychostimulant withdrawal',
        // Every entry here previously lacked a daily maximum, which is the
        // difference between a PRN order and an open-ended one. The generic
        // GI/analgesic block (nausea, stomach cramps, diarrhoea, headache)
        // was dropped as not relevant enough to psychostimulant withdrawal
        // to carry here — see NSWCG §7.3.4 for what this page is actually
        // sourced from.
        items: [
            {
                symptom: 'Agitation',
                lines: [
                    `Diazepam 5-10mg oral PRN 6-hourly, <b>maximum 40mg/day over 3 days</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`,
                    `As benzodiazepine dependence may coexist with psychostimulant dependence, <b>assess for coexisting benzodiazepine dependence and withdrawal risk</b> before using diazepam. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`
                ]
            },
            {
                symptom: 'Agitation or low-level psychotic symptoms (delusions, paranoia)',
                lines: [
                    `Olanzapine 2.5-5mg oral PRN 6-8 hourly, <b>maximum 20mg/24 hours</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`,
                    `<b>Alternative:</b> quetiapine immediate release 25-50mg oral PRN 8-hourly, <b>maximum 150mg/24 hours</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`,
                    `Seek specialist psychiatric input for psychosis or severe agitation. <span class="src-tag src-local">LOCAL - rationale: NSWCG §7.3.4 describes the medications for agitation and low-level psychotic symptoms but does not itself state when to escalate to psychiatry; this is a local addition.</span>`
                ]
            }
        ]
    }
};
