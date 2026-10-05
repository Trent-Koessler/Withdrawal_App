// Guards for in-app feedback, the usability survey, error reports, the admin
// page and the daily email (0.6.0).
//
// Unlike test/worker.test.js, which stubs D1, these run the worker against a
// real SQLite database built from worker/schema.sql. The admin page is mostly
// SQL — aggregates, filters, a status update — and a stub would only prove the
// stub. node:sqlite is the same engine D1 runs.
//
// What matters most here:
//
//   - A feedback message is the first free text the endpoint accepts. It must
//     arrive only through its own validated route, be length-capped, and be
//     shown on the admin page and in the email as text, never as markup.
//   - The admin API must not answer without the password.
//   - The daily email must not lose feedback when a send fails, and must not
//     send twice.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

import worker from '../worker/src/index.js';
import { susScore as workerSus, DAILY_CAPS } from '../worker/src/records.js';
import { parseFilters } from '../worker/src/admin.js';
import { isDigestHour, runDigest, buildDigest, escapeHtml } from '../worker/src/digest.js';
import { ROLE_LABELS, LOCATION_LABELS, PAGE_NAMES, pageName } from '../worker/src/labels.js';
import { surveyDue, susScore as appSus, SUS_ITEMS, MIN_SESSIONS, REPEAT_DAYS } from '../survey.js';
import { scrubErrorText } from '../metrics.js';
import { ROLES, CONSULT_LOCATIONS } from '../data/access-config.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

const TOKEN = 'a-long-random-export-token';

// Enough of the D1 API over node:sqlite: prepare/bind/all/first/run/batch.
function d1() {
    const db = new DatabaseSync(':memory:');
    db.exec(read('worker/schema.sql'));
    const statement = (sql, args = []) => ({
        bind: (...a) => statement(sql, a),
        all: async () => ({ results: db.prepare(sql).all(...args) }),
        first: async () => db.prepare(sql).get(...args) ?? null,
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...args).changes) } }),
        runSync: () => db.prepare(sql).run(...args),
    });
    return {
        raw: db,
        prepare: sql => statement(sql),
        async batch(statements) {
            db.exec('BEGIN');
            try {
                for (const s of statements) s.runSync();
                db.exec('COMMIT');
            } catch (err) {
                db.exec('ROLLBACK');
                throw err;
            }
        },
    };
}

let env;
beforeEach(() => {
    env = {
        EXPORT_TOKEN: TOKEN,
        DB: d1(),
        DIGEST_FROM: 'feedback@sudtoolkit.org',
        DIGEST_TO: 'author@example.com',
        ADMIN_URL: 'https://metrics.sudtoolkit.org/admin/',
    };
});

const rows = (sql, ...args) => env.DB.raw.prepare(sql).all(...args);
const uuid = () => crypto.randomUUID();

function post(path, body, { origin = 'https://sudtoolkit.org' } = {}) {
    return worker.fetch(new Request(`https://metrics.example${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    }), env);
}

const item = (kind, over = {}) => ({
    id: uuid(), kind, role: 'registrar', location: 'ed', t: new Date().toISOString(), ...over,
});
const feedback = over => item('feedback', {
    page: 'scales-page/ciwa-ar', category: 'error', message: 'Bands do not match the guideline.', ...over,
});
const survey = over => item('survey', { answers: [4, 2, 4, 1, 4, 2, 5, 1, 4, 2], changed: 'yes', ...over });
const error = over => item('error', {
    message: 'Cannot read properties of null', source: 'script.js:10:5', page: 'scales-page/ciwa-b',
    platform: 'ios', ...over,
});
const records = (items, device = 'device-1') => ({ device_id: device, app_version: '0.6.0', items });

function admin(pathAndQuery, { token = TOKEN, method = 'GET', body } = {}) {
    return worker.fetch(new Request(`https://metrics.example${pathAndQuery}`, {
        method,
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    }), env);
}

