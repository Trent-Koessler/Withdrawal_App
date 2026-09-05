// Guards for the access gate and the usage log.
//
// Four things here can fail silently in ways nobody notices until the trial
// data is already wrong, so each gets a test rather than a convention:
//
//   - The password is normalised in two places, once in Python when the hash is
//     minted and once in JavaScript when it is checked. If those rules ever
//     disagree the password stops working for everyone at once, and the only
//     symptom is "it says my password is wrong".
//   - Role and location are a vocabulary the app and the endpoint must share
//     exactly. An id on only one side is refused on arrival, and the study's
//     grouping variable is simply missing for that group.
//   - The new modules have to be in the service worker's precache list. Leave
//     one out and the app boots fine online and is dead offline, which is the
//     one setting it exists for.
//   - Event names are written in script.js and enforced again in the worker,
//     with the same failure mode.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('the access password', () => {
    let PASSWORD_HASH;
    let normalisePassword;

    before(async () => {
        ({ PASSWORD_HASH, normalisePassword } = await import('../data/access-config.js'));
    });

    test('the stored value is a SHA-256 hash, not a password', () => {
        assert.match(PASSWORD_HASH, /^[0-9a-f]{64}$/,
            'PASSWORD_HASH is not SHA-256 hex — a plaintext password may have been pasted in');
    });

    test('the JavaScript and Python normalisers agree', () => {
        // Divergence here breaks the password for everyone at once, so the two
        // implementations are compared directly rather than trusted to have
        // been kept in step by hand.
        const cases = ['WNSWLHD', 'wnswlhd', '  wnsw lhd  ', 'WNSW-LHD', 'wNsW  lHd', '', '   '];

        const script = [
            'import sys, json, importlib.util',
            `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(path.join(ROOT, 'tools', 'set-password.py'))})`,
            'm = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(m)',
            'print(json.dumps([m.normalise(c) for c in json.load(sys.stdin)]))',
        ].join('\n');

        const output = execFileSync('python3', ['-c', script], {
            input: JSON.stringify(cases),
            encoding: 'utf8',
        });

        assert.deepEqual(cases.map(normalisePassword), JSON.parse(output),
            'normalisePassword() and tools/set-password.py normalise() disagree');
    });

    test('the right password verifies and a near miss does not', async () => {
        // access.js is browser code; give it just enough of a window to run.
        const store = new Map();
        globalThis.window = {
            crypto: webcrypto,
            localStorage: {
                getItem: k => (store.has(k) ? store.get(k) : null),
                setItem: (k, v) => store.set(k, String(v)),
                removeItem: k => store.delete(k),
            },
        };

        try {
            const { verifyPassword, isUnlocked, rememberUnlock, forgetUnlock } =
                await import('../access.js');

            // Derived from the committed hash rather than hardcoded, so this
            // still tests the real path after the password is changed.
            const digest = await webcrypto.subtle.digest(
                'SHA-256', new TextEncoder().encode('WNSWLHD'));
            const hex = Array.from(new Uint8Array(digest))
                .map(b => b.toString(16).padStart(2, '0')).join('');
            assert.equal(hex, PASSWORD_HASH,
                'the committed hash is no longer WNSWLHD — update this test alongside the password');

            assert.equal(await verifyPassword('WNSWLHD'), true);
            assert.equal(await verifyPassword('  wnsw lhd '), true,
                'lower case with spaces must work — it is read off a whiteboard and typed on a phone');
            assert.equal(await verifyPassword('WNSWLHE'), false, 'a wrong password was accepted');
            assert.equal(await verifyPassword(''), false, 'an empty password was accepted');

            assert.equal(isUnlocked(), false, 'nothing should be stored before the password is entered');
            rememberUnlock();
            assert.equal(isUnlocked(), true);
            forgetUnlock();
            assert.equal(isUnlocked(), false);
        } finally {
            delete globalThis.window;
        }
    });
});

