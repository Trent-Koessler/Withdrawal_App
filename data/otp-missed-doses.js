// Missed doses on opioid agonist treatment (OTP).
//
// The bands are data rather than prose in the page for the same reason the
// benzodiazepine equivalence table is: the arithmetic is the dangerous part.
// "Half the usual dose or 40 mg, whichever is higher" is easy to read and easy
// to get backwards at a dosing window at 8am, and a clinician who gets it
// backwards gives a full dose to someone who has lost tolerance. Holding the
// rule in one function means the page, the calculator and the tests all state
// the same number.
//
// Source: NSW Health, NSW Clinical Guidelines: Treatment of Opioid Dependence
// (2018), missed doses. Buvidal windows: NSW Health, Long-acting injectable
// buprenorphine (LAIB) for opioid dependence treatment - Guidance document,
// §5.3.3.

// Confirming what the patient is actually on, before anything else.
//
// Rendered on both the OTP page and the withdrawal page's regulatory section,
// because it is the same task from either direction and the phone numbers must
// not exist in two places. It leads the OTP page because the missed-dose bands
// below it cannot be applied without it: the count of consecutive missed doses
// and the usual daily dose both come from the dosing point, not from the
// patient and not from the prescription.
export const CONFIRM_CURRENT_TREATMENT = [
    '<strong>Check SafeScript NSW (RTPM).</strong>',
    '<strong>Contact the dosing point - the pharmacy, clinic or correctional health service - for a '
        + 'dosing history, before prescribing.</strong> What was dispensed and when the last dose was '
        + 'actually given is what a missed-dose count is made of. A prescribed dose is not evidence that a '
        + 'dose was taken.',
    'If the dosing point is not known or cannot be reached, current opioid agonist treatment can be '
        + 'confirmed through the Ministry of Health - <a href="tel:0294245921">(02) 9424 5921</a> or '
        + '<a href="tel:0293919944">(02) 9391 9944</a>.',
    'For prescription opioids, also check <strong>My Health Record</strong>.'
];

export const CONFIRM_CURRENT_TREATMENT_SOURCE =
    '<span class="src-tag src-nswcg-adapted">NSWCG-adapted §8.3.5, §8.2 - rationale: NSWCG '
    + 'directs the clinician to the Ministry of Health line first and lists SafeScript separately, under '
    + 'prescription opioids. In practice confirmation starts with SafeScript NSW and the dosing point, '
    + 'which is also the only route to the dosing history the missed-dose bands are counted from, so the '
    + 'order here is reversed and the Ministry line is given as the fallback it is used as.</span>';

// What the review before dosing has to cover, whoever is doing it. Identical in
// every band - the bands change what dose follows, not what is assessed.
export const MISSED_DOSE_REVIEW = [
    'The circumstances of the missed doses, including the reasons for non-attendance.',
    'Other recent substance use - particularly sedatives, which drive the overdose risk.',
    'Clinical presentation at dosing: evidence of intoxication, or of opioid withdrawal.',
    'Any relevant medical, psychiatric or social issues.'
];

// Two absolutes. They are not band-specific and they are not negotiable, so
// they render as a danger box above the bands rather than as a footnote under
// them.
export const MISSED_DOSE_STOPS = [
    '<strong>Do not dose an intoxicated patient</strong> with methadone or buprenorphine.',
    '<strong>No contactable prescriber and no valid prescription means no dose.</strong> '
        + 'Refer the patient back to their prescriber for review and to re-initiate treatment. '
        + 'A faxed prescription or a telephone order is sufficient; an intention to write one is not.'
];

// Why the bands break where they do. Both risks turn on the same fact - more
// than three missed doses - but they injure the patient in opposite directions,
// which is why the agent matters as much as the count.
export const MISSED_DOSE_RATIONALE = {
    methadone: 'Reduced opioid tolerance, and so <strong>overdose</strong> on resuming the usual dose - '
        + 'particularly where other sedatives have been used.',
    buprenorphine: '<strong>Precipitated withdrawal</strong>, if the patient has been using opioid agonists '
        + '(heroin, morphine, methadone) during the gap.'
};

// The restart rule, per agent. `floorMg` is the "or X mg, whichever is higher"
// figure; `stepMg` and `returnDays` are the climb back afterwards.
export const ORAL_OTP_AGENTS = {
    methadone: {
        label: 'Methadone',
        floorMg: 40,
        stepMg: 20,
        returnDays: '5-7 days',
        reinduction: 'Induction should recommence at a <strong>low dose (&lt;40mg)</strong>, with careful '
            + 'subsequent titration.'
    },
    buprenorphine: {
        label: 'Buprenorphine (sublingual)',
        floorMg: 8,
        stepMg: 8,
        returnDays: '2-3 days',
        reinduction: 'Re-induct as for a new start: defer the first dose until objective withdrawal '
            + '(COWS &ge; 8), because the gap carries a precipitated-withdrawal risk.'
    }
};