describe('feedback is accepted only in its validated shape', () => {
    test('a valid message is stored with its page, type and context', async () => {
        const response = await post('/r', records([feedback({ helpful: 'no' })]));
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('access-control-allow-origin'), 'https://sudtoolkit.org');

        const [row] = rows('SELECT * FROM feedback');
        assert.equal(row.page, 'scales-page/ciwa-ar');
        assert.equal(row.category, 'error');
        assert.equal(row.helpful, 'no');
        assert.equal(row.role, 'registrar');
        assert.equal(row.status, 'new');
        assert.equal(row.emailed_at, null);
    });

    test('an unknown type, a free-text page or an empty message is dropped', async () => {
        const response = await post('/r', records([
            feedback({ category: 'complaint' }),
            feedback({ page: 'John Smith bed 4' }),
            feedback({ message: '   ' }),
        ]));
        assert.equal(response.status, 400);
        assert.equal(rows('SELECT * FROM feedback').length, 0);
    });

    test('a message over 1000 characters is refused, not truncated', async () => {
        // Truncating would store half a sentence that may not mean what the
        // whole one did. The form stops at 1000, so only a script hits this.
        await post('/r', records([feedback({ message: 'x'.repeat(1001) })]));
        assert.equal(rows('SELECT * FROM feedback').length, 0);
        await post('/r', records([feedback({ message: 'x'.repeat(1000) })]));
        assert.equal(rows('SELECT * FROM feedback').length, 1);
    });

    test('control characters are stripped but line breaks kept', async () => {
        await post('/r', records([feedback({ message: 'line one\r\nline\u0000 two\u0007' })]));
        assert.equal(rows('SELECT message FROM feedback')[0].message, 'line one\nline two');
    });

    test('an unknown role or setting is dropped', async () => {
        const response = await post('/r', records([feedback({ role: 'wizard' }), feedback({ location: 'moon' })]));
        assert.equal(response.status, 400);
    });

    test('a resend stores nothing new', async () => {
        const payload = records([feedback()]);
        await post('/r', payload);
        await post('/r', payload);
        assert.equal(rows('SELECT * FROM feedback').length, 1);
    });

    test('each device has a daily ceiling', async () => {
        const cap = DAILY_CAPS.feedback;
        await post('/r', records(Array.from({ length: 15 }, () => feedback())));
        await post('/r', records(Array.from({ length: 15 }, () => feedback())));
        assert.equal(rows('SELECT * FROM feedback').length, cap);
        // Another device is unaffected.
        await post('/r', records([feedback()], 'device-2'));
        assert.equal(rows('SELECT * FROM feedback').length, cap + 1);
    });

    test('another origin, or none, is refused', async () => {
        assert.equal((await post('/r', records([feedback()]), { origin: 'https://evil.example' })).status, 403);
        assert.equal((await post('/r', records([feedback()]), { origin: null })).status, 403);
    });

    test('an oversized batch is refused whole', async () => {
        const response = await post('/r', records(Array.from({ length: 21 }, () => error())));
        assert.equal(response.status, 413);
    });
});

describe('ratings', () => {
    test('a rating can name the page and tab', async () => {
        await worker.fetch(new Request('https://metrics.example/e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://sudtoolkit.org' },
            body: JSON.stringify({
                device_id: 'device-1', app_version: '0.6.0', events: [
                    { eid: uuid(), event: 'helpful_yes', detail: 'scales-page/ciwa-ar', role: 'nurse', location: 'ed' },
                    { eid: uuid(), event: 'helpful_no', detail: 'a/b/c', role: 'nurse', location: 'ed' },
                ],
            }),
        }), env);
        // The events table is created by the same schema.
        assert.deepEqual(rows('SELECT event, detail FROM events ORDER BY id').map(r => ({ ...r })), [
            { event: 'helpful_yes', detail: 'scales-page/ciwa-ar' },
            { event: 'helpful_no', detail: null },
        ]);
    });
});

