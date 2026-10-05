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

// Every statement of the rule opens in plain words - do not give a dose to a
// sedated patient - before RASS is named, so a reader who does not know the
// scale still gets the instruction. Then the three RASS levels as a list, the
// shortest form that a nurse can scan at the drug chart. It is the
// over-sedation safeguard, so pages show it first, in a caution box.
export const SEDATION_LEAD_HTML = '<b>Do not give a benzodiazepine if the patient is sedated</b> (drowsy or hard to rouse).';
export const SEDATION_LEAD_PLAIN = 'SEDATION: Do not give a benzodiazepine if the patient is sedated (drowsy or hard to rouse).';

// The three RASS levels, as a list. Each page words the action for its own
// setting (a loading endpoint, a dose taken at home).
export const rassLevelsHtml = (give, minusOne, minusTwo) => '<ul class="rass-levels">'
    + `<li><b>RASS 0 or above:</b> ${give}</li>`
    + `<li><b>RASS -1:</b> ${minusOne}</li>`
    + `<li><b>RASS -2 or below:</b> ${minusTwo}</li></ul>`;

// For any benzodiazepine dose given by staff.
export const RASS_RULE_HTML = `${SEDATION_LEAD_HTML} Check <b>RASS</b> before every dose:`
    + rassLevelsHtml('give', 'withhold; rescore at next scheduled time', 'withhold; medical review')
    + RASS_RATIONALE;

// The EMR-paste twin. Plain text by design: the paste carries no citations.
// The schedule line is the prescriber's cue, so it stays in the paste.
export const RASS_RULE_PLAIN = `${SEDATION_LEAD_PLAIN} Check RASS before every dose:\n`
    + '- RASS 0 or above: give\n'
    + '- RASS -1: withhold the dose; rescore at the next scheduled time\n'
    + '- RASS -2 or below: withhold the dose; medical review\n'
    + 'If multiple doses are withheld, the schedule is too high.';

// Shown first on a protocol whose own RASS checks sit inside its steps
// (loading, the test dose), so the caution still leads the page.
export const SEDATION_STEPS_HTML = `${SEDATION_LEAD_HTML} Check RASS at each step below.`;

// Loading and DT dose *to* light sedation, so their endpoint is reached at
// RASS -1 rather than merely allowed there.
export const RASS_LOADING_HTML = `${SEDATION_LEAD_HTML} Check <b>RASS</b> before each loading dose:`
    + rassLevelsHtml('give the next dose', 'loading endpoint reached (lightly sedated, easily rousable): stop loading',
        'withhold all benzodiazepine; medical review')
    + `${RASS_RATIONALE} <span class="src-tag src-nswcg">NSWCG §5.4.4</span>`;

// Loading Steps 2 and 3 still give doses after the load. One line, because
// Step 1 above them already carries the rationale.
export const RASS_STEP_HTML = '<b>Do not give if sedated.</b> RASS 0 or above: give. RASS -1: withhold. '
    + 'RASS -2 or below: withhold; medical review.';
