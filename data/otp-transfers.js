// Transferring a patient from methadone to buprenorphine.
//
// Separate from otp-treatment.js because it is a procedure rather than a
// standing picture: a patient on methadone who wants to be on buprenorphine,
// and a prescriber deciding which of three routes to take and what to write
// on each of the next seven days.
//
// The two routes that avoid a withdrawal washout - micro-dosing and bridging
// with oxycodone - are the ones this module carries in full, because they are
// the ones no other page in the app states, and because both are done from a
// day-numbered table that is easy to misread from memory. Direct transfer is
// the standard approach and is already on the opioid page, so it appears here
// only as the first row of the route table.
//
// Sources: NSW Health, Interim Clinical Guidance: Outpatient Transfer from
// Methadone to Buprenorphine Using the Micro-dosing or Bridging Methods
// (April 2023) - reproduced as Appendix C of the LAIB guidance; NSW Health,
// Long-acting injectable buprenorphine (LAIB) for opioid dependence treatment
// - Guidance document (2024); NSW Health, NSW Clinical Guidelines: Treatment
// of Opioid Dependence (2018).

// Shortened from the document's full title, which is a line and a half and
// appears in a dozen chips on one page. The Sources page carries it in full.
const SRC_INTERIM_2023 = (section) =>
    `<span class="src-tag src-other">OTHER - NSW Health, Interim Clinical Guidance: Outpatient Transfer `
    + `from Methadone to Buprenorphine (April 2023), ${section}</span>`;

const SRC_LAIB_2024 = (section) =>
    `<span class="src-tag src-other">OTHER - NSW Health, Long-acting injectable buprenorphine (LAIB) for `
    + `opioid dependence treatment - Guidance document (2024), ${section}</span>`;

const SRC_OTP_2018 = (section) =>
    `<span class="src-tag src-other">OTHER - NSW Health, NSW Clinical Guidelines: Treatment of Opioid `
    + `Dependence (2018), ${section}</span>`;

// --- Before any of it ---------------------------------------------------------
//
// Three things that bind every route, and that a day-numbered table cannot
// carry inside itself: the transfer is elective and planned, the two newer
// routes are off-label with a developing evidence base, and the authority has
// to cover both drugs at once because for part of the week the patient is
// prescribed both.
export const TRANSFER_STOPS = [
    '<strong>These are specialist-initiated transfers.</strong> Micro-dosing and bridging are used '
        + 'off-label, their evidence base is still developing, and NSW Health directs that they are '
        + 'undertaken in line with local clinical governance and off-label prescribing policy. Discuss with '
        + 'an addiction medicine specialist before starting one, and for any dose <strong>above '
        + '150mg</strong>.',
    '<strong>The authority has to cover both drugs.</strong> Apply through the <em>Application for '
        + 'Authority to Prescribe or Supply Methadone, Buprenorphine, or other Opioid Agonist Therapy (OAT) '
        + 'Treatment under the NSW OTP</em>, completing <strong>Section D (drug and dose)</strong> and '
        + '<strong>Section E (other treatment and transfer protocols)</strong>. Buprenorphine is granted '
        + 'ongoing; methadone is granted for the transfer period. No exit form is needed for methadone if '
        + 'the same prescriber held that authority already.',
    '<strong>Plan it while the patient is otherwise stable</strong>, and tell them what happens if the '
        + 'transfer does not succeed. A transfer attempted around a housing, health or legal crisis is the '
        + 'one that destabilises the patient rather than moving them.'
];

export const TRANSFER_STOPS_SOURCE = SRC_INTERIM_2023('pp1-4');

// --- Which route --------------------------------------------------------------
//
// The dose decides. Ordered by dose so the reader finds their patient by the
// number they already know, rather than by the name of a method they may not.
export const TRANSFER_ROUTES = [
    {
        dose: '&le;30mg methadone',
        route: '<strong>Direct transfer.</strong> Stop methadone, wait for objective withdrawal, then '
            + 'induct - onto sublingual buprenorphine at <strong>COWS &ge; 8</strong> as on the induction '
            + 'protocol, or onto <strong>Buvidal Weekly 16mg</strong> at <strong>COWS &ge; 6</strong>, '
            + 'usually 24-72 hours after the last methadone dose. Do not give a sublingual test dose before '
            + 'a first Buvidal dose.',
        setting: 'Outpatient or inpatient',
        // TODO(review): the COWS >= 6 threshold and the 16mg first Buvidal dose for a transfer from
        // <=30mg of methadone were taken from a secondary summary of LAIB 2024 §5.8.4 rather than from
        // the guidance PDF itself - check both against p48 before this page is reviewed.
        source: SRC_OTP_2018('&sect;2.4.3, p26') + ' ' + SRC_LAIB_2024('&sect;5.8.4, p48')
    },
    {
        dose: '&gt;40mg to 150mg',
        route: '<strong>Micro-dosing</strong> (the Bernese method) - buprenorphine is introduced in '
            + 'micrograms while methadone continues, so there is no washout and no withdrawal to sit '
            + 'through. <strong>Or bridging</strong> - methadone is stopped and replaced with short-acting '
            + 'oxycodone for two days before a Buvidal Weekly injection.',
        setting: 'Outpatient, with daily review',
        source: SRC_INTERIM_2023('pp1, 4, 7')
    },
    {
        dose: '&gt;150mg',
        route: '<strong>Specialist advice first.</strong> For bridging, reduce to 150mg if that is possible. '
            + 'There are no reported cases of ambulatory micro-dose transfer above 150mg.',
        setting: 'Consider inpatient',
        source: SRC_INTERIM_2023('pp1, 4, 7')
    }
];

