// The fixed vocabularies the app and the endpoint share.
//
// Every list here is an allow-list: a value that is not named is dropped rather
// than stored, so a future caller cannot widen what is collected by sending
// more. Kept in one module because the usage events, the feedback records and
// the admin page all validate against the same lists, and two copies would
// drift.

export const ALLOWED_ORIGINS = new Set([
    'https://sudtoolkit.org',
    'https://www.sudtoolkit.org',
    'https://trent-koessler.github.io',
]);

// Event names the study collects. Adding one here is a deliberate act; see
// worker/README.md for what each is for.
export const ALLOWED_EVENTS = new Set([
    'unlock',         // access code accepted, or a remembered code re-opened the app
    'session',        // app launched (one per launch, after the attestation)
    'page_view',      // a tab or page was opened
    'scale_complete', // a clinician scored a patient on a scale — the utility signal.
                      // Abandonment is derived in analysis (a scales page_view
                      // with no scale_complete), not sent as its own event.
    'emr_copy',       // the copy-to-EMR button was used
    'helpful_yes',    // "Was this page helpful?" answered Yes; detail is the page
    'helpful_no',     // ...answered No
    'survey',         // the usability survey: detail is offered, started,
                      // completed, later or never. The answers themselves go to
                      // the survey_responses table, not here.
]);

// Who is using the app, and where. Mirrors ROLES and CONSULT_LOCATIONS in
// data/access-config.js — a test asserts the two agree. Hardcoded rather than
// configured, for the same reason as the event names: these are a vocabulary
// the app and the endpoint have to share exactly, and a deploy-time variable
// would drift from the release that produces the values.
export const ALLOWED_ROLES = new Set([
    'nurse', 'nurse-senior', 'rmo', 'registrar', 'consultant', 'gp',
    'pharmacist', 'allied-health', 'midwife', 'student', 'other',
]);

export const ALLOWED_LOCATIONS = new Set([
    'ed', 'inpatient', 'aod-unit', 'mental-health', 'icu', 'maternity',
    'outpatient', 'primary-care', 'custodial', 'aged-care', 'telehealth',
    'other',
]);

// `detail` is a fixed vocabulary, not free text: a page id, a scale id, or a
// page id and tab id joined by one slash (`scales-page/ciwa-ar`) so a rating
// can say which calculator it was about. Anything else is stored as NULL.
export const DETAIL_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}(\/[a-z0-9][a-z0-9-]{0,39})?$/;
export const DETAIL_MAX = 81;

// What a feedback message can be filed under, and what the author can mark it
// as once read. Both are shown in the admin page in this order.
export const FEEDBACK_CATEGORIES = ['error', 'unclear', 'suggestion', 'praise'];
export const FEEDBACK_STATUSES = ['new', 'actioned', 'wontfix'];

// Coarse device type for an error report — enough to tell "only on iPhones"
// from "everywhere", and nothing finer. Never the user agent itself.
export const PLATFORMS = ['ios', 'android', 'windows', 'mac', 'linux', 'other'];

// The usability survey's single extra question.
export const CHANGED_ANSWERS = ['yes', 'no', 'unsure'];
