// Small helpers shared by every route. Each value written to the database
// passes through str(), a pattern test, or one of the vocab lists.

import { ALLOWED_ORIGINS } from './vocab.js';

// crypto.randomUUID() on the client. Pinned to that shape so the uniqueness
// guarantee the dedupe relies on is the browser's, not the caller's promise.
export const EID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const MAX_BODY_BYTES = 64 * 1024;
export const MAX_ID_LEN = 64;

export function corsHeaders(origin) {
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

export function json(body, status, origin) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
    });
}

// Trims to a maximum length and rejects anything that is not a plain string.
export function str(value, maxLen) {
    if (typeof value !== 'string') return null;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > maxLen) return null;
    return trimmed;
}

// An ISO timestamp the client claims the event happened at. A ward device with
// a wrong clock is common, so this is sanity-bounded rather than trusted: more
// than a day ahead or a year behind is a broken clock, and the server time is
// substituted so the row is still usable.
export function occurredAt(value, now) {
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
export function tokenMatches(provided, expected) {
    if (typeof provided !== 'string' || typeof expected !== 'string') return false;
    if (provided.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < provided.length; i++) {
        diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return diff === 0;
}

// The export token, from a bearer header or (for the plain CSV download) a
// query parameter. Returns a Response to send back when it is missing or wrong,
// and null when the caller may proceed.
export function requireToken(request, env, { allowQuery = false } = {}) {
    const expected = env.EXPORT_TOKEN;
    if (!expected) {
        return new Response('Not configured.\n', { status: 503 });
    }
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const query = allowQuery ? new URL(request.url).searchParams.get('token') : '';
    if (!tokenMatches(bearer || query || '', expected)) {
        return new Response('Unauthorized.\n', { status: 401 });
    }
    return null;
}

export function csvCell(value) {
    if (value === null || value === undefined) return '';
    const text = String(value);
    // Excel and Sheets both treat a leading =, +, - or @ as a formula. Feedback
    // messages are typed by anyone who can reach the app, so this matters: the
    // export is the file the author opens by double-clicking.
    const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[",\n\r]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function toCsv(columns, rows) {
    const lines = [columns.join(',')];
    for (const row of rows) {
        lines.push(columns.map(col => csvCell(row[col])).join(','));
    }
    return lines.join('\n') + '\n';
}

// Reads and parses a JSON body with a size cap. Returns { payload } or
// { error: Response }.
export async function readJson(request, origin) {
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > MAX_BODY_BYTES) {
        return { error: json({ error: 'too_large' }, 413, origin) };
    }
    try {
        const body = await request.text();
        if (body.length > MAX_BODY_BYTES) {
            return { error: json({ error: 'too_large' }, 413, origin) };
        }
        return { payload: JSON.parse(body) };
    } catch {
        return { error: json({ error: 'bad_json' }, 400, origin) };
    }
}

// Removes anything that looks like it could identify a person from text the
// app generated rather than a person typed — an error message can quote a value
// that came from an input. Long digit runs (an MRN, a phone number, a date of
// birth) and email addresses are masked. The app applies the same rule before
// sending; this is the second copy, because the endpoint is public.
export function scrub(text) {
    return text
        .replace(/[^\s@]+@[^\s@]+/g, '[email]')
        .replace(/\d{4,}/g, '#');
}

// Control characters other than newline and tab are stripped from typed text:
// they have no business in a feedback message and some break CSV readers.
export function cleanText(text) {
    // eslint-disable-next-line no-control-regex
    return text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
}