// The one line of the route table a reader can carry to the wrong drug. COWS
// >= 6 is a Buvidal figure and belongs to the depot's slow absorption; the
// threshold for a sublingual first dose is unchanged at COWS >= 8.
export const TRANSFER_ROUTE_WARNING =
    '<strong>The COWS &ge; 6 figure belongs to Buvidal, not to sublingual buprenorphine.</strong> It works '
    + 'because the depot takes 12-24 hours to reach peak plasma levels, so displacement is gradual. A '
    + 'sublingual first dose still waits for <strong>COWS &ge; 8</strong>.';

// --- Micro-dosing -------------------------------------------------------------
export const MICRODOSING_SUITABILITY = {
    outpatient: 'Most patients transferring electively can micro-dose as outpatients.',
    inpatient: [
        '<strong>Methadone &gt;150mg</strong> - no ambulatory transfers at this dose have been reported.',
        '<strong>Cirrhosis</strong> - methadone and buprenorphine metabolism are both altered.',
        '<strong>Inconsistent dosing or lifestyle pattern</strong> - the schedule needs either daily '
            + 'attendance or a patient who can manage a dose that changes every day.'
    ],
    unsupervised: 'Unsupervised dosing can be trialled if the patient is <strong>already on unsupervised '
        + 'methadone</strong>, has <strong>no unsanctioned substance use</strong> and has <strong>stable '
        + 'accommodation</strong> - and then only with the pharmacy involved in simplifying the regimen.',
    source: SRC_INTERIM_2023('p4')
};

// NSW interim guidance, Table 2. X is the patient's usual daily methadone dose.
//
// The two rows people get wrong from memory are day 6 and day 7: methadone is
// halved and then quartered, not stopped. Held as data with the methadone
// column written as a fraction of X so the page cannot quietly turn it into a
// cessation.
export const MICRODOSING_SCHEDULE = [
    { day: '0', methadone: 'X', bup: 'Nil', note: 'Baseline COWS and SOWS. Symptomatic relief, support.' },
    { day: '1', methadone: 'X', bup: '0.2mg BD <em>or</em> 0.4mg mane', note: '' },
    { day: '2', methadone: 'X', bup: '0.4mg BD', note: '' },
    { day: '3', methadone: 'X', bup: '2mg', note: '' },
    { day: '4', methadone: 'X', bup: '4mg', note: '' },
    { day: '5', methadone: 'X', bup: '8mg', note: '' },
    { day: '6', methadone: '&frac12;X', bup: '16mg', note: 'Methadone halved.' },
    {
        day: '7', methadone: '&frac14;X', bup: '16-32mg',
        note: 'Buvidal Weekly may be started here instead, if the patient is transferring to depot.'
    }
];

export const MICRODOSING_NOTES = [
    '<strong>X is the usual daily methadone dose, and it does not change until day 6.</strong> That is the '
        + 'whole point of the method: no washout, no abstinence, and the patient is not asked to be in '
        + 'withdrawal at any stage.',
    '<strong>Methadone is not stopped on day 7</strong> - it is a quarter of the usual dose. Stopping it a '
        + 'day early is the common misreading of this table.',
    '<strong>COWS and SOWS daily</strong>, the SOWS covering the previous 24 hours.',
    'Symptomatic relief as needed: <strong>clonidine 50mcg up to QID PRN</strong> - taken seated, held if '
        + 'dizzy or light-headed - and <strong>ondansetron 8mg up to BD PRN</strong>.'
];

export const MICRODOSING_SOURCE = SRC_INTERIM_2023('Table 2, p5');

