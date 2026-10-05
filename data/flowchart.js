// Alcohol withdrawal triage: the questions, the outcomes, and the one function
// that turns answers into an outcome.
//
// The triage used to be a tree of fourteen nodes in which the same history
// question was written out three times, once under each intake band, and the
// three copies had begun to say different things. It is now a short list of
// questions and a decision function. Both views of the page - every question at
// once, and one question per screen - read the same answers and call the same
// function, so they cannot disagree about where a patient goes.

// `askedWhen` decides whether a question applies given the answers so far. A
// question that stops applying (the intake answer changed) has its answer
// dropped by the page, so a stale answer can never steer the outcome.
export const TRIAGE_QUESTIONS = [
    {
        id: 'need',
        title: 'Assessment',
        text: 'After a comprehensive drug and alcohol assessment, does the patient need alcohol withdrawal management?',
        options: [
            { value: 'yes', label: 'Yes', summary: 'needs withdrawal management' },
            { value: 'no', label: 'No', summary: 'withdrawal management not needed' },
        ],
    },
    {
        id: 'drinks',
        title: 'Intake',
        text: 'Average recent daily standard drinks?',
        calculatorHint: true,
        askedWhen: (a) => a.need === 'yes',
        options: [
            { value: 'upto7', label: '≤ 7', summary: '≤ 7 standard drinks daily' },
            { value: '8to14', label: '8-14', summary: '8-14 standard drinks daily' },
            { value: '15plus', label: '≥ 15', summary: '≥ 15 standard drinks daily' },
        ],
    },
    {
        id: 'history',
        title: 'History',
        text: 'Past withdrawal seizures, delirium tremens (DTs) or complicated withdrawal?',
        askedWhen: (a) => a.need === 'yes',
        options: [
            { value: 'no', label: 'No', summary: 'no past seizures, DTs or complicated withdrawal' },
            { value: 'yes', label: 'Yes', summary: 'past seizures, DTs or complicated withdrawal' },
        ],
    },
    {
        id: 'support',
        title: 'Support',
        text: 'Home support?',
        note: 'Only asked for 8-14 drinks with no complication history.',
        askedWhen: (a) => a.need === 'yes' && a.drinks === '8to14' && a.history === 'no',
        options: [
            { value: 'good', label: 'Good support, no alcohol at home', summary: 'good psychosocial support, no alcohol at home' },
            { value: 'poor', label: 'Poor support, lives alone, or failed outpatient attempts', summary: 'poor psychosocial support' },
        ],
    },
    {
        // A tick list rather than a single answer. "None of these" is an answer
        // in its own right, so an untouched list is never read as "no red flags".
        id: 'flags',
        title: 'Red flags',
        multi: true,
        text: 'Any red flags right now?',
        note: 'Any tick moves the patient up one level of care.',
        askedWhen: (a) => a.need === 'yes',
        noneLabel: 'None of these',
        options: [
            { value: 'in_withdrawal', label: 'Already in withdrawal, or high BAL on arrival' },
            { value: 'comorbid', label: 'Coexisting medical or psychiatric illness' },
            { value: 'cns', label: 'Also dependent on benzodiazepines, GHB or other sedatives' },
            { value: 'pregnant', label: 'Pregnant or possibly pregnant' },
        ],
    },
];

// Ordered from least to most care. `next` on an outcome names the follow-on
// pages its result screen offers.
export const TRIAGE_OUTCOMES = {
    refer: {
        title: 'No withdrawal management needed',
        text: 'If there are still concerns about substance use, consider referral to Addiction Medicine / psychosocial team as appropriate.',
        plan: 'No withdrawal management required. Consider referral to Addiction Medicine / psychosocial team if concerns about substance use remain.',
    },
    supportive: {
        title: 'Supportive care',
        text: 'Supportive treatment.',
        plan: 'Supportive treatment.',
    },
    ambulatory: {
        title: 'Ambulatory detox',
        text: 'Confirm the ambulatory inclusion and exclusion criteria before starting.',
        plan: 'Ambulatory detox, subject to the ambulatory inclusion and exclusion criteria.',
        ambulatory_guideline_link: 'ambulatory-guidelines-page',
    },
    consider_district: {
        title: 'Consider admission',
        text: 'Consider admission to a district hospital / MPS / outpatient detox unit for monitored withdrawal.',
        plan: 'Consider admission to district hospital / MPS / outpatient detox unit for monitored withdrawal.',
        guideline_link: 'inpatient-guidelines-page',
        checklist: true,
    },
    district: {
        title: 'Admission',
        text: 'Admission to a district hospital / MPS / outpatient detox unit for monitored withdrawal.',
        plan: 'Admission to district hospital / MPS / outpatient detox unit for monitored withdrawal.',
        guideline_link: 'inpatient-guidelines-page',
        checklist: true,
    },
    consider_general: {
        title: 'Consider General Hospital admission',
        text: 'Consider General Hospital admission. It is safer than a district hospital / MPS / outpatient detox unit.',
        plan: 'Consider General Hospital admission; safer than district hospital / MPS / outpatient detox unit.',
        guideline_link: 'inpatient-guidelines-page',
        checklist: true,
    },
    general_only: {
        title: 'General Hospital admission only',
        text: 'For General Hospital admission only.',
        plan: 'For General Hospital admission only.',
        guideline_link: 'inpatient-guidelines-page',
        checklist: true,
    },
};

