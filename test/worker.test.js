// Guards for the telemetry endpoint in worker/src/index.js.
//
// The worker is the only part of this project that accepts input from the open
// internet, and the only part whose failures are invisible: a dropped event
// produces no error anywhere a clinician or the author would see it, just a
// column that turns out to be empty months later when the data is analysed.
//
// So the promises made in worker/README.md are asserted here rather than
// trusted. The two that matter most:
//
//   - Nothing a clinician typed can be stored, even if something upstream
//     sends it. The allow-lists are the mechanism; these tests are the proof
//     they still work.
//   - A resend cannot double-count, because the app resends by design whenever
//     a flush succeeds on the server but dies before the response arrives.
//
// D1 is stubbed rather than run: the SQL here is two statements, and what needs
// guarding is the validation in front of them.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/src/index.js';

const COLUMNS = [
    'eid', 'received_at', 'occurred_at', 'device_id', 'cohort',
    'event', 'detail', 'app_version', 'standalone', 'queued',
];

let rows;

// Enough of D1 to exercise the worker: prepare/bind/batch for writes, and an
// all() that replays what was written for the export path. The UNIQUE
// constraint on eid is modelled, because the dedupe guarantee depends on it.
function stubDb() {
    return {
        prepare: sql => {
            const statement = {
                __sql: sql,
                args: [],
                bind(...args) {
                    return { ...statement, args };
                },
                async all() {
                    return { results: rows.map((r, i) => ({ id: i + 1, ...r })) };
                },
            };
            return statement;
        },
        async batch(statements) {
            for (const s of statements) {
                const row = Object.fromEntries(COLUMNS.map((c, i) => [c, s.args[i]]));
                if (rows.some(r => r.eid === row.eid)) continue; // INSERT OR IGNORE
                rows.push(row);
            }
        },
    };
}

const ENV = () => ({
    COHORTS: 'pilot,dubbo-ed',
    EXPORT_TOKEN: 'a-long-random-export-token',
    DB: stubDb(),
});

const uuid = () => crypto.randomUUID();

function post(body, { origin = 'https://sudtoolkit.org', env = ENV() } = {}) {
    return worker.fetch(
        new Request('https://metrics.example/e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: origin },
            body: typeof body === 'string' ? body : JSON.stringify(body),
        }),
        env
    );
}

const batch = events => ({
    device_id: 'device-uuid-1',
    cohort: 'pilot',
    app_version: '0.4.7',
    standalone: true,
    events,
});

beforeEach(() => { rows = []; });

describe('the endpoint accepts what the app sends', () => {
    test('a valid batch is stored and echoed back with a CORS header', async () => {
        const response = await post(batch([
            { eid: uuid(), event: 'unlock', t: new Date().toISOString() },
            { eid: uuid(), event: 'page_view', detail: 'scales-page' },
        ]));

        assert.equal(response.status, 200);
        assert.equal((await response.json()).stored, 2);
        assert.equal(response.headers.get('access-control-allow-origin'), 'https://sudtoolkit.org');
        assert.equal(rows.length, 2);
        assert.equal(rows[1].detail, 'scales-page');
    });

    test('the preflight is answered', async () => {
        const response = await worker.fetch(
            new Request('https://metrics.example/e', {
                method: 'OPTIONS',
                headers: { Origin: 'https://sudtoolkit.org' },
            }),
            ENV()
        );
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('access-control-allow-origin'), 'https://sudtoolkit.org');
    });

    test('standalone and queued flags survive the round trip', async () => {
        await post({ ...batch([{ eid: uuid(), event: 'session', queued: 1 }]), standalone: false });
        assert.equal(rows[0].standalone, 0);
        assert.equal(rows[0].queued, 1);
    });
});

describe('nothing a clinician typed can be stored', () => {
    test('free text in `detail` is dropped, but the event still counts', async () => {
        // The app never sends this. The point is that if some future change
        // did, the row would still not carry it.
        await post(batch([{ eid: uuid(), event: 'emr_copy', detail: 'CIWA 14, John Smith, MRN 12345' }]));

        assert.equal(rows.length, 1, 'the event itself must survive — losing it would bias the counts');
        assert.equal(rows[0].detail, null, 'free text reached the database');
    });

    test('an unrecognised event name is dropped, and its neighbours are not', async () => {
        const response = await post(batch([
            { eid: uuid(), event: 'keystroke', detail: 'diazepam' },
            { eid: uuid(), event: 'session' },
        ]));

        assert.equal((await response.json()).stored, 1);
        assert.equal(rows[0].event, 'session');
    });

    test('extra fields on an event are ignored, not persisted', async () => {
        await post(batch([{ eid: uuid(), event: 'session', score: 14, note: 'patient agitated' }]));
        assert.deepEqual(Object.keys(rows[0]).sort(), [...COLUMNS].sort());
    });
});

describe('a resend cannot double-count', () => {
    test('replaying an identical batch stores nothing new', async () => {
        const env = ENV();
        const payload = batch([
            { eid: uuid(), event: 'session' },
            { eid: uuid(), event: 'emr_copy', detail: 'ciwa-ar' },
        ]);

        await post(payload, { env });
        assert.equal(rows.length, 2);

        // Exactly what the app does after a flush whose response never arrived.
        await post(payload, { env });
        assert.equal(rows.length, 2, 'the resend was counted twice');
    });

    test('a duplicate inside one batch is dropped before it reaches the database', async () => {
        const eid = uuid();
        const response = await post(batch([
            { eid, event: 'session' },
            { eid, event: 'session' },
        ]));
        assert.equal((await response.json()).stored, 1);
    });

    test('an id that is not a uuid is refused', async () => {
        // The dedupe guarantee rests on the browser's uniqueness, not on a
        // caller's promise, so the shape is checked rather than assumed.
        const response = await post(batch([{ eid: 'sequential-1', event: 'session' }]));
        assert.equal(response.status, 400);
        assert.equal(rows.length, 0);
    });
});

