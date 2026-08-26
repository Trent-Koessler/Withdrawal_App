// The Opioid Treatment Program: framework, assessment and pharmacotherapy.
//
// Separate from otp-missed-doses.js because it answers a different question.
// That module is consulted with a patient at the window and a decision due in
// the next minute; this one is the standing picture of the program - who may
// prescribe, how patients are reviewed, and what the three medicines are.
//
// Sources: NSW Health, NSW Clinical Guidelines: Treatment of Opioid Dependence
// (2018); NSW Health, Long-acting injectable buprenorphine (LAIB) for opioid
// dependence treatment - Guidance document (2024).

const SRC_OTP_2018 = (section) =>
    `<span class="src-tag src-other">OTHER - NSW Health, NSW Clinical Guidelines: Treatment of Opioid `
    + `Dependence (2018), ${section}</span>`;

const SRC_LAIB_2024 = (section) =>
    `<span class="src-tag src-other">OTHER - NSW Health, Long-acting injectable buprenorphine (LAIB) for `
    + `opioid dependence treatment - Guidance document (2024), ${section}</span>`;

// --- Prescribing and regulatory framework ------------------------------------
//
// SafeScript NSW appears twice on this page doing two different jobs - the
// authority is applied for through it, and current treatment is checked in it.
// Both mentions name the role rather than only the system, so the second does
// not read as a stray duplicate of the first.
export const PRESCRIBER_FRAMEWORK = [
    {
        heading: 'Authority to prescribe',
        body: 'Medical practitioners and nurse practitioners must hold approval from the NSW Ministry of '
            + 'Health before prescribing Schedule 8 opioid agonist treatment in the community. '
            + '<strong>Applications are made through SafeScript NSW</strong>, now the main route; the '
            + 'Pharmaceutical Services Unit is the alternative channel. This is the authority-application '
            + 'role of SafeScript - checking what a patient is currently on is a separate use of the same '
            + 'system, above.',
        source: SRC_OTP_2018('&sect;3.2.4, p72') + ' ' + SRC_LAIB_2024('&sect;2.2.2-2.2.4, pp18-20')
    },
    {
        heading: 'The inpatient exception',
        body: '<strong>In hospital, methadone or buprenorphine may be used for opioid-dependent inpatients '
            + 'without an authority - limited to 14 days by policy directive.</strong> The approval '
            + 'requirement above is for community prescribing. It is an exception for the admission, not a '
            + 'route into ongoing community treatment: a patient who will continue past discharge needs an '
            + 'authorised community prescriber arranged before they leave.',
        source: '<span class="src-tag src-nswcg">NSWCG §8.3.5</span>'
    },
    {
        heading: 'PBS funding',
        body: 'Methadone, sublingual buprenorphine and LAIB are funded under the <strong>PBS Section 100 '
            + 'Highly Specialised Drugs Program (Community Access)</strong> - the standard PBS co-payment, '
            + 'with no additional private dispensing fee.',
        source: SRC_LAIB_2024('&sect;2.2.1, p18')
    }
];

// Collapsed on the page: these bind the prescriber setting up a caseload, not
// the clinician with a patient in front of them, and the page is read by more
// of the second than the first.
export const PRESCRIBER_CAPS = {
    summary: 'Patient limits per prescriber',
    rows: [
        ['Accredited prescriber', 'Up to <strong>200 patients</strong> in community pharmacies or private '
            + 'clinics, or up to <strong>300</strong> in public clinics.'],
        ['Unaccredited medical practitioner', 'Up to <strong>30 patients in total</strong> - up to 20 on '
            + 'sublingual buprenorphine or LAIB, and up to 10 on methadone transferred from an accredited '
            + 'prescriber. <strong>They cannot initiate methadone.</strong>']
    ],
    source: SRC_OTP_2018('&sect;3.2.1, &sect;3.2.3, pp71-72') + ' ' + SRC_LAIB_2024('&sect;2.1, p17')
};

