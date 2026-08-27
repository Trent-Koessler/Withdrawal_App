// Per-section content metadata (AUTH-02).
//
// A clinical reference with no review date is impossible to trust and
// impossible to maintain: a reader cannot tell whether a page reflects current
// guidance or has been sitting untouched for three years, and neither can the
// author. Every page carries its own dates, rendered into a footer by
// script.js, so the answer is on the page rather than in a repository.
//
// `reviewer: null` means authored but not independently reviewed. That is the
// honest state for every section right now, and the Contributors page is the
// register where that changes.

export const CONTENT_META_DEFAULTS = {
    reviewer: null
};

// Sections revised against NSW Health, Management of Withdrawal from Alcohol
// and Other Drugs: Clinical Guidance (August 2022), during the 2026 revision.
const NSWCG_2022 = 'NSW Health Clinical Guidance (Aug 2022)';
const REVISED = '2026-08-10';

// The AWS bands on the Regimens tab now also quote the AWS severity
// characterisation from p111 of the Australian Guidelines for the Treatment of
// Alcohol Problems, so the inpatient page has a second named source.
const AGTAP_2021 = 'Haber PS, Riordan BC, et al., Guidelines for the Treatment of Alcohol Problems, 4th ed (2021)';

// The 2026 cross-check of the alcohol pages against AGTAP: the symptom-triggered
// exclusions, the carbamazepine position on the seizures panel, and the
// pharmacotherapy pointer on Continuing Care.
const AGTAP_CROSSCHECK = '2026-08-21';

// The Regimens tab was restructured into a type axis and an intensity axis in
// the same pass, which changed who is routed to a loading regimen.
const SELECTOR_REVISED = '2026-08-21';

// The OTP page is not NSWCG material at all: the missed-dose bands come from the
// opioid dependence guidelines and the Buvidal windows from the LAIB guidance,
// which is why it is a page of its own rather than a section on the withdrawal
// page - the sources differ, and so does the reader.
const OPIOID_DEPENDENCE_2018 = 'NSW Health, NSW Clinical Guidelines: Treatment of Opioid Dependence (2018)';
const LAIB_GUIDANCE = 'NSW Health, Long-acting injectable buprenorphine (LAIB) for opioid dependence '
    + 'treatment - Guidance document (2024)';
const MISSED_DOSES_ADDED = '2026-08-26';

// The transfers page is a third source again: the micro-dosing and bridging
// schedules are NSW Health's April 2023 interim guidance, carried into the 2024
// LAIB document as Appendix C. It is a page of its own because it is a
// procedure run over a week, not a fact about the program.
const INTERIM_TRANSFER_2023 = 'NSW Health, Interim Clinical Guidance: Outpatient Transfer from Methadone '
    + 'to Buprenorphine Using the Micro-dosing or Bridging Methods (April 2023)';
const TRANSFERS_ADDED = '2026-08-27';

export const CONTENT_META = {
    'inpatient-guidelines-page': { source: `${NSWCG_2022}; ${AGTAP_2021}`, lastReviewed: SELECTOR_REVISED },
    'ambulatory-guidelines-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'alcohol-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'screening-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'populations-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'continuing-care-page': { source: `${NSWCG_2022}; ${AGTAP_2021}`, lastReviewed: AGTAP_CROSSCHECK },
    'bbv-sti-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'opioid-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'otp-page': {
        source: `${OPIOID_DEPENDENCE_2018}; ${LAIB_GUIDANCE}`,
        lastReviewed: MISSED_DOSES_ADDED
    },
    'otp-transfers-page': {
        source: `${INTERIM_TRANSFER_2023}; ${LAIB_GUIDANCE}; ${OPIOID_DEPENDENCE_2018}`,
        lastReviewed: TRANSFERS_ADDED
    },
    'benzo-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'cannabis-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'stimulant-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'ghb-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'gabapentinoid-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'scales-page': { source: NSWCG_2022, lastReviewed: REVISED },

    // Deliberately not NSWCG-derived — see the source tags on those pages.
    'nicotine-withdrawal-page': {
        source: 'NSW Health tobacco and nicotine guidance; RACGP; local practice',
        lastReviewed: REVISED
    },
    'volatile-withdrawal-page': {
        source: 'Local practice; not covered by NSWCG',
        lastReviewed: REVISED
    },

    // A scaffold with no content cannot be reviewed, and dating it as though it
    // had been would be the misleading part.
    'capacity-page': {
        source: 'Not yet authored',
        lastReviewed: null
    },

    'contacts-page': { source: 'NSW Health service directories', lastReviewed: REVISED }
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

// Displayed as "Month Year" rather than the exact day: a content review
// doesn't happen to day-level precision, and the exact date implied more
// than was true. There is deliberately no "next review due" date — that
// cadence has not been agreed with the service yet, so this app does not
// present one as though it had been.
export function formatReviewMonth(dateStr) {
    if (!dateStr) return null;
    const [year, month] = dateStr.split('-');
    return `${MONTHS[Number(month) - 1]} ${year}`;
}