describe('the endpoint is hostile to everything else', () => {
    test('an unknown cohort is refused rather than recorded', async () => {
        const response = await post({ ...batch([{ eid: uuid(), event: 'session' }]), cohort: 'made-up' });
        assert.equal(response.status, 403);
        assert.equal(rows.length, 0);
    });

    test('a request from another origin is refused', async () => {
        const response = await post(batch([{ eid: uuid(), event: 'session' }]),
            { origin: 'https://not-sudtoolkit.example' });
        assert.equal(response.status, 403);
    });

    test('a request with no origin at all is refused', async () => {
        const response = await worker.fetch(
            new Request('https://metrics.example/e', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(batch([{ eid: uuid(), event: 'session' }])),
            }),
            ENV()
        );
        assert.equal(response.status, 403);
    });

    test('an oversized batch is refused whole', async () => {
        const response = await post(batch(
            Array.from({ length: 101 }, () => ({ eid: uuid(), event: 'session' }))));
        assert.equal(response.status, 413);
    });

    test('malformed JSON does not throw', async () => {
        const response = await post('{not json');
        assert.equal(response.status, 400);
    });

    test('missing required fields are refused', async () => {
        const response = await post({ events: [{ eid: uuid(), event: 'session' }] });
        assert.equal(response.status, 400);
    });

    test('an unconfigured cohort list fails closed', async () => {
        // Otherwise a fresh deploy silently accepts every cohort id sent to it
        // and the dataset fills with plausible-looking junk.
        const response = await post(batch([{ eid: uuid(), event: 'session' }]),
            { env: { ...ENV(), COHORTS: '' } });
        assert.equal(response.status, 503);
    });
});

describe('client clocks are not trusted', () => {
    test('a timestamp from the future is replaced with server time', async () => {
        await post(batch([{ eid: uuid(), event: 'session', t: '2099-01-01T00:00:00Z' }]));
        assert.ok(Math.abs(Date.parse(rows[0].occurred_at) - Date.now()) < 60_000,
            'a device with its clock set to 2099 would sort ahead of every real event');
    });

    test('an unparseable timestamp does not lose the event', async () => {
        await post(batch([{ eid: uuid(), event: 'session', t: 'yesterday' }]));
        assert.equal(rows.length, 1);
        assert.ok(!Number.isNaN(Date.parse(rows[0].occurred_at)));
    });

    test('a plausible past timestamp is kept', async () => {
        // The offline queue means an event legitimately arrives days late, and
        // flattening that to server time would erase when it actually happened.
        const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000).toISOString();
        await post(batch([{ eid: uuid(), event: 'session', t: twoDaysAgo }]));
        assert.equal(rows[0].occurred_at, twoDaysAgo);
        assert.notEqual(rows[0].occurred_at, rows[0].received_at);
    });
});

describe('export', () => {
    const seed = async env => {
        await post(batch([
            { eid: uuid(), event: 'unlock' },
            { eid: uuid(), event: 'page_view', detail: 'scales-page' },
        ]), { env });
    };

    test('the token is required', async () => {
        const env = ENV();
        await seed(env);
        for (const url of ['https://metrics.example/export.csv',
                           'https://metrics.example/export.csv?token=wrong']) {
            assert.equal((await worker.fetch(new Request(url), env)).status, 401);
        }
    });

    test('a token of a different length is refused without throwing', async () => {
        const env = ENV();
        assert.equal(
            (await worker.fetch(new Request('https://metrics.example/export.csv?token=x'), env)).status,
            401);
    });

    test('a bearer header works as well as a query parameter', async () => {
        const env = ENV();
        await seed(env);
        const response = await worker.fetch(
            new Request('https://metrics.example/export.csv',
                { headers: { Authorization: 'Bearer a-long-random-export-token' } }),
            env
        );
        assert.equal(response.status, 200);
    });

    test('the CSV has a header row and one line per event', async () => {
        const env = ENV();
        await seed(env);
        const response = await worker.fetch(
            new Request('https://metrics.example/export.csv?token=a-long-random-export-token'), env);

        const lines = (await response.text()).trim().split('\n');
        assert.equal(lines[0],
            'id,eid,received_at,occurred_at,device_id,cohort,event,detail,app_version,standalone,queued');
        assert.equal(lines.length, 3);
        assert.equal(response.headers.get('x-row-count'), '2');
        assert.equal(response.headers.get('x-more'), 'false');
    });

    test('export is unavailable rather than open when no token is configured', async () => {
        const response = await worker.fetch(
            new Request('https://metrics.example/export.csv?token=anything'),
            { ...ENV(), EXPORT_TOKEN: undefined });
        assert.equal(response.status, 503);
    });
});

describe('routing', () => {
    test('health answers', async () => {
        assert.equal((await worker.fetch(new Request('https://metrics.example/health'), ENV())).status, 200);
    });

    test('anything else is a 404', async () => {
        assert.equal((await worker.fetch(new Request('https://metrics.example/'), ENV())).status, 404);
    });

    test('GET on the ingest path is not an ingest', async () => {
        assert.equal((await worker.fetch(new Request('https://metrics.example/e'), ENV())).status, 404);
    });
});