// --- Assessment --------------------------------------------------------------
export const OTP_ASSESSMENT = [
    {
        heading: 'Comprehensive biopsychosocial assessment',
        points: [
            'Substance use history and past treatment.',
            'Physical and mental health comorbidity.',
            'Social stability - housing, income, supports.',
            'Baseline risk factors: child protection concerns, domestic violence, overdose history.'
        ],
        source: SRC_OTP_2018('&sect;2.1, pp14-15') + ' ' + SRC_LAIB_2024('&sect;1.3.2, p12')
    },
    {
        heading: 'Urine drug screening',
        points: [
            'Corroborates reported substance use objectively, and informs takeaway eligibility.',
            '<strong>Do not delay starting treatment while waiting for laboratory results.</strong> The '
                + 'delay costs more than the result adds.'
        ],
        source: SRC_OTP_2018('&sect;2.1.3, &sect;2.4.4, pp15, 33-34')
    }
];

// --- Case flagging -----------------------------------------------------------
//
// The tier sets both the setting and the review interval, so it has to be
// decidable. The guideline lists features across three unrelated axes -
// substance use, comorbidity, housing - without saying how to combine them;
// `ANY_ONE_FLAGS_UP` is the rule that makes the table usable, and is tagged as
// a local decision rather than presented as guideline text.
export const CASE_FLAGGING = [
    {
        tier: 'High need',
        features: 'Frequent intoxication, unstable comorbidity, or homelessness',
        setting: 'Specialist OTP clinic',
        clinical: 'Monthly',
        medical: '2-monthly'
    },
    {
        tier: 'Moderate need',
        features: 'Stable on OAT, with mild polydrug use and no overdose',
        setting: 'Shared care or specialist',
        clinical: '2-monthly',
        medical: '3-monthly'
    },
    {
        tier: 'Low need',
        features: 'Adherent, stable housing and health, no illicit use',
        setting: 'Primary care - GP and community pharmacy',
        clinical: '3-monthly',
        medical: '6-monthly'
    }
];

export const CASE_FLAGGING_RULE =
    '<strong>Any single feature is enough to flag a patient up a tier.</strong> The features are not a '
    + 'checklist to be satisfied in full - one of them is sufficient, and the tier sets both the review '
    + 'interval and the setting.';

export const CASE_FLAGGING_SOURCE = SRC_OTP_2018('&sect;2.4.4, pp32-33')
    + '<span class="src-tag src-local">LOCAL - rationale: the guideline lists the features of each tier '
    + 'across three unrelated axes - substance use, comorbidity and housing - without stating whether one '
    + 'is sufficient or all must co-occur, which leaves a housed, medically stable patient with mild '
    + 'polydrug use classifiable as either Moderate or High. Any-one-flags-up is a local decision taken so '
    + 'the tier is decidable at all.</span>';

// --- Pharmacotherapy ---------------------------------------------------------
//
// The Day 1 figures the app used to carry are one scheme, not three. COWS >= 8
// is the threshold to initiate; the 8mg first dose may be given whole or split
// 4mg + 4mg; the 2mg test dose is a further alternative; and 8-12mg / 8-16mg
// are Day 1 totals rather than first doses. The row below states the first-dose
// rule and leaves the full sequence, including the precipitated-withdrawal
// precautions, on the induction protocol - one protocol, stated once.
export const PHARMACOTHERAPY = [
    {
        medication: 'Oral methadone',
        formulation: 'Oral liquid. Full mu-agonist.',
        initiation: 'Start <strong>20-30mg daily</strong> - lower with high-risk sedative use or low or '
            + 'uncertain tolerance. Increase by <strong>5-10mg every 3-5 days</strong>.',
        maintenance: '<strong>60-100mg/day.</strong> Above 150mg/day requires specialist review; above '
            + '200mg/day requires separate Pharmaceutical Services Unit approval.',
        source: SRC_OTP_2018('&sect;2.4.3-2.4.4, pp23-24, 28-29')
    },
    {
        medication: 'Sublingual buprenorphine (SL BPN / BNX)',
        formulation: 'Sublingual film or tablets. Partial mu-agonist. <strong>Buprenorphine-naloxone (BNX) '
            + 'is preferred</strong>, to deter misuse.',
        initiation: 'Do not initiate below <strong>COWS 8</strong>. First dose <strong>8mg</strong>, '
            + 'as a single dose or split as 4mg with a further 4mg after 1-2 hours; a 2mg test dose with '
            + 'review at 1 hour is a further alternative. Day 1 <em>total</em> 8-12mg (outpatient) or 8-16mg '
            + '(inpatient); then <strong>up to 16mg on Day 2</strong> and <strong>up to 24mg on Day 3</strong>. '
            + 'The precipitated-withdrawal precautions are on the induction protocol.',
        maintenance: '<strong>12-24mg/day.</strong> Maximum licensed daily dose 32mg/day.',
        source: SRC_OTP_2018('&sect;2.4.3-2.4.4, pp25-26, 29-30')
    },
    {
        medication: 'Buvidal Weekly / Monthly',
        formulation: 'Subcutaneous injection - buttock, thigh, abdomen or upper arm, at 90&deg;. Store '
            + 'below 25&deg;C.',
        initiation: '<strong>Direct initiation from short-acting opioids</strong> (heroin, oxycodone) '
            + 'without a withdrawal run-in: <strong>16mg or 24mg Weekly</strong>. Supplemental 8mg doses '
            + 'PRN, to a maximum of 32mg in week 1.',
        maintenance: '<strong>Weekly: 16-32mg. Monthly: 64-160mg.</strong>',
        source: SRC_LAIB_2024('&sect;3.1.1, &sect;5.2.1, &sect;6.1.1, pp21, 36, 50')
    }
];