describe('the survey', () => {
    test('the score is computed by the worker, the standard way', async () => {
        await post('/r', records([
            survey({ answers: Array(10).fill(3) }),
            survey({ answers: [5, 1, 5, 1, 5, 1, 5, 1, 5, 1] }),
            survey({ answers: [1, 5, 1, 5, 1, 5, 1, 5, 1, 5] }, ),
        ], 'device-a'));
        // Two per device per day, so the third went to the cap. Send it again
        // from another device.
        await post('/r', records([survey({ answers: [1, 5, 1, 5, 1, 5, 1, 5, 1, 5] })], 'device-b'));
        assert.deepEqual(rows('SELECT sus FROM survey_responses ORDER BY id').map(r => r.sus), [50, 100, 0]);
    });

    test('the app and the worker score identically', () => {
        for (let i = 0; i < 200; i++) {
            const answers = Array.from({ length: 10 }, () => 1 + Math.floor(Math.random() * 5));
            assert.equal(appSus(answers), workerSus(answers));
        }
    });

    test('answers that are not ten whole numbers from 1 to 5 are refused', async () => {
        for (const answers of [Array(9).fill(3), Array(11).fill(3), [...Array(9).fill(3), 6],
            [...Array(9).fill(3), 0], [...Array(9).fill(3), 2.5], [...Array(9).fill(3), '3']]) {
            const response = await post('/r', records([survey({ answers })]));
            assert.equal(response.status, 400, JSON.stringify(answers));
        }
        assert.equal(rows('SELECT * FROM survey_responses').length, 0);
    });

    test('when it is due', () => {
        const now = Date.parse('2026-10-01T00:00:00Z');
        const day = 86_400_000;
        const base = { sessions: MIN_SESSIONS, last: null, snoozeUntil: null, optedOut: false, now };
        assert.equal(surveyDue(base), true);
        assert.equal(surveyDue({ ...base, sessions: MIN_SESSIONS - 1 }), false, 'too early');
        assert.equal(surveyDue({ ...base, optedOut: true }), false, 'opted out is final');
        assert.equal(surveyDue({ ...base, snoozeUntil: now + day }), false, 'snoozed');
        assert.equal(surveyDue({ ...base, snoozeUntil: now - day }), true, 'snooze over');
        assert.equal(surveyDue({ ...base, last: now - (REPEAT_DAYS - 1) * day }), false, 'answered this month');
        assert.equal(surveyDue({ ...base, last: now - REPEAT_DAYS * day }), true, 'a month on');
    });

    test('the admin page shows the same ten statements the app asks', () => {
        const adminJs = read('worker/public/admin/app.js');
        const block = adminJs.match(/const SUS_ITEMS = \[([\s\S]*?)\];/)[1];
        const items = [...block.matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(m => m[1]);
        assert.deepEqual(items, SUS_ITEMS);
    });
});

describe('error reports', () => {
    test('numbers and email addresses are masked on the device', () => {
        assert.equal(scrubErrorText('Bad MRN 12345678 for jo@example.org at 12:30'),
            'Bad MRN # for [email] at 12:30');
    });

    test('where in the code is kept exactly, and anything else in that field is dropped', async () => {
        await post('/r', records([
            error({ source: 'script.js:1688:21' }),
            error({ message: 'second', source: 'https://x.example/script.js?mrn=1234:1:1' }),
        ]));
        assert.deepEqual(rows('SELECT source FROM app_errors ORDER BY id').map(r => r.source),
            ['script.js:1688:21', null]);
    });

    test('and again on arrival, with an unknown platform stored as other', async () => {
        await post('/r', records([error({ message: 'Failed for 0412345678, a@b.co', platform: 'fridge' })]));
        const [row] = rows('SELECT message, platform FROM app_errors');
        assert.equal(row.message, 'Failed for #, [email]');
        assert.equal(row.platform, 'other');
    });
});

describe('the admin API', () => {
    test('nothing is answered without the password', async () => {
        for (const route of ['/admin/api/overview', '/admin/api/feedback', '/admin/api/survey',
            '/admin/api/errors', '/admin/api/labels', '/admin/api/export/feedback.csv']) {
            assert.equal((await admin(route, { token: null })).status, 401, route);
            assert.equal((await admin(route, { token: 'wrong' })).status, 401, route);
        }
        assert.equal((await admin('/admin/api/feedback/status', {
            token: null, method: 'POST', body: { id: 1, status: 'actioned' },
        })).status, 401);
    });

    test('the password is not accepted from the query string', async () => {
        // The plain events export allows it for curl; the admin API does not,
        // so the password never lands in a URL, history or a log.
        assert.equal((await admin(`/admin/api/overview?token=${TOKEN}`, { token: null })).status, 401);
    });

    test('unavailable rather than open when no password is configured', async () => {
        env.EXPORT_TOKEN = undefined;
        assert.equal((await admin('/admin/api/overview')).status, 503);
    });

    test('feedback can be listed, filtered and marked', async () => {
        await post('/r', records([
            feedback({ category: 'error' }),
            feedback({ category: 'praise', page: 'home-page', message: 'Great for teaching.' }),
        ]));
        let data = await (await admin('/admin/api/feedback?status=new')).json();
        assert.equal(data.items.length, 2);
        assert.equal(data.newCount, 2);
        assert.deepEqual(data.pages, ['home-page', 'scales-page/ciwa-ar']);

        data = await (await admin('/admin/api/feedback?category=praise')).json();
        assert.equal(data.items.length, 1);

        const id = data.items[0].id;
        const response = await admin('/admin/api/feedback/status', { method: 'POST', body: { id, status: 'actioned' } });
        assert.equal(response.status, 200);
        assert.equal(rows('SELECT status FROM feedback WHERE id = ?', id)[0].status, 'actioned');

        data = await (await admin('/admin/api/feedback?status=new')).json();
        assert.equal(data.items.length, 1);
        assert.equal(data.newCount, 1);
    });

    test('a status outside the list, or an unknown id, is refused', async () => {
        await post('/r', records([feedback()]));
        assert.equal((await admin('/admin/api/feedback/status', {
            method: 'POST', body: { id: 1, status: 'deleted' },
        })).status, 400);
        assert.equal((await admin('/admin/api/feedback/status', {
            method: 'POST', body: { id: 999, status: 'actioned' },
        })).status, 404);
    });

    test('the overview adds up', async () => {
        const send = (device, events) => worker.fetch(new Request('https://metrics.example/e', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Origin: 'https://sudtoolkit.org' },
            body: JSON.stringify({ device_id: device, app_version: '0.6.0', events }),
        }), env);
        const ev = (event, over = {}) => ({ eid: uuid(), event, role: 'nurse', location: 'ed', ...over });
        const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();

        await send('device-1', [ev('session', { t: twoWeeksAgo }), ev('session'),
            ev('helpful_yes', { detail: 'scales-page/ciwa-ar' }), ev('helpful_no', { detail: 'scales-page/ciwa-ar' })]);
        await send('device-2', [ev('session', { role: 'registrar' }), ev('helpful_yes', { detail: 'home-page' }),
            ev('scale_complete', { detail: 'ciwa-ar' })]);
        await post('/r', records([survey({ answers: Array(10).fill(3) }), error()]));

        const o = await (await admin('/admin/api/overview?days=30')).json();
        assert.equal(o.sessions, 3);
        assert.equal(o.devices, 2);
        assert.equal(o.returning, 1, 'device-1 was used in two different weeks');
        assert.deepEqual(o.ratings, { yes: 2, no: 1 });
        assert.deepEqual(o.byPage.find(p => p.page === 'scales-page/ciwa-ar'), { page: 'scales-page/ciwa-ar', yes: 1, no: 1 });
        assert.deepEqual(o.byRole.map(r => [r.label, r.n]), [['nurse', 2], ['registrar', 1]]);
        assert.deepEqual(o.topScales.map(r => [r.label, r.n]), [['ciwa-ar', 1]]);
        assert.equal(o.survey.n, 1);
        assert.equal(o.survey.avg, 50);
        assert.equal(o.errors.length, 1);

        const filtered = await (await admin('/admin/api/overview?days=30&role=registrar')).json();
        assert.equal(filtered.sessions, 1);
    });

    test('the survey and error views summarise', async () => {
        await post('/r', records([survey({ changed: 'yes' }), error(), error()]));
        const s = await (await admin('/admin/api/survey')).json();
        assert.equal(s.n, 1);
        assert.equal(s.perQuestion.length, 10);
        assert.deepEqual(s.changed.map(c => [c.label, c.n]), [['yes', 1]]);

        const e = await (await admin('/admin/api/errors')).json();
        assert.equal(e.groups.length, 1, 'the same error twice is one group');
        assert.equal(e.groups[0].n, 2);
    });

    test('unknown filter values are ignored, never passed through', () => {
        const f = parseFilters(new URL("https://x/?days=13&role=x'%20OR%201=1&location=ed&status=gone&page=a%20b"));
        assert.equal(f.days, 30);
        assert.equal(f.role, null);
        assert.equal(f.location, 'ed');
        assert.equal(f.status, null);
        assert.equal(f.page, null);
    });

    test('the CSV export neutralises spreadsheet formulas typed into feedback', async () => {
        await post('/r', records([feedback({ message: '=HYPERLINK("http://evil.example","click")' })]));
        const response = await admin('/admin/api/export/feedback.csv');
        assert.equal(response.status, 200);
        assert.match(response.headers.get('content-disposition'), /sudtoolkit-feedback-\d{4}-\d{2}-\d{2}\.csv/);
        const csv = await response.text();
        assert.ok(csv.startsWith('id,occurred_at,received_at,device_id,role,location,page,category,'));
        assert.ok(csv.includes(`"'=HYPERLINK(""http://evil.example"",""click"")"`), csv);
    });

    test('page names read the same in the email and on the admin page', () => {
        assert.equal(pageName('scales-page/ciwa-ar'), 'Scales › CIWA-Ar');
        assert.equal(pageName('drug-screening-page'), 'Drug screening');
        const block = read('worker/public/admin/app.js').match(/const PAGE_NAMES = \{([\s\S]*?)\};/)[1];
        const names = Object.fromEntries([...block.matchAll(/'([^']+)': '([^']+)'/g)].map(m => [m[1], m[2]]));
        assert.deepEqual(names, PAGE_NAMES);
    });

    test('labels match the app', async () => {
        const labels = await (await admin('/admin/api/labels')).json();
        assert.deepEqual(labels.roles, Object.fromEntries(ROLES.map(r => [r.id, r.label])));
        assert.deepEqual(labels.locations, Object.fromEntries(CONSULT_LOCATIONS.map(l => [l.id, l.label])));
        assert.deepEqual(ROLE_LABELS, labels.roles);
        assert.deepEqual(LOCATION_LABELS, labels.locations);
    });
});

