// The author's admin page: read feedback, mark it actioned, and see how the app
// is being used.
//
// The page itself (public/admin/) is static and holds nothing secret — it is a
// login box until a password is entered. Everything it shows comes from the
// /admin/api/ routes below, and every one of those requires the export token
// as a bearer header. A header rather than a cookie means another site cannot
// make a logged-in browser act here (no CSRF), and the token never sits in a
// URL or a server log.
//
// Feedback messages are typed by anyone who can open the app, so the page
// treats them as hostile: it writes them with textContent, never as HTML, and
// is served with a Content-Security-Policy that would block an injected script
// even if that rule were broken.

import { ALLOWED_ROLES, ALLOWED_LOCATIONS, DETAIL_PATTERN, FEEDBACK_CATEGORIES, FEEDBACK_STATUSES } from './vocab.js';
import { requireToken, readJson, toCsv } from './util.js';
import { ROLE_LABELS, LOCATION_LABELS } from './labels.js';

const PAGE_HEADERS = {
    'Content-Security-Policy': [
        "default-src 'none'",
        "script-src 'self'",
        "style-src 'self'",
        "connect-src 'self'",
        "img-src 'self' data:",
        "base-uri 'none'",
        "form-action 'none'",
        "frame-ancestors 'none'",
    ].join('; '),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Cache-Control': 'no-store',
};

const API_HEADERS = {
    'Content-Type': 'application/json',
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-store',
};

const DAY_OPTIONS = [7, 30, 90, 365, 0];
const MAX_LIST = 500;
const MAX_EXPORT = 50000;

function apiJson(body, status = 200) {
    return new Response(JSON.stringify(body), { status, headers: API_HEADERS });
}

// The date, role and setting filters every view shares. Anything not on the
// lists is ignored rather than passed through, so a filter value can never
// reach SQL as anything but a bound parameter from a known set.
export function parseFilters(url, now = new Date()) {
    const p = url.searchParams;
    const requested = Number.parseInt(p.get('days') || '30', 10);
    const days = DAY_OPTIONS.includes(requested) ? requested : 30;
    return {
        days,
        since: days ? new Date(now.getTime() - days * 86_400_000).toISOString() : '1970-01-01T00:00:00.000Z',
        role: ALLOWED_ROLES.has(p.get('role')) ? p.get('role') : null,
        location: ALLOWED_LOCATIONS.has(p.get('location')) ? p.get('location') : null,
        status: FEEDBACK_STATUSES.includes(p.get('status')) ? p.get('status') : null,
        category: FEEDBACK_CATEGORIES.includes(p.get('category')) ? p.get('category') : null,
        page: DETAIL_PATTERN.test(p.get('page') || '') ? p.get('page') : null,
    };
}

// Builds a WHERE clause from fixed fragments and bound values only.
function where(f, extra = [], { feedback = false } = {}) {
    const clauses = ['occurred_at >= ?'];
    const args = [f.since];
    if (f.role) { clauses.push('role = ?'); args.push(f.role); }
    if (f.location) { clauses.push('location = ?'); args.push(f.location); }
    if (feedback) {
        if (f.status) { clauses.push('status = ?'); args.push(f.status); }
        if (f.category) { clauses.push('category = ?'); args.push(f.category); }
        if (f.page) { clauses.push('page = ?'); args.push(f.page); }
    }
    for (const [clause, ...values] of extra) {
        clauses.push(clause);
        args.push(...values);
    }
    return { sql: 'WHERE ' + clauses.join(' AND '), args };
}

function prepared(env, sql, args) {
    const statement = env.DB.prepare(sql);
    return args.length ? statement.bind(...args) : statement;
}

async function all(env, sql, args) {
    const { results } = await prepared(env, sql, args).all();
    return results || [];
}

async function first(env, sql, args) {
    return (await prepared(env, sql, args).first()) || {};
}