describe('role and location', () => {
    let ROLES;
    let CONSULT_LOCATIONS;

    before(async () => {
        ({ ROLES, CONSULT_LOCATIONS } = await import('../data/access-config.js'));
    });

    test('every entry has a slug id and a human label', () => {
        for (const list of [ROLES, CONSULT_LOCATIONS]) {
            assert.ok(list.length > 0);
            for (const item of list) {
                assert.match(item.id, /^[a-z0-9][a-z0-9-]{0,39}$/,
                    `"${item.id}" is not a lowercase slug; the worker refuses anything else`);
                assert.ok(item.label && item.label.length > 2, `"${item.id}" has no usable label`);
            }
        }
    });

    test('ids are unique within each list', () => {
        for (const list of [ROLES, CONSULT_LOCATIONS]) {
            const ids = list.map(i => i.id);
            assert.equal(new Set(ids).size, ids.length, 'duplicate id would merge two groups silently');
        }
    });

    test('the worker accepts exactly the ids the app can send', () => {
        // Not a subset check in either direction. An id the app can send but
        // the worker refuses loses those events; an id the worker allows but
        // the app cannot send is dead configuration that hides the first
        // problem when someone goes looking.
        const worker = read('worker/src/index.js');
        const parse = name => {
            const block = worker.match(new RegExp(`${name} = new Set\\(\\[([\\s\\S]*?)\\]\\);`))?.[1];
            assert.ok(block, `could not locate ${name} in the worker`);
            return new Set([...block.matchAll(/'([a-z0-9-]+)'/g)].map(m => m[1]));
        };

        assert.deepEqual(
            [...parse('ALLOWED_ROLES')].sort(),
            ROLES.map(r => r.id).sort(),
            'ALLOWED_ROLES in the worker and ROLES in data/access-config.js have drifted');
        assert.deepEqual(
            [...parse('ALLOWED_LOCATIONS')].sort(),
            CONSULT_LOCATIONS.map(l => l.id).sort(),
            'ALLOWED_LOCATIONS in the worker and CONSULT_LOCATIONS have drifted');
    });
});

