// Guards for the site access gate and the usage log.
//
// Three things here can fail silently in ways nobody notices until the trial
// data is already wrong, so each gets a test rather than a convention:
//
//   - The code a clinician types is normalised in two places, once in Python
//     when the hash is minted and once in JavaScript when it is checked. If
//     those two rules ever disagree, every code stops working at once and the
//     only symptom is "it says my code is wrong".
//   - The new modules have to be in the service worker's precache list. Leave
//     one out and the app boots fine online and is dead offline, which is the
//     one setting it exists for.
//   - Event names are written in script.js and enforced again in the worker. A
//     name that exists on only one side is dropped on arrival, and the column
//     is simply empty at analysis time with nothing to say it ever broke.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('site access codes', () => {
    let COHORTS;
    let normaliseCode;

    before(async () => {
        ({ COHORTS, normaliseCode } = await import('../data/cohorts.js'));
    });

    test('every cohort has a well-formed id, label and hash', () => {
        assert.ok(COHORTS.length > 0, 'no cohorts defined — the gate would reject every code');
        for (const cohort of COHORTS) {
            assert.match(cohort.id, /^[a-z0-9][a-z0-9-]{0,39}$/,
                `cohort id "${cohort.id}" is not a lowercase slug; the worker rejects anything else`);
            assert.match(cohort.hash, /^[0-9a-f]{64}$/,
                `cohort "${cohort.id}" has a hash that is not SHA-256 hex`);
            assert.ok(cohort.site && cohort.setting,
                `cohort "${cohort.id}" is missing a site or setting label`);
        }
    });

    test('ids and hashes are unique', () => {
        const ids = COHORTS.map(c => c.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate cohort id — one site would shadow another');

        const hashes = COHORTS.map(c => c.hash);
        assert.equal(new Set(hashes).size, hashes.length,
            'two sites share a code — their usage would be indistinguishable');
    });

    // The plaintext codes deliberately live nowhere in the repo. If one ever
    // gets pasted into a source file the hashing was pointless.
    test('no plaintext code is committed alongside the hashes', () => {
        const source = read('data/cohorts.js');
        assert.ok(!/WNSW-[A-Z0-9-]+-[A-Z0-9]{4}/.test(source),
            'data/cohorts.js contains something shaped like a real code — only hashes belong here');
    });

    test('the JavaScript and Python normalisers agree', () => {
        // Both sides fold case, spaces and hyphens. Divergence here breaks
        // every code at once, so the two implementations are compared directly
        // rather than trusted to have been kept in step by hand.
        const cases = [
            'WNSW-DUBBO-ED-4A9E',
            'wnsw-dubbo-ed-4a9e',
            '  wnsw dubbo ed 4a9e  ',
            'WNSW_DUBBO_ED_4A9E',
            'wNsW-dUbBo--Ed--4a9e',
            '',
            '   ',
        ];

        const script = [
            'import sys, json, importlib.util',
            `spec = importlib.util.spec_from_file_location("m", ${JSON.stringify(path.join(ROOT, 'tools', 'make-cohort-codes.py'))})`,
            'm = importlib.util.module_from_spec(spec)',
            'spec.loader.exec_module(m)',
            'print(json.dumps([m.normalise(c) for c in json.load(sys.stdin)]))',
        ].join('\n');

        const output = execFileSync('python3', ['-c', script], {
            input: JSON.stringify(cases),
            encoding: 'utf8',
        });

        assert.deepEqual(
            cases.map(normaliseCode),
            JSON.parse(output),
            'normaliseCode() in data/cohorts.js and normalise() in tools/make-cohort-codes.py disagree'
        );
    });

    test('a minted code verifies, and a near miss does not', async () => {
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

        const { verifyCode, storedCohort, rememberCohort, forgetCohort } =
            await import('../access.js');

        // Mint a code the same way the tool does, then confirm the app accepts
        // it. This exercises the real hash path rather than a fixture.
        const code = 'WNSW-TESTONLY-AB12';
        const digest = await webcrypto.subtle.digest(
            'SHA-256', new TextEncoder().encode('WNSWTESTONLYAB12'));
        const hash = Array.from(new Uint8Array(digest))
            .map(b => b.toString(16).padStart(2, '0')).join('');

        COHORTS.push({ id: 'test-only', site: 'Test', setting: 'Test', hash });
        try {
            assert.equal((await verifyCode(code))?.id, 'test-only');
            assert.equal((await verifyCode('  wnsw testonly ab12 '))?.id, 'test-only',
                'a code typed in lower case with spaces must still work — it is read off a printed sheet');
            assert.equal(await verifyCode('WNSW-TESTONLY-AB13'), null, 'a wrong code was accepted');
            assert.equal(await verifyCode(''), null, 'an empty code was accepted');

            assert.equal(storedCohort(), null, 'nothing should be stored before a code is entered');
            rememberCohort({ id: 'test-only' });
            assert.equal(storedCohort()?.id, 'test-only');
            forgetCohort();
            assert.equal(storedCohort(), null);
        } finally {
            COHORTS.pop();
            delete globalThis.window;
        }
    });
});

describe('the access gate is wired into the page correctly', () => {
    const html = read('index.html');

    test('the code panel and the attestation are separate panels in one modal', () => {
        assert.ok(html.includes('id="access-gate"'), 'no access-gate panel in the disclaimer modal');
        assert.ok(html.includes('id="disclaimer-gate"'), 'the disclaimer panel is gone');
        assert.ok(html.indexOf('id="access-gate"') < html.indexOf('id="disclaimer-gate"'),
            'the code panel must come before the attestation, not after it');
    });

    test('the visible panel is chosen before first paint', () => {
        // Deciding this in script.js instead would flash the code prompt on
        // every launch for a device that is already set up.
        assert.ok(/localStorage\.getItem\('sud\.cohort'\)/.test(html),
            'nothing reads the stored cohort in an inline script, so the panel swap will be visible');
        assert.ok(html.indexOf("localStorage.getItem('sud.cohort')") < html.indexOf('src="script.js"'),
            'the pre-paint check must run before script.js loads');
    });

    test('the attestation is still never remembered', () => {
        // The whole reason the disclaimer is asked every launch is that a ward
        // terminal has more than one user. Adding this release's storage must
        // not have quietly changed that.
        const script = read('script.js');
        const accept = script.slice(script.indexOf("acceptDisclaimerBtn.addEventListener"));
        const handler = accept.slice(0, accept.indexOf('});'));
        assert.ok(!/localStorage|setItem/.test(handler),
            'the disclaimer acceptance is being persisted — it must stay per-launch');
    });
});

describe('the usage log cannot break the app', () => {
    const metrics = read('metrics.js');
    const sw = read('sw.js');
    const script = read('script.js');

    test('the new modules are precached for offline boot', () => {
        for (const file of ['access.js', 'metrics.js', 'data/cohorts.js']) {
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
        assert.ok(allowed.size > 0, 'could not parse the worker allow-list');

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
});