async function overview(env, f) {
    const sessions = where(f, [["event = 'session'"]]);
    const ratings = where(f, [["event IN ('helpful_yes', 'helpful_no')"]]);
    const views = where(f, [["event = 'page_view'"], ['detail IS NOT NULL']]);
    const scales = where(f, [["event = 'scale_complete'"], ['detail IS NOT NULL']]);
    const plain = where(f);

    const [
        totals, returning, ratingTotals, byPage, byRole, byLocation, weekly, topPages, topScales,
        survey, errors, feedbackNew,
    ] = await Promise.all([
        first(env, `SELECT COUNT(*) AS sessions, COUNT(DISTINCT device_id) AS devices
                      FROM events ${sessions.sql}`, sessions.args),
        // A returning device is one that opened the app in two or more
        // different weeks — the closest thing to "kept using it" the data has.
        first(env, `SELECT COUNT(*) AS n FROM (
                      SELECT device_id FROM events ${sessions.sql}
                       GROUP BY device_id
                      HAVING COUNT(DISTINCT strftime('%Y-%W', occurred_at)) >= 2)`, sessions.args),
        first(env, `SELECT SUM(event = 'helpful_yes') AS yes, SUM(event = 'helpful_no') AS no
                      FROM events ${ratings.sql}`, ratings.args),
        all(env, `SELECT detail AS page, SUM(event = 'helpful_yes') AS yes, SUM(event = 'helpful_no') AS no
                    FROM events ${ratings.sql} AND detail IS NOT NULL
                   GROUP BY detail ORDER BY COUNT(*) DESC LIMIT 15`, ratings.args),
        all(env, `SELECT role AS label, COUNT(*) AS n FROM events ${sessions.sql}
                   GROUP BY role ORDER BY n DESC`, sessions.args),
        all(env, `SELECT location AS label, COUNT(*) AS n FROM events ${sessions.sql}
                   GROUP BY location ORDER BY n DESC`, sessions.args),
        all(env, `SELECT strftime('%Y-%W', occurred_at) AS week, MIN(date(occurred_at)) AS start,
                         COUNT(*) AS n
                    FROM events ${sessions.sql} GROUP BY week ORDER BY week`, sessions.args),
        all(env, `SELECT detail AS label, COUNT(*) AS n FROM events ${views.sql}
                   GROUP BY detail ORDER BY n DESC LIMIT 10`, views.args),
        all(env, `SELECT detail AS label, COUNT(*) AS n FROM events ${scales.sql}
                   GROUP BY detail ORDER BY n DESC LIMIT 10`, scales.args),
        first(env, `SELECT COUNT(*) AS n, AVG(sus) AS avg FROM survey_responses ${plain.sql}`, plain.args),
        all(env, `SELECT message, page, COUNT(*) AS n, MAX(app_version) AS version
                    FROM app_errors ${plain.sql}
                   GROUP BY message, page ORDER BY n DESC LIMIT 5`, plain.args),
        first(env, "SELECT COUNT(*) AS n FROM feedback WHERE status = 'new'", []),
    ]);

    return {
        sessions: totals.sessions || 0,
        devices: totals.devices || 0,
        returning: returning.n || 0,
        ratings: { yes: ratingTotals.yes || 0, no: ratingTotals.no || 0 },
        byPage,
        byRole,
        byLocation,
        weekly,
        topPages,
        topScales,
        survey: { n: survey.n || 0, avg: survey.avg },
        errors,
        feedbackNew: feedbackNew.n || 0,
    };
}

async function feedbackList(env, f) {
    const w = where(f, [], { feedback: true });
    const items = await all(env,
        `SELECT id, occurred_at, received_at, page, category, helpful, role, location, message,
                app_version, status, status_at
           FROM feedback ${w.sql} ORDER BY occurred_at DESC LIMIT ${MAX_LIST}`, w.args);
    // The page filter's options: every page that has ever had feedback.
    const pages = await all(env, 'SELECT DISTINCT page FROM feedback ORDER BY page', []);
    const counts = await first(env, `SELECT SUM(status = 'new') AS new FROM feedback`, []);
    return { items, pages: pages.map(p => p.page), newCount: counts.new || 0 };
}

async function setStatus(request, env) {
    const { payload, error } = await readJson(request, null);
    if (error) return error;
    const id = Number(payload?.id);
    const status = payload?.status;
    if (!Number.isInteger(id) || id < 1 || !FEEDBACK_STATUSES.includes(status)) {
        return apiJson({ error: 'bad_request' }, 400);
    }
    const result = await env.DB.prepare('UPDATE feedback SET status = ?, status_at = ? WHERE id = ?')
        .bind(status, new Date().toISOString(), id).run();
    if (!result?.meta?.changes) return apiJson({ error: 'not_found' }, 404);
    return apiJson({ ok: true });
}

