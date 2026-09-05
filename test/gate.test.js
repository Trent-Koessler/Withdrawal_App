// Security invariants for the Cloudflare password gate.
//
// These are not characterisation tests. Each one corresponds to a way the gate
// could be walked past while still appearing to work in a browser: a forged
// cookie, an expired one, a redirect that leaves the origin, a comparison that
// leaks the password a character at a time. A gate that fails any of these is
// decoration, so they must keep failing if the behaviour is reintroduced.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
    timingSafeEqual,
    passwordMatches,
    issueToken,
    verifyToken,
    readCookie,
    safeNext,
} from '../worker/gate.js';

const SECRET = 'test-signing-secret';
const NOW = 1_700_000_000;

describe('password comparison', () => {
    test('accepts the configured password', async () => {
        assert.equal(await passwordMatches('correct horse', 'correct horse'), true);
    });

    test('rejects a wrong password of the same length', async () => {
        assert.equal(await passwordMatches('correct horss', 'correct horse'), false);
    });

    // The prefix case is the one that matters: a comparison that bails at the
    // first mismatch answers "how much did I get right?", which is all an
    // attacker needs to extend a guess one character at a time.
    test('rejects a correct prefix', async () => {
        assert.equal(await passwordMatches('correct', 'correct horse'), false);
    });

    test('rejects the empty string', async () => {
        assert.equal(await passwordMatches('', 'correct horse'), false);
    });
});

describe('timingSafeEqual', () => {
    test('is true only for identical byte sequences', () => {
        assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
        assert.equal(timingSafeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
        assert.equal(timingSafeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
    });
});

describe('session cookie', () => {
    test('a freshly issued token verifies', async () => {
        const token = await issueToken(SECRET, NOW + 60);
        assert.equal(await verifyToken(SECRET, token, NOW), true);
    });

    test('an expired token does not', async () => {
        const token = await issueToken(SECRET, NOW - 1);
        assert.equal(await verifyToken(SECRET, token, NOW), false);
    });

    // Without the signature the cookie is just a claim, and anyone can type a
    // claim into devtools.
    test('an unsigned or hand-written token does not', async () => {
        assert.equal(await verifyToken(SECRET, 'true', NOW), false);
        assert.equal(await verifyToken(SECRET, `${NOW + 60}.`, NOW), false);
        assert.equal(await verifyToken(SECRET, `${NOW + 60}.deadbeef`, NOW), false);
        assert.equal(await verifyToken(SECRET, null, NOW), false);
    });

    // Extending your own session by editing the expiry must invalidate the
    // signature — the signature covers the expiry for exactly this reason.
    test('an extended expiry does not', async () => {
        const token = await issueToken(SECRET, NOW - 1);
        const forged = token.replace(String(NOW - 1), String(NOW + 100000));
        assert.equal(await verifyToken(SECRET, forged, NOW), false);
    });

    test('a token signed with a different secret does not', async () => {
        const token = await issueToken('some-other-secret', NOW + 60);
        assert.equal(await verifyToken(SECRET, token, NOW), false);
    });
});

describe('readCookie', () => {
    test('finds the gate cookie among others', () => {
        assert.equal(readCookie('theme=dark; sud_gate=abc.def; other=1', 'sud_gate'), 'abc.def');
        assert.equal(readCookie('sud_gate=abc.def', 'sud_gate'), 'abc.def');
    });

    test('does not match a cookie whose name merely ends in the same text', () => {
        assert.equal(readCookie('not_sud_gate=nope', 'sud_gate'), null);
    });

    test('tolerates a missing header', () => {
        assert.equal(readCookie(null, 'sud_gate'), null);
        assert.equal(readCookie('', 'sud_gate'), null);
    });
});

describe('safeNext', () => {
    test('keeps same-origin paths', () => {
        assert.equal(safeNext('/'), '/');
        assert.equal(safeNext('/index.html?diag'), '/index.html?diag');
    });

    // An open redirect on a clinical domain is a phishing primitive: the link
    // people are asked to trust genuinely starts with sudtoolkit.org.
    test('refuses anything that leaves the origin', () => {
        assert.equal(safeNext('//evil.example'), '/');
        assert.equal(safeNext('/\\evil.example'), '/');
        assert.equal(safeNext('https://evil.example'), '/');
        assert.equal(safeNext('evil.example'), '/');
    });

    test('refuses to bounce back to the gate itself', () => {
        assert.equal(safeNext('/__gate'), '/');
    });

    test('falls back to the root for non-strings', () => {
        assert.equal(safeNext(null), '/');
        assert.equal(safeNext(undefined), '/');
    });
});
