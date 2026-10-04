// The inpatient alcohol withdrawal checklist: the Inpatient Guidelines page,
// reduced to what is done at the bedside, in the order it is done.
//
// It summarises the guideline tabs; it does not replace them. Every step names
// the tab it was drawn from (`tab`) so the page can link back to the full text,
// and where a step makes a decision (drug, band, regimen type) the decision is a
// pure function below, so it can be tested and cannot drift from the tab.
//
// Nothing ticked here is stored. The page holds it in memory only, and it is
// gone when the app is closed or "Start again" is pressed.

import { lowerFirst } from './flowchart.js';

export const BENZO_FACTORS = [
    { id: 'liver', label: 'Significant liver impairment (e.g. cirrhosis, high bilirubin, coagulopathy)' },
    { id: 'resp', label: 'Respiratory insufficiency or risk of respiratory depression (e.g. COPD)' },
    { id: 'elderly', label: 'Elderly or frail' },
    { id: 'cerebral', label: 'Cerebral trauma / CVA where over-sedation is a risk' },
];

export const BAND_INTAKE = [
    { id: 'low', label: '≤ 14 drinks/day', band: 'mild' },
    { id: 'high', label: '≥ 15 drinks/day', band: 'moderate' },
];

export const BAND_RISKS = [
    { id: 'previous', label: 'Previous severe withdrawal' },
    { id: 'bal', label: 'Higher BAL on arrival, or presenting already in withdrawal' },
    { id: 'medical', label: 'Coexisting medical conditions' },
    { id: 'early_seizure', label: 'Seizures early in withdrawal' },
    { id: 'cns', label: 'Co-occurring dependence on other CNS depressants' },
];

// Keys match REGIMEN_CONFIG severities and the Regimens tab buttons, so the
// checklist can open the tab on the band it chose.
export const BAND_NAMES = { mild: 'Mild-Mod', moderate: 'Mod-Sev', severe: 'Severe' };
const BAND_STEP_UP = { mild: 'moderate', moderate: 'severe', severe: 'severe' };

export const LOADING_CRITERIA = [
    { id: 'delirium', label: 'Delirium' },
    { id: 'seizure_now', label: 'Seizure or hallucinations' },
    { id: 'seizure_history', label: 'History of withdrawal seizures (at any score)' },
];

export const FIXED_CRITERIA = [
    { id: 'comorbid', label: 'Significant medical or psychiatric comorbidity, or psychotropic / adrenergically active medications' },
    { id: 'staff', label: 'Staff inexperienced in, or unable to deliver, reliable symptom-triggered dosing' },
    { id: 'poly', label: 'Polysubstance withdrawal' },
];

export const REGIMEN_TYPE_NAMES = { fixed: 'Fixed schedule', symptom: 'Symptom-triggered', loading: 'Loading' };

export const ESCALATION_TRIGGERS = [
    'Both daily PRN doses used and the patient remains symptomatic.',
    'Two consecutive CIWA-Ar (or AWS) scores in the band above the current schedule.',
    'CIWA-Ar (or AWS) rising on days 3-4 of an established taper.',
    'Total diazepam ≥ 80mg in 24 hours → medical officer review to exclude other pathology. '
        + '<span class="src-tag src-nswcg">NSWCG §5.4.4</span>',
    'Any seizure, delirium, hallucinations or hyperthermia → treat as severe; see Special Cases.',
];

// type: 'ticks' is a plain checklist; the other types are decisions rendered by
// the page from the lists above. `summary` is the one-line recap shown once a
// step is collapsed.
export const INPATIENT_CHECKLIST = [
    {
        id: 'prereq',
        title: 'Before you start',
        tab: 'prerequisites',
        type: 'ticks',
        items: [
            { id: 'diagnosis', html: 'Alcohol withdrawal is the probable diagnosis (DSM-5 / ICD-11), and mimics - sepsis, metabolic disturbance, intracranial events - have been considered.' },
            { id: 'bal', html: 'BAL checked. Not a contraindication: dose when low or falling (0.05-0.10%). <span class="src-tag src-nswcg">NSWCG §5.1, §5.3</span>' },
            { id: 'bloods', html: 'Bloods: FBC, magnesium, UEC, LFT, plus INR and albumin to guide the benzodiazepine choice. <span class="src-tag src-nswcg">NSWCG §5.4.5</span>' },
            { id: 'scale', html: 'CIWA-Ar (or AWS) started 2-4 hourly, and at least 2-hourly at first once a regimen starts.' },
            { id: 'followup', html: 'A post-withdrawal follow-up plan is in place.' },
        ],
        warning: 'Last drink more than 24-48 hours ago, or the history unreliable? Seek specialist advice first, and consider the test-dose protocol.',
    },
    {
        id: 'thiamine',
        title: 'Thiamine',
        tab: 'thiamine',
        type: 'ticks',
        items: [
            { id: 'dose', html: 'Thiamine 300mg IV (preferred) or IM daily for 3 days, then 300mg oral daily for 2-3 weeks. <span class="src-tag src-nswcg">NSWCG §5.4.7</span>' },
            { id: 'glucose', html: 'Given before any glucose-containing fluids.' },
            { id: 'im', html: 'If IM: platelets and coagulation checked first.' },
            { id: 'wks', html: 'Screened for Wernicke-Korsakoff (confusion, ataxia, ophthalmoplegia, memory disturbance, malnutrition). If suspected: 500mg IV TDS for at least 5 days. <span class="src-tag src-nswcg">NSWCG §5.4.7</span>' },
            { id: 'magnesium', html: 'Magnesium replete.' },
        ],
    },
    { id: 'benzo', title: 'Choose the benzodiazepine', tab: 'benzo-choice', type: 'benzo' },
    { id: 'band', title: 'Pick the band', tab: 'assessment-banding', type: 'band' },
    { id: 'regimen', title: 'Regimen type', tab: 'regimens', type: 'regimen' },
    {
        id: 'review',
        title: 'At each review',
        tab: 'monitoring-discharge',
        type: 'ticks',
        items: [
            { id: 'obs', html: 'Observations each review: temperature, pulse rate and rhythm, blood pressure, CIWA-Ar or AWS, hydration. <span class="src-tag src-nswcg">NSWCG §5.4.5, Table 5.6</span>' },
            { id: 'frequency', html: 'Scoring frequency set by severity, from the table on the Monitoring tab.' },
            { id: 'rass', html: 'RASS checked before every regular or PRN dose: give only at RASS 0 or above; at -1 withhold; at -2 or below withhold and arrange medical review.' },
        ],
    },
    { id: 'escalate', title: 'Escalate if…', tab: 'monitoring-discharge', type: 'escalate' },
];