async function surveySummary(env, f) {
    const w = where(f);
    const questions = Array.from({ length: 10 }, (_, i) => `AVG(q${i + 1}) AS q${i + 1}`).join(', ');
    const [totals, byRole, byMonth, changed] = await Promise.all([
        first(env, `SELECT COUNT(*) AS n, AVG(sus) AS avg, ${questions}
                      FROM survey_responses ${w.sql}`, w.args),
        all(env, `SELECT role AS label, COUNT(*) AS n, AVG(sus) AS avg FROM survey_responses ${w.sql}
                   GROUP BY role ORDER BY n DESC`, w.args),
        all(env, `SELECT strftime('%Y-%m', occurred_at) AS month, COUNT(*) AS n, AVG(sus) AS avg
                    FROM survey_responses ${w.sql} GROUP BY month ORDER BY month`, w.args),
        all(env, `SELECT changed AS label, COUNT(*) AS n FROM survey_responses ${w.sql}
                   GROUP BY changed ORDER BY n DESC`, w.args),
    ]);
    return {
        n: totals.n || 0,
        avg: totals.avg,
        perQuestion: Array.from({ length: 10 }, (_, i) => totals[`q${i + 1}`]),
        byRole,
        byMonth,
        changed,
    };
}

async function errorGroups(env, f) {
    const w = where(f);
    const groups = await all(env,
        `SELECT message, source, page, COUNT(*) AS n, COUNT(DISTINCT device_id) AS devices,
                GROUP_CONCAT(DISTINCT app_version) AS versions,
                GROUP_CONCAT(DISTINCT platform) AS platforms,
                MIN(occurred_at) AS first_seen, MAX(occurred_at) AS last_seen
           FROM app_errors ${w.sql}
          GROUP BY message, source, page ORDER BY last_seen DESC LIMIT ${MAX_LIST}`, w.args);
    return { groups };
}

const EXPORTS = {
    feedback: {
        table: 'feedback',
        columns: ['id', 'occurred_at', 'received_at', 'device_id', 'role', 'location', 'page', 'category',
            'helpful', 'message', 'app_version', 'status', 'status_at', 'emailed_at'],
        feedback: true,
    },
    survey: {
        table: 'survey_responses',
        columns: ['id', 'occurred_at', 'received_at', 'device_id', 'role', 'location', 'app_version',
            'q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'changed', 'sus'],
    },
    errors: {
        table: 'app_errors',
        columns: ['id', 'occurred_at', 'received_at', 'device_id', 'role', 'location', 'app_version',
            'page', 'message', 'source', 'platform'],
    },
    events: {
        table: 'events',
        columns: ['id', 'eid', 'received_at', 'occurred_at', 'device_id', 'role', 'location',
            'event', 'detail', 'app_version', 'standalone', 'queued'],
    },
};

async function exportCsv(env, f, name) {
    const spec = EXPORTS[name];
    const w = where(f, [], { feedback: Boolean(spec.feedback) });
    const rows = await all(env,
        `SELECT ${spec.columns.join(', ')} FROM ${spec.table} ${w.sql} ORDER BY id LIMIT ${MAX_EXPORT}`,
        w.args);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(toCsv(spec.columns, rows), {
        headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="sudtoolkit-${name}-${stamp}.csv"`,
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

export async function handleAdmin(request, env, url) {
    const path = url.pathname;

    // The static page and its script. Served by the assets binding, with the
    // security headers added here so they cannot be lost by a hosting change.
    if (!path.startsWith('/admin/api/')) {
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            return new Response('Method not allowed.\n', { status: 405 });
        }
        if (!env.ASSETS) return new Response('Admin page not deployed.\n', { status: 503 });
        const asset = await env.ASSETS.fetch(request);
        const response = new Response(asset.body, asset);
        for (const [k, v] of Object.entries(PAGE_HEADERS)) response.headers.set(k, v);
        return response;
    }

    const denied = requireToken(request, env);
    if (denied) return denied;

    const f = parseFilters(url);
    const route = path.slice('/admin/api/'.length);

    try {
        if (request.method === 'GET' && route === 'labels') {
            return apiJson({ roles: ROLE_LABELS, locations: LOCATION_LABELS });
        }
        if (request.method === 'GET' && route === 'overview') return apiJson(await overview(env, f));
        if (request.method === 'GET' && route === 'feedback') return apiJson(await feedbackList(env, f));
        if (request.method === 'POST' && route === 'feedback/status') return await setStatus(request, env);
        if (request.method === 'GET' && route === 'survey') return apiJson(await surveySummary(env, f));
        if (request.method === 'GET' && route === 'errors') return apiJson(await errorGroups(env, f));

        const csv = route.match(/^export\/(feedback|survey|errors|events)\.csv$/);
        if (request.method === 'GET' && csv) return await exportCsv(env, f, csv[1]);
    } catch {
        return apiJson({ error: 'query_failed' }, 500);
    }

    return apiJson({ error: 'not_found' }, 404);
}
