// One sedation rule for every benzodiazepine dose in the app (0.5.7).
//
// "Sedated" used to be a word each page defined for itself. It is now RASS,
// and the rule is the same everywhere: give a dose only at RASS 0 or above.
// RASS -1 (drowsy, easily rousable) is the sedation target, so the dose is
// withheld there too; at -2 or below, withhold it and get a medical review.
// Static pages in index.html carry hand-written copies of this wording;
// test/sedation.test.js checks that every page that doses a benzodiazepine
// says it.

const RASS_RATIONALE = `<span class="src-tag src-local">LOCAL - rationale: NSWCG describes the sedation endpoint in words (lightly sedated and easily rousable) but names no scale. RASS -1 (drowsy, but stays awake to voice) is that endpoint, so a patient who has reached it does not need another dose. One RASS threshold on every page means "sedated" means the same thing to every assessor, on every shift and for every drug.</span>`;

// Every statement of the rule opens in plain words - monitor sedation, do not
// give a dose to a sedated patient - before RASS is named, because a reader who
// does not know the scale must still come away with the instruction. It is the
// over-sedation safeguard, so pages show it first, in a caution box.
export const SEDATION_LEAD_HTML = '<b>Monitor sedation before every dose. Do not give a benzodiazepine to a patient who is sedated</b> (drowsy, or hard to rouse). This is the safeguard against over-sedation.';
export const SEDATION_LEAD_PLAIN = 'SEDATION: Monitor sedation before every dose. Do not give a benzodiazepine to a patient who is sedated (drowsy, or hard to rouse). This is the safeguard against over-sedation.';

// For any benzodiazepine dose given by staff.
export const RASS_RULE_HTML = `${SEDATION_LEAD_HTML} Measure it with the <b>RASS</b> (Scales &amp; Calculators &rarr; RASS): give the dose only if the patient is <b>RASS 0 or above</b>. At <b>RASS -1</b> the patient has reached the sedation target: withhold the dose and rescore at the next scheduled time. At <b>RASS -2 or below</b>, withhold it and arrange medical review. ${RASS_RATIONALE}`;

// The EMR-paste twin. Plain text by design: the paste carries no citations.
export const RASS_RULE_PLAIN = `${SEDATION_LEAD_PLAIN} `
    + 'Measure it with the RASS before every regular or PRN dose: give it only if RASS 0 or above. '
    + 'At RASS -1 the sedation target is reached: withhold the dose and rescore at the next scheduled time. '
    + 'At RASS -2 or below the patient is too sedated: withhold the dose, arrange medical review and review the regular schedule. '
    + 'If multiple doses are withheld, the schedule is too high.';

// Shown first on a protocol whose own RASS checks sit inside its steps
// (loading, the test dose), so the caution still leads the page.
export const SEDATION_STEPS_HTML = `${SEDATION_LEAD_HTML} The RASS check for each step is below.`;

// Loading and DT dose *to* light sedation, so their endpoint is reached at
// RASS -1 rather than merely allowed there.
export const RASS_LOADING_HTML = `${SEDATION_LEAD_HTML} <b>Measure it with the RASS before each dose.</b> Give the next loading dose only at <b>RASS 0 or above</b>. The loading endpoint - lightly sedated and easily rousable - is <b>RASS -1</b>: once reached, stop loading. At <b>RASS -2 or below</b>, withhold all benzodiazepine and arrange medical review. ${RASS_RATIONALE} <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`;

// Loading Steps 2 and 3 still give doses after the load. One line, because
// Step 1 above them already carries the rationale.
export const RASS_STEP_HTML = `<b>Do not give a dose to a sedated patient - check the RASS first:</b> give it only at <b>RASS 0 or above</b>. At <b>RASS -1</b> withhold it (sedation target reached); at <b>RASS -2 or below</b>, withhold it and arrange medical review.`;
