// The access password, and the role/location the app is being used in.
//
// Three questions get asked, and they are remembered differently because they
// are true for different lengths of time:
//
//   The password asks "is this device one the app was given to?" That is a
//   property of the device, so it is asked once and then never again.
//
//   The attestation asks "is the person holding it a qualified health
//   professional?" That is a property of the person, and a ward terminal has
//   more than one. It stays per-launch, exactly as it always has.
//
//   The role and location ask "who is using it, and where, right now?" Those
//   change — a drug and alcohol consult liaison is in a different ward every
//   day — so they are asked every launch too, but the last answers come back
//   pre-selected. A clinician on their own phone taps Continue and answers
//   nothing; a different person on a shared terminal sees the previous answers
//   sitting there and can correct them. Storing them silently instead would
//   attribute a night registrar's use to whoever set the device up.

import { PASSWORD_HASH, ROLES, CONSULT_LOCATIONS, normalisePassword } from './data/access-config.js';

const UNLOCKED_KEY = 'sud.unlocked';
const ROLE_KEY = 'sud.role';
const LOCATION_KEY = 'sud.location';

// Every storage access is wrapped. Private browsing, a locked-down managed
// device and a full quota all throw on plain localStorage use, and an exception
// here would take the gate down and lock out a clinician who did nothing wrong.
// Failing to remember something is recoverable; failing to open is not.
function read(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
}

function write(key, value) {
    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
}

/** Has this device already been unlocked with the password? */
export function isUnlocked() {
    return read(UNLOCKED_KEY) === '1';
}

/**
 * Check a typed password.
 *
 * Async because SubtleCrypto is: it needs a secure context, which sudtoolkit.org
 * and localhost both are but a plain http:// origin is not — hence the explicit
 * guard rather than a stray TypeError from an undefined `crypto.subtle`.
 */
export async function verifyPassword(input) {
    const normalised = normalisePassword(input || '');
    if (!normalised) return false;

    if (!window.crypto?.subtle) {
        throw new Error('insecure-context');
    }

    const digest = await window.crypto.subtle.digest(
        'SHA-256', new TextEncoder().encode(normalised));
    const hash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return hash === PASSWORD_HASH;
}

/** Remember that this device is unlocked. Returns false if storage refused. */
export function rememberUnlock() {
    return write(UNLOCKED_KEY, '1');
}

/** Forget the password on this device — the "set this up again" escape hatch. */
export function forgetUnlock() {
    try {
        window.localStorage.removeItem(UNLOCKED_KEY);
    } catch {
        /* Nothing to do: if it cannot be removed it was never stored. */
    }
}

// A stored id that is no longer in the list — a role retired between releases —
// must not come back pre-selected, or it would keep being sent for as long as
// that device is in use.
function validOrNull(value, list) {
    return list.some(item => item.id === value) ? value : null;
}

/** The role last chosen on this device, for pre-selection. */
export function lastRole() {
    return validOrNull(read(ROLE_KEY), ROLES);
}

/** The location last chosen on this device, for pre-selection. */
export function lastLocation() {
    return validOrNull(read(LOCATION_KEY), CONSULT_LOCATIONS);
}

/** Remember this launch's answers as next launch's defaults. */
export function rememberContext(role, location) {
    if (validOrNull(role, ROLES)) write(ROLE_KEY, role);
    if (validOrNull(location, CONSULT_LOCATIONS)) write(LOCATION_KEY, location);
}