// The one thing about that table a reader can carry to the wrong drug.
export const PHARMACOTHERAPY_WARNING =
    '<strong>Direct initiation without a withdrawal run-in is a property of LAIB started from '
    + 'short-acting opioids.</strong> It does not relax the precipitated-withdrawal precautions for '
    + 'sublingual buprenorphine, and it does not apply to a patient coming off methadone or another '
    + 'long-acting agonist.';

// --- SL buprenorphine to Buvidal dose conversion --------------------------
//
// LAIB Guidance 2024, Table 4. Held as data with the band bounds separate from
// their label so the lookup below cannot disagree with what the page renders -
// reading across a five-row conversion table is exactly the step where a
// depot dose gets picked off the wrong line.
//
// Two properties of the table worth knowing when reading it: the Monthly dose
// is four times the Weekly one in every row that has both, and the two "no
// equivalent" cells are gaps in the product range rather than clinical
// contraindications - 8mg Weekly x4 would be a 32mg Monthly and 160mg Monthly
// / 4 would be a 40mg Weekly, and neither is manufactured.
export const SL_TO_BUVIDAL = [
    { minMg: 2, maxMg: 6, label: '2-6mg', weeklyMg: 8, monthlyMg: null },
    { minMg: 8, maxMg: 10, label: '8-10mg', weeklyMg: 16, monthlyMg: 64 },
    { minMg: 12, maxMg: 16, label: '12-16mg', weeklyMg: 24, monthlyMg: 96 },
    { minMg: 18, maxMg: 24, label: '18-24mg', weeklyMg: 32, monthlyMg: 128 },
    { minMg: 26, maxMg: 32, label: '26-32mg', weeklyMg: null, monthlyMg: 160 }
];

export const SL_TO_BUVIDAL_SOURCE = SRC_LAIB_2024('Table 4');

export const SL_TO_BUVIDAL_NOTES = [
    'A patient on <strong>2-6mg</strong> of sublingual buprenorphine daily has <strong>no Buvidal Monthly '
        + 'equivalent</strong>, and one on <strong>26-32mg</strong> has <strong>no Weekly equivalent</strong>. '
        + 'Both are gaps in the manufactured dose range, not clinical contraindications - but neither can be '
        + 'prescribed around by picking the nearest row.',
    'The Monthly dose is four times the Weekly dose throughout, which is the arithmetic to check a '
        + 'conversion against if the table is not to hand.',
    'The 8mg Weekly dose sits below the 16-32mg maintenance range above it: it exists for conversion from a '
        + 'low sublingual dose, not as a maintenance target.'
];

// Returns the row a daily sublingual dose falls in, or null. Doses between the
// bands - 7mg, 11mg - are not dispensable in film or tablet strengths, so a
// miss here means the input is wrong rather than the table being incomplete.
export function buvidalDoseFor(slDailyMg) {
    if (!Number.isFinite(slDailyMg)) return null;
    return SL_TO_BUVIDAL.find((row) => slDailyMg >= row.minMg && slDailyMg <= row.maxMg) || null;
}
