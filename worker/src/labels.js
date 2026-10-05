// Readable names for the role and setting ids, for the admin page and the
// daily email. Mirrors the labels in data/access-config.js; a test asserts the
// two agree, so a renamed role cannot show up under its old name here.

export const ROLE_LABELS = {
    'nurse': 'Nurse (RN or EN)',
    'nurse-senior': 'CNC, CNS or Nurse Practitioner',
    'rmo': 'Intern, RMO or CMO',
    'registrar': 'Registrar',
    'consultant': 'Consultant or staff specialist',
    'gp': 'General practitioner',
    'pharmacist': 'Pharmacist',
    'allied-health': 'Allied health or AOD worker',
    'midwife': 'Midwife',
    'student': 'Student',
    'other': 'Other',
};

export const LOCATION_LABELS = {
    'ed': 'Emergency Department',
    'inpatient': 'Inpatient ward',
    'aod-unit': 'Drug and alcohol or withdrawal unit',
    'mental-health': 'Mental health unit',
    'icu': 'ICU or HDU',
    'maternity': 'Maternity',
    'outpatient': 'Outpatient or community clinic',
    'primary-care': 'General practice or primary care',
    'custodial': 'Custodial or Justice Health',
    'aged-care': 'Residential aged care',
    'telehealth': 'Telehealth or phone advice',
    'other': 'Other',
};

// Readable names for the page and tab ids the app records. Anything not listed
// is shown as its id with the dashes turned into spaces.
export const PAGE_NAMES = {
    'home': 'Home', 'scales': 'Scales', 'alcohol-withdrawal': 'Triage flowchart',
    'inpatient-guidelines': 'Inpatient guidelines', 'ambulatory-guidelines': 'Ambulatory guidelines',
    'ciwa-ar': 'CIWA-Ar', 'ciwa-b': 'CIWA-B', 'aws': 'AWS', 'saws': 'SAWS', 'cows': 'COWS',
    'nsw-cws': 'CWS', 'cwas': 'CWAS', 'awq': 'AWQ', 'rass': 'RASS', 'std-drinks': 'Standard drinks',
    'otp': 'OTP', 'otp-transfers': 'OTP transfers', 'bbv-sti': 'BBV/STI',
};

export function pageName(key) {
    if (!key) return '';
    return key.split('/').map(part => {
        const id = part.replace(/-page$/, '');
        if (PAGE_NAMES[id]) return PAGE_NAMES[id];
        const words = id.replace(/-/g, ' ');
        return words.charAt(0).toUpperCase() + words.slice(1);
    }).join(' › ');
}