// Table 3. These are days on which the patient missed *both* drugs, which is
// why the answer is a COWS score rather than a step of the schedule: after a
// gap the question is no longer where they were up to, but whether they are
// now in enough withdrawal to be inducted outright.
export const MICRODOSING_MISSED = [
    { missed: '1 day', action: 'Recommence at the most recent dosing schedule.' },
    {
        missed: '2-3 days',
        action: 'COWS. <strong>&gt;24</strong>: initiate onto buprenorphine. <strong>&lt;24</strong>: '
            + 'recommence at the most recent dosing schedule.'
    },
    {
        missed: '4-5 days',
        action: 'COWS. <strong>&gt;13</strong>: initiate onto buprenorphine. <strong>&lt;13</strong>: '
            + 'commence the procedure at day 6.'
    },
    { missed: 'More than 5 days', action: 'Initiate onto buprenorphine.' }
];

export const MICRODOSING_MISSED_RULE =
    '<strong>Whatever the gap, ask what the patient wants.</strong> They may prefer to go back to methadone '
    + 'rather than continue the transfer, and that is a legitimate outcome of the conversation rather than a '
    + 'failure of it.';

export const MICRODOSING_MISSED_SOURCE = SRC_INTERIM_2023('Table 3, p6');

// --- Bridging with oxycodone --------------------------------------------------
export const BRIDGING_ELIGIBILITY = [
    '<strong>Methadone 40-150mg daily.</strong> At <strong>80-150mg</strong> consider admitting: the risk '
        + 'of precipitated withdrawal is higher and comorbidity is commoner. Above 150mg, reduce to 150mg '
        + 'first if possible, otherwise seek specialist advice and consider admission.',
    '<strong>Previously prescribed buprenorphine without severe adverse events</strong>, and no allergy or '
        + 'anaphylaxis to buprenorphine or any component of Buvidal.',
    '<strong>Minimal unsanctioned opioid use</strong> - less than one day a week - and no illicit '
        + 'intravenous use of pharmaceutical opioids in the last month.',
    '<strong>No excessive use of other sedating substances:</strong> alcohol more than 4 standard drinks a '
        + 'day more than once a week, or more than 10mg diazepam equivalent daily.',
    '<strong>Stable social situation:</strong> not at risk of coercion, no domestic violence, not homeless, '
        + 'childcare arrangements considered.'
];

export const BRIDGING_ELIGIBILITY_SOURCE = SRC_INTERIM_2023('p7');

export const BRIDGING_RATIONALE =
    'Oxycodone covers the two to three days between the last methadone dose and the first Buvidal dose, so '
    + 'the patient is not in withdrawal while methadone clears. <strong>Modified-release oxycodone is used '
    + 'rather than morphine</strong> for two reasons: it is tamper-resistant and so safer to send home, and '
    + 'any additional heroin use can still be told apart from it on a urine drug screen.';

// Table 4. The conversion multiplies: the daily oxycodone dose is three to four
// times the methadone dose in milligrams. Reading it the other way round - as
// though oxycodone were the stronger drug - produces a dose an order of
// magnitude too small and a patient in full withdrawal, so the direction is
// stated in the header and again in the note below the table.
export const BRIDGING_SCHEDULE = [
    {
        day: '1',
        formulation: 'Oxycodone MR (OxyContin)',
        conversion: '<strong>3:1</strong> - total daily oxycodone = 3 &times; the methadone dose, given BD',
        example: '50mg methadone &rarr; <strong>150mg daily = 75mg BD</strong>'
    },
    {
        day: '2',
        formulation: 'Oxycodone MR (OxyContin)',
        conversion: '<strong>3-4:1</strong>, titrated on the day\'s COWS, SOWS and review',
        example: '50mg methadone &rarr; <strong>150-200mg daily = 75-100mg BD</strong>'
    },
    {
        day: '3',
        formulation: 'Oxycodone IR (Endone)',
        conversion: '<strong>4:1, then one third of that daily dose</strong> as a single supervised dose '
            + 'immediately before the Buvidal injection',
        example: '50mg methadone &rarr; 200mg &divide; 3 = <strong>~65mg</strong>'
    }
];

export const BRIDGING_SCHEDULE_SOURCE = SRC_INTERIM_2023('Table 4, p8');

export const BRIDGING_DAY3 = {
    heading: 'The Buvidal dose on day 3',
    points: [
        'Transferring from <strong>&gt;40mg methadone: Buvidal Weekly 24mg</strong>. From <strong>&lt;40mg: '
            + 'Buvidal Weekly 16mg</strong>.',
        'The immediate-release oxycodone is given <strong>immediately before</strong> the injection, because '
            + 'Buvidal takes 3-6 hours to begin working and 12-24 hours for full effect.',
        'Review daily afterwards. Additional <strong>Buvidal Weekly 8mg</strong> doses may be given if '
            + 'withdrawal emerges - at least 24 hours apart, to a maximum of <strong>32mg in the first '
            + 'week</strong>.',
        'The next Buvidal dose, Weekly or Monthly, is scheduled <strong>7 days</strong> after the first and '
            + 'may be given from <strong>5 days</strong>.'
    ],
    source: SRC_INTERIM_2023('pp8, 11')
};

