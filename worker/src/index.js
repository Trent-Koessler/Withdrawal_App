// Usage telemetry endpoint for sudtoolkit.org.
//
// The app is a static PWA on GitHub Pages, which can serve files but cannot
// receive anything. This worker is the one piece that can: it accepts batches
// of usage events and writes them to D1. Hosting does not move — this sits
// beside the app at its own hostname.
//
// Design constraints, in the order they mattered:
//
//   1. It records that a feature was used, never what was typed into it. The
//      allow-lists below are the enforcement, not a convention: an event or
//      detail that is not named here is dropped rather than stored, so a
//      future caller cannot widen what is collected by sending more fields.
//   2. No IP addresses, no user agents, no headers of any kind are persisted.
//      Cloudflare sees the IP to route the request; nothing writes it down.
//   3. The endpoint is public — the URL ships inside the app, so anyone can
//      find it. Everything here assumes hostile input and fails closed.

const ALLOWED_ORIGINS = new Set([
    'https://sudtoolkit.org',
    'https://www.sudtoolkit.org',
    'https://trent-koessler.github.io',
]);

// Event names the study collects. Adding one here is a deliberate act; see
// worker/README.md for what each is for.
const ALLOWED_EVENTS = new Set([
    'unlock',         // access code accepted, or a remembered code re-opened the app
    'session',        // app launched (one per launch, after the attestation)
    'page_view',      // a tab or page was opened
    'scale_complete', // a clinician scored a patient on a scale — the utility signal.
                      // Abandonment is derived in analysis (a scales page_view
                      // with no scale_complete), not sent as its own event.
    'emr_copy',       // the copy-to-EMR button was used
    'survey',         // reserved for the usability questionnaire; not sent yet
]);

// `detail` is a fixed vocabulary, not free text. Anything unrecognised is
// stored as NULL rather than rejecting the whole event: losing which page was
// viewed is a smaller loss than losing the fact that a session happened.
const DETAIL_PATTERN = /^[a-z0-9][a-z0-9-]{0,39}$/;

// crypto.randomUUID() on the client. Pinned to that shape so the uniqueness
// guarantee the dedupe relies on is the browser's, not the caller's promise.
const EID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const MAX_BODY_BYTES = 64 * 1024;
const MAX_EVENTS_PER_BATCH = 100;
const MAX_ID_LEN = 64;

function corsHeaders(origin) {
    const headers = {
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        Vary: 'Origin',
    };
    if (origin && ALLOWED_ORIGINS.has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
    }
    return headers;
}

function json(body, status, origin) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
}

// Trims to a maximum length and rejects anything that is not a plain string.
// Every value written to the database passes through here or a pattern test.
function str(value, maxLen) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLen) return null;
    return trimmed;
}

// An ISO timestamp the client claims the event happened at. A ward device with
// a wrong clock is common, so this is sanity-bounded rather than trusted: more
// than a day ahead or a year behind is a broken clock, and the server time is
// substituted so the row is still usable.
function occurredAt(value, now) {
    const raw = str(value, 40);
    if (!raw) return now.toISOString();
    const parsed = Date.parse(raw);
    if (Number.isNaN(parsed)) return now.toISOString();
    const skewAhead = parsed - now.getTime();
    const skewBehind = now.getTime() - parsed;
    if (skewAhead > 86_400_000 || skewBehind > 365 * 86_400_000) {
        return now.toISOString();
    }
    return new Date(parsed).toISOString();
}

