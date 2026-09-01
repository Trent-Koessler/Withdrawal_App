// Access password, and the vocabularies for who is using the app and where.
//
// The password is a single shared one for the whole district, so it does not
// identify a site — it is a "this app was given to you" boundary, nothing more.
// Everything the study wants to know about *who* and *where* therefore comes
// from the two lists below, which the clinician picks from, not from which
// credential they used.
//
// The hash is SHA-256 of the normalised password, so the bundle cannot simply
// be read to recover it. Be honest about what that buys: a shared word like
// "WNSWLHD" falls to a dictionary in seconds, and it will be written on a
// whiteboard within a week regardless. It keeps the app out of a search result
// and makes entry a deliberate act. It is not protecting anything, and nothing
// in this app is patient data.
//
// To change it: python3 tools/set-password.py 'NEWPASSWORD' --write

export const PASSWORD_HASH = 'ff088127fa9fddf62836368738b115bc88be3a7c296f973627fae47c32b5efb4';

// Case, spaces and punctuation are all forgiven. The password gets read off a
// whiteboard and typed on a phone, and "wnsw lhd" should not be a failure.
// tools/set-password.py applies exactly this rule before hashing, and a test
// runs both implementations over the same inputs to prove they agree.
export function normalisePassword(value) {
    return String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Recorded against every event. Ordered roughly by how often they are expected
// rather than by seniority, because this is a dropdown on a phone at 3am and
// the common answer should be near the top.
//
// `id` is what lands in the database. Renaming one after rollout splits that
// group's data in two — add a new id instead, and leave the old one in place.
export const ROLES = [
    { id: 'nurse', label: 'Nurse (RN or EN)' },
    { id: 'nurse-senior', label: 'CNC, CNS or Nurse Practitioner' },
    { id: 'rmo', label: 'Intern, RMO or CMO' },
    { id: 'registrar', label: 'Registrar' },
    { id: 'consultant', label: 'Consultant or staff specialist' },
    { id: 'gp', label: 'General practitioner' },
    { id: 'pharmacist', label: 'Pharmacist' },
    { id: 'allied-health', label: 'Allied health or AOD worker' },
    { id: 'aboriginal-health', label: 'Aboriginal Health Worker or Practitioner' },
    { id: 'midwife', label: 'Midwife' },
    { id: 'paramedic', label: 'Paramedic' },
    { id: 'student', label: 'Student' },
    { id: 'other', label: 'Other' },
];

// Where the clinician is working *right now*, which is not the same as where
// they are based: a drug and alcohol consult liaison is the whole reason this
// is asked per launch rather than stored once against the device.
export const CONSULT_LOCATIONS = [
    { id: 'ed', label: 'Emergency Department' },
    { id: 'inpatient', label: 'Inpatient ward' },
    { id: 'aod-unit', label: 'Drug and alcohol or withdrawal unit' },
    { id: 'mental-health', label: 'Mental health unit' },
    { id: 'icu', label: 'ICU or HDU' },
    { id: 'maternity', label: 'Maternity' },
    { id: 'outpatient', label: 'Outpatient or community clinic' },
    { id: 'primary-care', label: 'General practice or primary care' },
    { id: 'custodial', label: 'Custodial or Justice Health' },
    { id: 'aged-care', label: 'Residential aged care' },
    { id: 'telehealth', label: 'Telehealth or phone advice' },
    { id: 'other', label: 'Other' },
];