describe('the admin page', () => {
    test('is served with a policy that blocks injected scripts', async () => {
        env.ASSETS = { fetch: async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }) };
        const response = await admin('/admin/', { token: null });
        assert.equal(response.status, 200);
        const csp = response.headers.get('content-security-policy');
        assert.match(csp, /script-src 'self'/);
        assert.doesNotMatch(csp, /unsafe-inline/);
        assert.match(csp, /frame-ancestors 'none'/);
        assert.equal(response.headers.get('cache-control'), 'no-store');
    });

    test('only reads', async () => {
        env.ASSETS = { fetch: async () => new Response('x') };
        assert.equal((await admin('/admin/', { method: 'POST', token: null })).status, 405);
    });

    test('never writes data into the page as HTML', () => {
        // Feedback text is typed by anyone who can open the app.
        const js = read('worker/public/admin/app.js');
        for (const sink of ['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'document.write', 'eval(', 'new Function']) {
            assert.ok(!js.includes(sink), `admin app.js uses ${sink}`);
        }
        const html = read('worker/public/admin/index.html');
        assert.ok(!/<script>(?!\s*<\/script>)/.test(html), 'inline script would be blocked by the CSP');
        assert.ok(!/style="/.test(html), 'inline style would be blocked by the CSP');
    });

    test('children are only ever set through the null-filtering helper', () => {
        // replaceChildren(null) prints the word "null" on the page, and both
        // files build optional parts as `cond ? el(...) : null`. 0.6.0 shipped
        // that bug in a draft; fill() is the one place that filters.
        for (const file of ['feedback.js', 'survey.js']) {
            const calls = read(file).match(/\.replaceChildren\(/g) || [];
            assert.equal(calls.length, 1, `${file} calls replaceChildren outside fill()`);
        }
    });

    test('the in-app form does not write data as HTML either', () => {
        for (const file of ['feedback.js', 'survey.js']) {
            const js = read(file);
            assert.ok(!/innerHTML|insertAdjacentHTML|outerHTML/.test(js), `${file} builds markup from strings`);
        }
    });
});

describe('the daily email', () => {
    test('goes at 9am Sydney time, summer and winter', () => {
        // AEST (UTC+10) in July, AEDT (UTC+11) in December.
        assert.equal(isDigestHour(new Date('2026-07-01T23:00:00Z')), true);
        assert.equal(isDigestHour(new Date('2026-07-01T22:00:00Z')), false);
        assert.equal(isDigestHour(new Date('2026-12-01T22:00:00Z')), true);
        assert.equal(isDigestHour(new Date('2026-12-01T23:00:00Z')), false);
    });

    test('the cron covers both of those hours', () => {
        assert.match(read('worker/wrangler.toml'), /crons = \["0 22,23 \* \* \*"\]/);
    });

    const nine = new Date('2026-07-01T23:00:00Z');

    test('nothing is sent on a day with nothing new', async () => {
        let sent = 0;
        const result = await runDigest(env, nine, { send: async () => { sent++; } });
        assert.equal(result.reason, 'nothing_new');
        assert.equal(sent, 0);
    });

    test('new feedback is sent once, then marked', async () => {
        await post('/r', records([
            feedback({ message: '<script>alert(1)</script> & more' }),
            feedback({ category: 'praise' }),
        ]));
        const sent = [];
        const result = await runDigest(env, nine, { send: async (_env, raw) => { sent.push(raw); } });
        assert.equal(result.sent, true);
        assert.equal(sent.length, 1);
        assert.match(sent[0], /^Subject: SUD Toolkit: 2 new feedback items \(1 error\)$/m);
        assert.match(sent[0], /^To: author@example\.com$/m);

        // Bodies are base64; decode the HTML part and check the message is text.
        const parts = sent[0].split(/\r\n\r\n/);
        const htmlPart = parts[parts.findIndex(p => p.includes('text/html')) + 1];
        const html = Buffer.from(htmlPart.split('--sud-')[0].replace(/\r\n/g, ''), 'base64').toString('utf8');
        assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; more'));
        assert.ok(!html.includes('<script>'));
        assert.ok(html.includes('Registrar, Emergency Department'));

        assert.equal(rows('SELECT * FROM feedback WHERE emailed_at IS NULL').length, 0);
        const again = await runDigest(env, nine, { send: async () => { throw new Error('sent twice'); } });
        assert.equal(again.reason, 'nothing_new');
    });

    test('a failed send leaves the feedback for tomorrow', async () => {
        await post('/r', records([feedback()]));
        await assert.rejects(runDigest(env, nine, { send: async () => { throw new Error('smtp down'); } }));
        assert.equal(rows('SELECT * FROM feedback WHERE emailed_at IS NULL').length, 1);
    });

    test('outside 9am it does nothing', async () => {
        await post('/r', records([feedback()]));
        const result = await runDigest(env, new Date('2026-07-01T22:00:00Z'),
            { send: async () => { throw new Error('wrong hour'); } });
        assert.equal(result.reason, 'not_digest_hour');
    });

    test('without a destination it does nothing', async () => {
        await post('/r', records([feedback()]));
        delete env.DIGEST_TO;
        const result = await runDigest(env, nine, { send: async () => { throw new Error('no address'); } });
        assert.equal(result.reason, 'not_configured');
    });

    test('the scheduled handler is wired', async () => {
        const pending = [];
        await worker.scheduled({ scheduledTime: Date.parse('2026-07-01T22:00:00Z') }, env,
            { waitUntil: p => pending.push(p) });
        assert.equal(pending.length, 1);
        assert.equal((await pending[0]).reason, 'not_digest_hour');
    });

    test('escaping covers quotes as well as angle brackets', () => {
        assert.equal(escapeHtml(`<a href="x" onclick='y'>`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;');
        const { html } = buildDigest([{ page: 'home-page', category: 'error', role: 'nurse', location: 'ed',
            message: '"><img src=x onerror=alert(1)>' }], { sessions: 0, yes: 0, no: 0, surveys: 0, errors: 0 }, '');
        assert.ok(!html.includes('<img'));
    });
});