// Constant-time comparison so the export token cannot be recovered by timing
// repeated requests. Length is compared first and leaks only the length.
function tokenMatches(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    if (provided.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < provided.length; i++) {
        diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
}

function cohortAllowList(env) {
    return new Set(
        String(env.COHORTS || '')
            .split(',')
            .map(c => c.trim())
            .filter(Boolean)
    );
}

async function handleIngest(request, env, origin) {
    const cohorts = cohortAllowList(env);
    // Fail closed. An empty allow-list would otherwise accept every cohort id
    // sent to it, and the dataset silently fills with junk that looks real.
    if (cohorts.size === 0) {
        return json({ error: 'not_configured' }, 503, origin);
    }

    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) {
        return json({ error: 'too_large' }, 413, origin);
    }

    let payload;
    try {
        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) {
            return json({ error: 'too_large' }, 413, origin);
        }
        payload = JSON.parse(body);
    } catch {
        return json({ error: 'bad_json' }, 400, origin);
    }

    const deviceId = str(payload?.device_id, MAX_ID_LEN);
    const cohort = str(payload?.cohort, MAX_ID_LEN);
    const appVersion = str(payload?.app_version, 20);

    if (!deviceId || !cohort || !appVersion) {
        return json({ error: 'missing_fields' }, 400, origin);
    }
    if (!cohorts.has(cohort)) {
        return json({ error: 'unknown_cohort' }, 403, origin);
    }

    const batch = Array.isArray(payload.events) ? payload.events : [];
    if (batch.length === 0) {
        return json({ error: 'no_events' }, 400, origin);
    }
    if (batch.length > MAX_EVENTS_PER_BATCH) {
        return json({ error: 'too_many_events' }, 413, origin);
    }

    const now = new Date();
    const receivedAt = now.toISOString();
    const standalone = payload.standalone ? 1 : 0;

    // OR IGNORE, paired with the UNIQUE eid: a batch the app already sent but
    // never saw acknowledged is resent on the next launch, and lands as zero
    // new rows rather than a second copy.
    const insert = env.DB.prepare(
        `INSERT OR IGNORE INTO events
           (eid, received_at, occurred_at, device_id, cohort, event, detail,
            app_version, standalone, queued)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const statements = [];
    const seen = new Set();
    for (const item of batch) {
        const event = str(item?.event, 32);
        if (!event || !ALLOWED_EVENTS.has(event)) continue;

        // OR IGNORE would absorb a within-batch repeat anyway; dropping it
        // here just saves the round trip.
        const eid = str(item?.eid, MAX_ID_LEN);
        if (!eid || !EID_PATTERN.test(eid) || seen.has(eid)) continue;
        seen.add(eid);

        const rawDetail = str(item?.detail, 40);
        const detail = rawDetail && DETAIL_PATTERN.test(rawDetail) ? rawDetail : null;

        statements.push(
            insert.bind(
                eid,
                receivedAt,
                occurredAt(item?.t, now),
                deviceId,
                cohort,
                event,
                detail,
                appVersion,
                standalone,
                item?.queued ? 1 : 0
            )
        );
    }

    if (statements.length === 0) {
        return json({ error: 'no_valid_events' }, 400, origin);
    }

    try {
        await env.DB.batch(statements);
    } catch (err) {
        // The app treats a 5xx as "keep it queued and retry later", so a
        // transient D1 failure costs a delay rather than the data.
        return json({ error: 'write_failed' }, 500, origin);
    }

    return json({ ok: true, stored: statements.length }, 200, origin);
}

const CSV_COLUMNS = [
    'id', 'eid', 'received_at', 'occurred_at', 'device_id', 'cohort',
    'event', 'detail', 'app_version', 'standalone', 'queued',
];

function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    // Excel and Sheets both treat a leading =, +, - or @ as a formula. None of
    // our columns can contain one after the validation above, but the export
    // is the file a researcher opens by double-clicking, so it is neutralised
    // here rather than trusted not to happen.
    const guarded = /^[=+\-@]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

async function handleExport(request, env) {
    const expected = env.EXPORT_TOKEN;
    if (!expected) {
        return new Response('Export not configured.\n', { status: 503 });
    }

    const url = new URL(request.url);
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const provided = bearer || url.searchParams.get('token') || '';
    if (!tokenMatches(provided, expected)) {
        return new Response('Unauthorized.\n', { status: 401 });
    }

    // Cursor pagination rather than OFFSET: rows are only ever appended, so
    // `after` is stable across pages even while the app keeps writing.
    const after = Number.parseInt(url.searchParams.get('after') || '0', 10) || 0;
    const limit = Math.min(
        Math.max(Number.parseInt(url.searchParams.get('limit') || '10000', 10) || 10000, 1),
        50000
    );

    const { results } = await env.DB.prepare(
        `SELECT ${CSV_COLUMNS.join(', ')} FROM events
          WHERE id > ? ORDER BY id LIMIT ?`
    )
        .bind(after, limit)
        .all();

    const rows = results || [];
    const lines = [CSV_COLUMNS.join(',')];
    for (const row of rows) {
        lines.push(CSV_COLUMNS.map(col => csvCell(row[col])).join(','));
    }

    const lastId = rows.length ? rows[rows.length - 1].id : after;
    return new Response(lines.join('\n') + '\n', {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="sudtoolkit-events-${after}-${lastId}.csv"`,
            // Present on every page so a script knows whether to fetch again
            // without parsing the body.
            'X-Last-Id': String(lastId),
            'X-Row-Count': String(rows.length),
            'X-More': rows.length === limit ? 'true' : 'false',
        },
    });
}

export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const origin = request.headers.get('origin');

        if (request.method === 'OPTIONS') {
            return new Response(null, { status: 204, headers: corsHeaders(origin) });
        }

        if (url.pathname === '/e' && request.method === 'POST') {
            // The browser blocks the response without a matching CORS header,
            // but a non-browser caller never sees that check — so the origin
            // is enforced here too rather than relied on.
            if (!origin || !ALLOWED_ORIGINS.has(origin)) {
                return json({ error: 'forbidden_origin' }, 403, origin);
            }
            return handleIngest(request, env, origin);
        }

        if (url.pathname === '/export.csv' && request.method === 'GET') {
            return handleExport(request, env);
        }

        if (url.pathname === '/health') {
            return new Response('ok\n', { status: 200 });
        }

        return new Response('Not found.\n', { status: 404 });
    },
};