// The three action bands. `band(n)` picks one; the source's own headings
// overlap (it heads a paragraph "3-4 consecutive doses" and then states a rule
// that only applies from 4), so the breakpoints here follow the operative
// numbers - resume at 1-3, reduce at 4-5, prescriber review above 5.
export const MISSED_DOSE_BANDS = [
    {
        key: 'resume',
        missed: '1-3 doses',
        decidedBy: 'Dispenser, prescriber or delegate reviews the patient before dosing.',
        action: 'The dosing clinician (pharmacist, nurse or prescriber) may resume the <strong>normal '
            + 'dose</strong> if there is no intoxication, no significant withdrawal and no other clinical '
            + 'concern. Consult the prescriber or delegate, or seek DASAS advice, if there is.'
    },
    {
        key: 'reduced',
        missed: '4-5 doses',
        decidedBy: 'Assess the patient <em>and</em> contact the prescriber or delegate. A legal prescription '
            + 'must reach the dosing site before the patient is dosed.',
        action: 'Reduced dose for that day - <strong>half the usual dose, or the floor for that agent, '
            + 'whichever is higher</strong> - then daily clinician review before each subsequent dose while '
            + 'the dose climbs back.'
    },
    {
        key: 'review',
        missed: 'More than 5 doses',
        decidedBy: '<strong>The prescriber must review the patient</strong> before treatment recommences.',
        action: 'Treat this as re-induction, not as a resumed dose.'
    }
];

export function bandFor(missedDoses) {
    if (!Number.isFinite(missedDoses) || missedDoses < 1) return null;
    if (missedDoses <= 3) return MISSED_DOSE_BANDS[0];
    if (missedDoses <= 5) return MISSED_DOSE_BANDS[1];
    return MISSED_DOSE_BANDS[2];
}

// The restart dose for the 4-5 band.
//
// `cappedAtUsual` is a departure from the source and the reason this is a
// function rather than a sentence. Read literally, "half the regular dose or
// 40 mg, whichever is higher" hands a patient whose regular dose is 30 mg of
// methadone *more* than they normally take, immediately after a gap that has
// cost them tolerance. The floor is written for the doses the guideline
// assumes; below it the rule inverts. So the dose is capped at the usual dose,
// and the caller is told the cap fired so it can say so rather than silently
// disagreeing with the guideline.
//
// TODO(clinical): is capping the restart dose at the patient's usual dose the
// right local position, or should a patient maintained below the floor be
// referred to the prescriber rather than dosed at all after 4-5 missed doses?
export function restartDose(agentKey, usualDoseMg) {
    const agent = ORAL_OTP_AGENTS[agentKey];
    if (!agent) return null;
    if (!Number.isFinite(usualDoseMg) || usualDoseMg <= 0) return null;

    const byRule = Math.max(usualDoseMg / 2, agent.floorMg);
    const cappedAtUsual = byRule > usualDoseMg;
    return {
        agent,
        usualDoseMg,
        doseMg: cappedAtUsual ? usualDoseMg : byRule,
        cappedAtUsual,
        halfDoseMg: usualDoseMg / 2
    };
}

// Buvidal is a different problem and is deliberately kept apart from the bands
// above: nothing here counts missed daily doses, because there are none to
// count. The question is only how overdue the injection is.
export const BUVIDAL_WINDOWS = [
    {
        product: 'Buvidal Weekly',
        scheduled: 'Every 7 days',
        window: 'Days 5-9 - up to 2 days either side of the weekly time point',
        reinduction: 'More than 10-14 days between doses (3-7 days overdue) - re-induction may be required, '
            + 'with individual clinical titration'
    },
    {
        product: 'Buvidal Monthly',
        scheduled: 'Every 28 days',
        window: 'Weeks 3-5 - up to 1 week either side of the monthly time point',
        reinduction: 'More than 8 weeks between doses (about 4 weeks overdue) - re-induction may be required, '
            + 'with individual clinical titration'
    }
];

export const BUVIDAL_NOTES = [
    'The flexible window exists to be used - travel, public holidays and appointment availability are what it '
        + 'is for. Bringing a dose forward within the window is preferable to a missed one.',
    'If a dose is missed, give the next dose <strong>as soon as practically possible</strong>.',
    'Monitor for increased withdrawal or craving, or other signs of instability, whenever the interval moves. '
        + 'Individual titration up or down may be required.'
];

// Provenance chips, kept beside the content they describe so a change to one is
// a change to the other. Rendered by script.js into the missed-doses section.
export const MISSED_DOSE_SOURCE =
    '<span class="src-tag src-other">OTHER - NSW Health, NSW Clinical Guidelines: Treatment of Opioid '
    + 'Dependence (2018), missed doses</span>';

export const BUVIDAL_SOURCE =
    '<span class="src-tag src-other">OTHER - NSW Health, Long-acting injectable buprenorphine (LAIB) for '
    + 'opioid dependence treatment - Guidance document, &sect;5.3.3</span>';

export const RESTART_CAP_SOURCE =
    '<span class="src-tag src-local">LOCAL - rationale: the guideline\'s "whichever is higher" floors '
    + '(40mg methadone, 8mg buprenorphine) exceed the usual dose for patients maintained below them, so read '
    + 'literally the rule would increase the dose of the patient who has just lost tolerance. The restart '
    + 'dose is capped at the usual dose, and the calculator says when the cap has fired.</span>';
