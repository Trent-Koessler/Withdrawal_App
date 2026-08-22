// Site access code gate.
//
// This runs in front of the existing disclaimer, not instead of it, and the two
// answer different questions:
//
//   The access code asks "is this device one we handed the app to?" — that is a
//   property of the device, so it is remembered once and never asked again.
//
//   The disclaimer asks "is the person holding it a qualified health
//   professional?" — that is a property of the person, and a ward terminal has
//   more than one of those. It stays per-launch, exactly as it was.
//
// Getting that split wrong in either direction is the whole risk here: remember
// the attestation and it speaks for people who never gave it; ask for the code
// every launch and clinicians write it on the back of the phone.

import { COHORTS, normaliseCode } from './data/cohorts.js';

const STORAGE_KEY = 'sud.cohort';

// Every storage access is wrapped. Private browsing, a locked-down managed
// device and a full quota all throw on plain localStorage use, and an exception
// here would take the whole gate down and lock out a clinician who did nothing
// wrong. Failing to remember the code is recoverable; failing to open is not.
function readStore() {
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        return null;
    }
}

function writeStore(value) {
    try {
        window.localStorage.setItem(STORAGE_KEY, value);
        return true;
    } catch {
        return false;
    }
}

/** The cohort this device has already unlocked with, or null. */
export function storedCohort() {
    const id = readStore();
    if (!id) return null;
    return COHORTS.find(c => c.id === id) || null;
}

/**
 * Check a typed code against the known hashes.
 *
 * Returns the matching cohort, or null. Async because SubtleCrypto is: it needs
 * a secure context, which sudtoolkit.org and localhost both are, but a plain
 * http:// origin is not — hence the explicit guard rather than a stray
 * TypeError from an undefined `crypto.subtle`.
 */
export async function verifyCode(input) {
    const normalised = normaliseCode(input || '');
    if (!normalised) return null;

    if (!window.crypto?.subtle) {
        throw new Error('insecure-context');
    }

    const bytes = new TextEncoder().encode(normalised);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    const hash = Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return COHORTS.find(c => c.hash === hash) || null;
}

/** Remember an accepted cohort. Returns false if storage refused it. */
export function rememberCohort(cohort) {
    return writeStore(cohort.id);
}

/** Forget the code on this device — the "not my site" escape hatch. */
export function forgetCohort() {
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {
        /* Nothing to do: if it cannot be removed it was never stored. */
    }
}
