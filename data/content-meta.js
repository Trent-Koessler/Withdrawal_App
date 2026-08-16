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

export const CONTENT_META = {
    'inpatient-guidelines-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'ambulatory-guidelines-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'alcohol-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'screening-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'populations-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'continuing-care-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'bbv-sti-page': { source: NSWCG_2022, lastReviewed: REVISED },
    'opioid-withdrawal-page': { source: NSWCG_2022, lastReviewed: REVISED },
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