// Condensed from Table 5. The clinical value of that table is not the reviews
// themselves but what has to be true before the first oxycodone dose is handed
// over - the methadone script inactivated, naloxone in the patient's hand, and
// no benzodiazepine added to a regimen that already has two opioids in it.
export const BRIDGING_REVIEWS = [
    {
        when: 'At least a week before',
        what: 'Review to discuss the procedure and put the arrangements in place. <strong>Submit the PRU '
            + 'authority application</strong> with Sections D and E completed.'
    },
    {
        when: 'Day before',
        what: 'Usual methadone dose, <em>or</em> reduce it by up to 50%.'
    },
    {
        when: 'Day 1',
        what: '<strong>Morning, in person:</strong> confirm methadone was ceased yesterday and none taken '
            + 'today. <strong>Afternoon, telehealth.</strong> First oxycodone dose supervised, second as an '
            + 'individually packaged takeaway. <strong>Confirm with the dosing point that the methadone '
            + 'script is inactivated.</strong> Dispense take-home naloxone with an overdose brief '
            + 'intervention. Symptomatic medicines as needed - <strong>benzodiazepines are not '
            + 'recommended</strong>. SOWS twice daily, returned the next day.'
    },
    {
        when: 'Day 2',
        what: 'Morning in person, afternoon telehealth. Oxycodone MR as day 1, conversion up to 4:1.'
    },
    {
        when: 'Day 3',
        what: '<strong>Morning, in person:</strong> single supervised oxycodone IR dose, then the '
            + '<strong>Buvidal Weekly injection</strong>.'
    },
    {
        when: 'Day 4',
        what: 'Morning review, by telehealth or in person if the patient prefers. Offer a top-up injection '
            + 'over the next few days if needed, and book the next Buvidal dose.'
    }
];

export const BRIDGING_REVIEWS_SOURCE = SRC_INTERIM_2023('Table 5, pp9-11');

// Bridging is a Buvidal protocol. Sublocade is the other depot on the NSW
// formulary and the substitution is the obvious one to make at the point of
// ordering, which is why this is a danger box rather than a footnote.
export const BRIDGING_SUBLOCADE_WARNING =
    '<strong>Bridging is a Buvidal protocol. Do not use it to transfer onto Sublocade.</strong> NSW Health '
    + 'advises against undertaking this process with Sublocade; a patient who is to end up on Sublocade is '
    + 'transferred to Buvidal first.';

export const BRIDGING_SUBLOCADE_SOURCE = SRC_INTERIM_2023('p7, footnote 1');

// --- Where the methods came from ---------------------------------------------
//
// Short, and here rather than at the top, because the reader with a patient in
// front of them needs the tables first. It exists because both methods are
// off-label: a clinician asked to justify one should be able to name what it
// rests on without leaving the page.
export const TRANSFER_EVIDENCE = [
    '<strong>Micro-dosing was first described in Bern in 2016</strong>, as two cases in which '
        + 'buprenorphine was introduced in micrograms alongside continuing full agonist - street heroin in '
        + 'one, high-dose diacetylmorphine and methadone in the other - and both patients reported only '
        + 'mild withdrawal. The reasoning is that a micro-dose displaces too little full agonist to drop '
        + 'opioid tone, while buprenorphine\'s slow dissociation lets receptor occupancy accumulate between '
        + 'doses. <span class="src-tag src-other">OTHER - H&auml;mmig R, Kemter A, Strasser J, et al. Use '
        + 'of microdoses for induction of buprenorphine treatment with overlapping full opioid agonist use: '
        + 'the Bernese method. Subst Abuse Rehabil 2016;7:99-105</span>',
    '<strong>The comparative evidence is thin.</strong> A 2022 systematic review found 18 studies of '
        + 'transfer from methadone to buprenorphine, protocols that varied enormously, transfer usually '
        + 'succeeding even from high methadone doses, and precipitated withdrawal not frequently reported - '
        + 'but few designs that compare one approach against another. A lower pre-transfer methadone dose '
        + 'was associated with a higher rate of successful transfer. '
        + '<span class="src-tag src-other">OTHER - Lintzeris N, Mankabady B, Rojas-Fernandez C, Amick H. '
        + 'Strategies for transfer from methadone to buprenorphine for treatment of opioid use disorders '
        + 'and associated outcomes: a systematic review. J Addict Med 2022;16(2):143-51</span>',
    '<strong>Direct transfer remains the standard approach</strong> and the one endorsed in the NSW '
        + 'opioid dependence guidelines. Micro-dosing and bridging exist for the patients for whom the '
        + 'washout is the obstacle. ' + SRC_INTERIM_2023('p1')
];
