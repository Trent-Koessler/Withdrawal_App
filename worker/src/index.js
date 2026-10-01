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

import {
    ALLOWED_ORIGINS, ALLOWED_EVENTS, ALLOWED_ROLES, ALLOWED_LOCATIONS, DETAIL_PATTERN, DETAIL_MAX,
} from './vocab.js';
import {
    EID_PATTERN, MAX_ID_LEN, corsHeaders, json, str, occurredAt, readJson, requireToken, csvCell,
} from './util.js';
import { handleRecords } from './records.js';
import { handleAdmin } from './admin.js';
import { runDigest } from './digest.js';

// The vocabularies (event names, roles, locations, the `detail` shape) live in
// vocab.js, shared with the feedback and admin routes. See worker/README.md.

const MAX_EVENTS_PER_BATCH = 100;

async function handleIngest(request, env, origin) {
    const { payload, error } = await readJson(request, origin);
    if (error) return error;

    const deviceId = str(payload?.device_id, MAX_ID_LEN);
    const appVersion = str(payload?.app_version, 20);

    if (!deviceId || !appVersion) {
        return json({ error: 'missing_fields' }, 400, origin);
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
           (eid, received_at, occurred_at, device_id, role, location, event,
            detail, app_version, standalone, queued)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
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

        // Per event, not per batch: the app's queue is shared across launches,
        // so one upload legitimately carries events recorded by different
        // people in different places. Dropped rather than stored as NULL,
        // because these are the study's grouping variables — and the `stored`
        // count in the response is then lower than the batch size, which is how
        // a version mismatch shows up as something visible rather than as a
        // hole found months later.
        const role = str(item?.role, MAX_ID_LEN);
        const location = str(item?.location, MAX_ID_LEN);
        if (!role || !location ||
            !ALLOWED_ROLES.has(role) || !ALLOWED_LOCATIONS.has(location)) continue;

        const rawDetail = str(item?.detail, DETAIL_MAX);
        const detail = rawDetail && DETAIL_PATTERN.test(rawDetail) ? rawDetail : null;

        statements.push(
            insert.bind(
                eid,
                receivedAt,
                occurredAt(item?.t, now),
                deviceId,
                role,
                location,
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
    'id', 'eid', 'received_at', 'occurred_at', 'device_id', 'role', 'location',
    'event', 'detail', 'app_version', 'standalone', 'queued',
];

async function handleExport(request, env) {
    const denied = requireToken(request, env, { allowQuery: true });
    if (denied) return denied;

    const url = new URL(request.url);

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

        // Feedback, survey answers and error reports. Same origin rule.
        if (url.pathname === '/r' && request.method === 'POST') {
            if (!origin || !ALLOWED_ORIGINS.has(origin)) {
                return json({ error: 'forbidden_origin' }, 403, origin);
            }
            return handleRecords(request, env, origin);
        }

        if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
            return handleAdmin(request, env, url);
        }

        if (url.pathname === '/export.csv' && request.method === 'GET') {
            return handleExport(request, env);
        }

        if (url.pathname === '/health') {
            return new Response('ok\n', { status: 200 });
        }

        return new Response('Not found.\n', { status: 404 });
    },

    // The daily feedback email. wrangler.toml fires this at two UTC hours so
    // that one of them is 9am in Sydney whether or not daylight saving is on;
    // runDigest() works out which.
    async scheduled(controller, env, ctx) {
        ctx.waitUntil(runDigest(env, new Date(controller.scheduledTime || Date.now())));
    },
};