export function newChecklistState() {
    return {
        ticks: {}, benzoFactors: [], intake: null, risks: [], loading: [], fixed: [],
        picked: null, done: {}, open: 'prereq', fromTriage: [],
    };
}

// Benzo Choice tab: oxazepam for any of the four, otherwise diazepam.
export function chooseBenzo(factors) {
    return factors.length > 0 ? 'Oxazepam' : 'Diazepam';
}

// Assessment & Banding tab: the intake split is the entry point, and any NSWCG
// risk factor moves the patient up one band regardless of intake.
export function chooseBand(intake, risks) {
    const start = BAND_INTAKE.find((i) => i.id === intake)?.band;
    if (!start) return null;
    return risks.length > 0 ? BAND_STEP_UP[start] : start;
}

// Regimens tab: loading for severe withdrawal or any loading criterion; a fixed
// schedule where any fixed criterion applies; otherwise the clinician chooses,
// because symptom-triggered dosing is permitted there, not required.
export function chooseRegimenType({ band, loading, fixed, picked }) {
    if (band === 'severe' || loading.length > 0) return 'loading';
    if (fixed.length > 0) return 'fixed';
    return picked || null;
}

// Triage answers carried into the checklist, so a clinician arriving from the
// triage result does not answer the same question twice. Each one is shown as
// "from triage" and can be unticked.
export function prefillFromTriage(answers) {
    const state = newChecklistState();
    if (answers.drinks) state.intake = answers.drinks === '15plus' ? 'high' : 'low';
    if (answers.history === 'yes') state.risks.push('previous');
    if (answers.flags?.includes('in_withdrawal')) state.risks.push('bal');
    if (answers.flags?.includes('cns')) state.risks.push('cns');
    state.fromTriage = [...state.risks, ...(state.intake ? ['intake'] : [])];
    return state;
}

export function stepProgress(step, state) {
    if (step.type !== 'ticks') return null;
    const ticked = step.items.filter((i) => state.ticks[`${step.id}.${i.id}`]).length;
    return { ticked, total: step.items.length };
}

const stripTags = (html) => html.replace(/<span class="src-tag[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, '').trim();

// The EMR paste: the decisions, then anything left unticked. Source chips are
// stripped, because an EMR field shows them as raw text.
export function checklistSummary(state) {
    const band = chooseBand(state.intake, state.risks);
    const type = chooseRegimenType({ band, loading: state.loading, fixed: state.fixed, picked: state.picked });
    const lines = ['Inpatient alcohol withdrawal checklist:'];
    lines.push(`- Benzodiazepine: ${chooseBenzo(state.benzoFactors)}`);
    if (band) {
        const why = state.risks.map((r) => lowerFirst(BAND_RISKS.find((x) => x.id === r).label));
        lines.push(`- Band: ${BAND_NAMES[band]}${why.length ? ` (moved up a band: ${why.join('; ')})` : ''}`);
    } else {
        lines.push('- Band: not yet chosen');
    }
    lines.push(`- Regimen type: ${type ? REGIMEN_TYPE_NAMES[type] : 'not yet chosen'}`);

    const open = [];
    for (const step of INPATIENT_CHECKLIST) {
        if (step.type !== 'ticks') continue;
        for (const item of step.items) {
            if (!state.ticks[`${step.id}.${item.id}`]) open.push(`- ${step.title}: ${stripTags(item.html)}`);
        }
    }
    lines.push(open.length ? 'Not yet ticked:' : 'All checklist items ticked.');
    lines.push(...open);
    return lines.join('\n');
}
