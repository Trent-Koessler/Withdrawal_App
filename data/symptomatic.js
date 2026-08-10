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

const UNSOURCED = `<span class="src-tag src-local">LOCAL — rationale: carried forward unchanged; source not yet confirmed.</span>`;

// TODO(review): establish the provenance of the symptomatic entries currently
// marked as carried-forward local practice (metoclopramide, ondansetron,
// hyoscine butylbromide, loperamide, paracetamol/ibuprofen, promethazine) and
// re-tag them against whichever guideline they came from.

// Common to every substance. Same words everywhere, because they are the rules
// a clinician most often skips when reading a symptomatic table.
export const SYMPTOMATIC_UNIVERSAL = [
    `Symptomatic medications are <b>generally not continued beyond 7 days</b> without medical review and a clear indication. <span class="src-tag src-nswcg">NSWCG §6.3.4, §8.3.4</span>`,
    `For inpatient or residential withdrawal, <b>cease symptomatic medication 1-2 days before discharge</b> to assess how the patient copes without it. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`,
    `<b>Supervise access</b> — daily dispensing, or supervision by a carer. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`,
    `Use <b>caution with any psychoactive medication</b> in a patient with a substance use disorder. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`,
    `Offer <b>NRT</b> to patients who mixed cannabis with tobacco, or who smoke. <span class="src-tag src-nswcg">NSWCG §6.3.4</span>`
];

// Shared GI/analgesic block. Identical across substances in the previous site
// content, so it stays identical here by construction.
const GENERAL_SYMPTOMS = [
    {
        symptom: 'Nausea and vomiting',
        lines: [`Metoclopramide 10mg oral/IM/IV up to TDS PRN, <b>or</b> ondansetron 4-8mg oral/IV up to TDS PRN. ${UNSOURCED}`]
    },
    {
        symptom: 'Stomach cramps',
        lines: [`Hyoscine butylbromide 20mg oral QID PRN. ${UNSOURCED}`]
    },
    {
        symptom: 'Diarrhoea',
        lines: [`Loperamide 2mg oral after each loose bowel action, maximum 16mg/day. ${UNSOURCED}`]
    },
    {
        symptom: 'Headache and muscle aches',
        lines: [`Paracetamol 1g oral QID PRN, and/or ibuprofen 400mg oral TDS PRN. ${UNSOURCED}`]
    }
];

// The local antipsychotic-first-line preference for anxiety/agitation. This is
// the site's clearest documented departure from NSWCG and the model the rest of
// the tagging follows, so its rationale is spelled out in full.
const ANTIPSYCHOTIC_FIRST_LINE = `<b>Local preference:</b> quetiapine 25-50mg TDS or olanzapine 2.5mg TDS first line for anxiety/agitation, with benzodiazepines second line. <span class="src-tag src-local">LOCAL — rationale: other published guidelines and local clinical experience suggest better symptom control with an antipsychotic first line, and it avoids introducing a benzodiazepine to a population at risk of substituting dependence.</span>`;

export const SYMPTOMATIC = {
    opioid: {
        title: 'Symptomatic medications — opioid withdrawal',
        items: [
            {
                symptom: 'Autonomic symptoms (sweating, anxiety, restlessness)',
                lines: [
                    `Clonidine <b>75-150 microgram every 6-8 hours</b> as tolerated, with regular blood pressure monitoring. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`,
                    `<b>Test dose protocol.</b> Give 75 microgram. Check lying and standing blood pressure at 30 minutes. <b>Do not use</b> if the patient is hypotensive (systolic &lt; 90 or diastolic &lt; 50), heart rate &lt; 50, or there is clinical evidence of impaired circulation. If tolerated, give a second 75 microgram dose and continue. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`,
                    `<b>Taper after prolonged use</b> to avoid rebound hypertension. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`
                ]
            },
            ...GENERAL_SYMPTOMS,
            {
                symptom: 'Severe continued gastrointestinal symptoms (second line)',
                lines: [`Octreotide 0.05-0.1mg subcutaneously every 8-12 hours PRN. <b>Hospital setting only.</b> <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
            },
            {
                symptom: 'Insomnia',
                lines: [`Temazepam 10-20mg nocte, ceasing after 3-5 nights. <span class="src-tag src-nswcg">NSWCG Table 8.6</span>`]
            },
            {
                symptom: 'Severe agitation',
                lines: [`Diazepam 2.5-5mg oral QID PRN, maximum 20mg/day. Monitor closely if co-prescribed with opioids. ${UNSOURCED}`]
            }
        ]
    },

    benzodiazepine: {
        title: 'Symptomatic medications — benzodiazepine withdrawal',
        intro: `Management is primarily a controlled taper. These relieve specific complaints; <b>none of them prevent seizures or delirium</b>.`,
        items: GENERAL_SYMPTOMS
    },

    cannabis: {
        title: 'Symptomatic medications — cannabis withdrawal',
        intro: `Medications are typically only required for severe symptoms.`,
        items: [
            ...GENERAL_SYMPTOMS,
            {
                symptom: 'Severe anxiety or agitation',
                lines: [
                    `Diazepam 5mg oral BD-QID PRN, short course only (e.g. 3-5 days). <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`,
                    ANTIPSYCHOTIC_FIRST_LINE
                ]
            },
            {
                symptom: 'Insomnia',
                lines: [
                    `Promethazine 25mg oral nocte PRN. ${UNSOURCED}`,
                    `Z-drugs are listed options for sleep: zolpidem 10-20mg nocte, or zopiclone 7.5-15mg nocte. <span class="src-tag src-nswcg">NSWCG Table 6.2</span>`
                ]
            }
        ]
    },

    gabapentinoid: {
        title: 'Symptomatic medications — gabapentinoid withdrawal',
        intro: `The taper is the mainstay of treatment; these are adjuncts, for no more than 7 days.`,
        items: [
            ...GENERAL_SYMPTOMS,
            {
                symptom: 'Anxiety or agitation',
                lines: [
                    `Diazepam 5mg oral BD-QID PRN, short course only. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`,
                    ANTIPSYCHOTIC_FIRST_LINE
                ]
            },
            {
                symptom: 'Insomnia',
                lines: [`Zolpidem 10-20mg nocte, or zopiclone 7.5-15mg nocte. <span class="src-tag src-nswcg">NSWCG Table 10.2</span>`]
            }
        ]
    },

    psychostimulant: {
        title: 'Symptomatic medications — psychostimulant withdrawal',
        // Every entry here previously lacked a daily maximum, which is the
        // difference between a PRN order and an open-ended one.
        items: [
            ...GENERAL_SYMPTOMS,
            {
                symptom: 'Agitation and anxiety',
                lines: [`Diazepam 5-10mg oral PRN 6-hourly, <b>maximum 40mg/day over 3 days</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`]
            },
            {
                symptom: 'Severe agitation or psychotic symptoms',
                lines: [
                    `Olanzapine 2.5-5mg oral PRN 6-8 hourly, <b>maximum 20mg/24 hours</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`,
                    `Quetiapine immediate release 25-50mg oral PRN 8-hourly, <b>maximum 150mg/24 hours</b>. <span class="src-tag src-nswcg">NSWCG §7.3.4</span>`,
                    `Seek specialist psychiatric input for psychosis or severe agitation.`
                ]
            }
        ]
    }
};