describe('the gate is wired into the page correctly', () => {
    const html = read('index.html');
    const script = read('script.js');

    test('the password panel and the attestation are separate panels in one modal', () => {
        assert.ok(html.includes('id="access-gate"'), 'no access-gate panel in the disclaimer modal');
        assert.ok(html.includes('id="disclaimer-gate"'), 'the disclaimer panel is gone');
        assert.ok(html.indexOf('id="access-gate"') < html.indexOf('id="disclaimer-gate"'),
            'the password panel must come before the attestation, not after it');
    });

    test('the visible panel is chosen before first paint', () => {
        // Deciding this in script.js instead would flash the password prompt on
        // every launch for a device that is already set up.
        assert.ok(/localStorage\.getItem\('sud\.unlocked'\)/.test(html),
            'nothing reads the unlock flag in an inline script, so the panel swap will be visible');
        assert.ok(html.indexOf("localStorage.getItem('sud.unlocked')") < html.indexOf('src="script.js"'),
            'the pre-paint check must run before script.js loads');
    });

    test('role and location are asked in the per-launch panel, not the one-off one', () => {
        // They describe the person holding the device right now. Putting them
        // behind the password would freeze one answer for the life of the
        // device and attribute a night registrar's use to whoever set it up.
        const accessPanel = html.slice(html.indexOf('id="access-gate"'), html.indexOf('id="disclaimer-gate"'));
        assert.ok(!accessPanel.includes('id="role-select"'),
            'the role dropdown is inside the one-off password panel');
        assert.ok(html.includes('id="role-select"') && html.includes('id="location-select"'),
            'the role and location dropdowns are missing');
    });

    test('the attestation itself is still never remembered', () => {
        // The whole reason the disclaimer is asked every launch is that a ward
        // terminal has more than one user. This release added storage next to
        // it; that must not have quietly changed.
        const handler = script.slice(script.indexOf('acceptDisclaimerBtn.addEventListener'));
        const body = handler.slice(0, handler.indexOf('\n    });'));
        assert.ok(!/localStorage|setItem|sud\.unlocked/.test(body),
            'the disclaimer acceptance is being persisted — it must stay per-launch');
        // rememberContext stores the dropdowns as *defaults*, which is allowed
        // and is not the same thing as remembering the attestation.
        assert.ok(/rememberContext\(/.test(body),
            'the chosen role and location are not being kept as next launch defaults');
    });

    test('both answers are required before the app opens', () => {
        const handler = script.slice(script.indexOf('acceptDisclaimerBtn.addEventListener'));
        const body = handler.slice(0, handler.indexOf('\n    });'));
        assert.ok(/!roleSelect\.value \|\| !locationSelect\.value/.test(body),
            'the app can be opened without answering role and location, so those columns will be '
            + 'empty for exactly the launches where someone was in a hurry');
    });
});

describe('the usage log cannot break the app', () => {
    const metrics = read('metrics.js');
    const sw = read('sw.js');
    const script = read('script.js');

    test('the new modules are precached for offline boot', () => {
        for (const file of ['access.js', 'metrics.js', 'data/access-config.js']) {
            assert.ok(sw.includes(`'${file}'`),
                `${file} is missing from the service worker precache list — the app would not boot offline`);
        }
    });

    test('every event name script.js sends is one the worker accepts', () => {
        const worker = read('worker/src/index.js');
        // Scoped to the ALLOWED_EVENTS block. Scanning the whole file also
        // picks up the CSV column names, which would let a typo'd event name
        // pass this test by matching an unrelated string.
        const block = worker.match(/ALLOWED_EVENTS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
        assert.ok(block, 'could not locate ALLOWED_EVENTS in the worker');
        const allowed = new Set([...block.matchAll(/'([a-z_]+)'/g)].map(m => m[1]));

        const sent = [...script.matchAll(/record\('([a-z_]+)'/g)].map(m => m[1]);
        assert.ok(sent.length > 0, 'script.js records nothing');
        for (const name of new Set(sent)) {
            assert.ok(allowed.has(name),
                `script.js sends "${name}" but the worker drops it — the column would be silently empty`);
        }
    });

    test('the queue is bounded', () => {
        // An unbounded queue in localStorage eventually throws on write, and
        // the throw would surface inside the app, not inside the telemetry.
        assert.match(metrics, /MAX_QUEUED\s*=\s*\d+/, 'no cap on the offline queue');
        assert.ok(/slice\(-MAX_QUEUED\)/.test(metrics),
            'MAX_QUEUED is defined but never applied when writing the queue');
    });

    test('the batch size matches the worker limit', () => {
        const clientMax = Number(metrics.match(/MAX_BATCH\s*=\s*(\d+)/)?.[1]);
        const workerMax = Number(
            read('worker/src/index.js').match(/MAX_EVENTS_PER_BATCH\s*=\s*(\d+)/)?.[1]);
        assert.equal(clientMax, workerMax,
            'the app would send batches the worker rejects whole, and the queue would never drain');
    });

    test('collection stays off until an endpoint is configured', () => {
        // The gate ships before the worker is deployed. This is a reminder in
        // test form: setting ENDPOINT is the moment collection actually starts.
        const endpoint = metrics.match(/const ENDPOINT = '([^']*)'/)?.[1];
        assert.notEqual(endpoint, undefined, 'ENDPOINT is no longer a simple constant');
        if (endpoint !== '') {
            assert.match(endpoint, /^https:\/\//,
                'ENDPOINT must be https — a plain http endpoint would be blocked as mixed content');
        }
    });

    test('nothing is recorded at all before an endpoint exists', () => {
        // Not "queued but not sent". If events accumulated while collection was
        // off, the day the endpoint is configured would upload a backlog from
        // before anyone was told the app was being monitored.
        assert.ok(/if \(!ENDPOINT \|\| !role\) return;/.test(metrics),
            'record() does not bail out when ENDPOINT is unset');
    });
});