// One level of care up. Every red flag is either an ambulatory exclusion
// (pregnancy, medical or psychiatric contraindication) or an NSWCG reason to
// move up a band (already in withdrawal, other CNS depressant dependence) and
// so to expect more than mild to moderate withdrawal. A flagged patient is
// therefore never sent home: supportive care and ambulatory detox both step up
// to admission rather than to each other.
export const RED_FLAG_STEP_UP = {
    supportive: 'district',
    ambulatory: 'district',
    consider_district: 'consider_general',
    district: 'consider_general',
    consider_general: 'general_only',
    general_only: 'general_only',
};

// Shown under the red-flag question in both views.
export const RED_FLAG_SOURCE = '<span class="src-tag src-local">LOCAL - rationale: the red flags are NSWCG\'s reasons to move up a band '
    + '(§5.1.1) and the ambulatory exclusions; triage previously did not ask about them, so a patient with one could be '
    + 'sent home. One level up, and never to ambulatory detox: pregnancy and medical or psychiatric illness are '
    + 'ambulatory exclusions, and the other two predict more than the mild to moderate withdrawal ambulatory detox is for.</span>';

// Shown on the result screen under the outcome, for the flag that needs more
// than a change of level.
export const RED_FLAG_NOTES = {
    pregnant: 'Pregnancy or suspected pregnancy needs specialist inpatient management.',
};

// Lower-cases a label's first letter only, so it reads mid-sentence without
// turning "BAL" or "GHB" into "bal" or "ghb".
export const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);

export function activeQuestions(answers) {
    return TRIAGE_QUESTIONS.filter((q) => !q.askedWhen || q.askedWhen(answers));
}

export const isAnswered = (q, answers) => (q.multi ? Array.isArray(answers[q.id]) : answers[q.id] !== undefined);

// The first question still waiting for an answer, or null once triage is done.
export function nextQuestion(answers) {
    return activeQuestions(answers).find((q) => !isAnswered(q, answers)) || null;
}

// Drops answers to questions that no longer apply, so changing intake from
// 8-14 to 15+ cannot leave a home-support answer silently steering the result.
export function pruneAnswers(answers) {
    const active = new Set(activeQuestions(answers).map((q) => q.id));
    return Object.fromEntries(Object.entries(answers).filter(([id]) => active.has(id)));
}

// The outcome before red flags: intake, history and support only. This is the
// tree the app has always had.
export function baseOutcome({ drinks, history, support }) {
    if (drinks === 'upto7') return history === 'yes' ? 'consider_district' : 'supportive';
    if (drinks === '8to14') {
        if (history === 'yes') return 'consider_general';
        return support === 'good' ? 'ambulatory' : 'district';
    }
    return history === 'yes' ? 'general_only' : 'consider_general';
}

// Returns null while a question is unanswered.
export function triageOutcome(answers) {
    if (nextQuestion(answers)) return null;
    if (answers.need === 'no') return { key: 'refer', steppedUp: false };
    const base = baseOutcome(answers);
    const flagged = answers.flags.length > 0;
    return { key: flagged ? RED_FLAG_STEP_UP[base] : base, base, steppedUp: flagged && RED_FLAG_STEP_UP[base] !== base };
}

// The EMR note is written from the answers given, not chosen from a fixed list,
// so it records why the patient landed where they did.
export function triageSummary(answers) {
    const result = triageOutcome(answers);
    if (!result) return '';
    const outcome = TRIAGE_OUTCOMES[result.key];
    if (result.key === 'refer') return `Alcohol withdrawal triage: patient assessed. ${outcome.plan}`;

    const findings = activeQuestions(answers)
        .filter((q) => !q.multi)
        .slice(1)
        .map((q) => q.options.find((o) => o.value === answers[q.id]).summary);
    const flagQ = TRIAGE_QUESTIONS.find((q) => q.id === 'flags');
    const flags = answers.flags.map((v) => lowerFirst(flagQ.options.find((o) => o.value === v).label));
    findings.push(`red flags: ${flags.length ? flags.join('; ') : 'none'}`);

    const lines = [`Alcohol withdrawal triage: ${findings.join('; ')}.`, `Plan: ${outcome.plan}`];
    if (result.steppedUp) lines.push('Moved up one level of care for red flags.');
    for (const v of answers.flags) if (RED_FLAG_NOTES[v]) lines.push(RED_FLAG_NOTES[v]);
    return lines.join('\n');
}
