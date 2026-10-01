// Feedback, survey answers and app error reports: the records a person chose to
// send, or the app sent about itself.
//
// These arrive at /r rather than /e because, unlike a usage event, they are
// not a name from a fixed list. A feedback message is free text typed by a
// clinician — the first thing this endpoint accepts that is. Everything else
// about them is still a fixed vocabulary, and each kind has its own table so a
// column can never be reused for something it was not designed to hold.
//
// The endpoint is public, so it assumes hostile input: every field is checked
// against a pattern or a list, text is length-capped, and each device has a
// daily ceiling per kind so a script cannot fill the database or the author's
// inbox.

import {
    ALLOWED_ROLES, ALLOWED_LOCATIONS, DETAIL_PATTERN, DETAIL_MAX,
    FEEDBACK_CATEGORIES, PLATFORMS, CHANGED_ANSWERS,
} from './vocab.js';
import { EID_PATTERN, MAX_ID_LEN, json, str, occurredAt, readJson, scrub, cleanText } from './util.js';

export const MAX_RECORDS_PER_BATCH = 20;
export const MAX_FEEDBACK_CHARS = 1000;
const MAX_ERROR_CHARS = 200;
const MAX_SOURCE_CHARS = 120;
const SOURCE_PATTERN = /^[A-Za-z0-9._-]{1,80}:\d{1,7}:\d{1,7}$/;

// Per device, per UTC day. Generous for a person, small for a script.
export const DAILY_CAPS = { feedback: 20, survey: 2, error: 50 };

const TABLE = { feedback: 'feedback', survey: 'survey_responses', error: 'app_errors' };

/**
 * System Usability Scale score, 0-100.
 *
 * Odd items are positively worded and score (answer - 1); even items are
 * negatively worded and score (5 - answer). The sum of the ten is multiplied by
 * 2.5. Brooke J. SUS: a "quick and dirty" usability scale. 1996.
 */
export function susScore(answers) {
    let sum = 0;
    answers.forEach((a, i) => { sum += i % 2 === 0 ? a - 1 : 5 - a; });
    return sum * 2.5;
}

function page(value) {
    const raw = str(value, DETAIL_MAX);
    return raw && DETAIL_PATTERN.test(raw) ? raw : null;
}

function oneOf(list, value) {
    return typeof value === 'string' && list.includes(value) ? value : null;
}

// Returns the column values for one record, or null if it is not acceptable.
function validate(kind, item) {
    if (kind === 'feedback') {
        const category = oneOf(FEEDBACK_CATEGORIES, item.category);
        const where = page(item.page);
        const message = typeof item.message === 'string'
            ? str(cleanText(item.message), MAX_FEEDBACK_CHARS) : null;
        if (!category || !where || !message) return null;
        return {
            page: where,
            category,
            helpful: oneOf(['yes', 'no'], item.helpful),
            message,
        };
    }

    if (kind === 'survey') {
        const answers = item.answers;
        if (!Array.isArray(answers) || answers.length !== 10 ||
            !answers.every(a => Number.isInteger(a) && a >= 1 && a <= 5)) return null;
        const row = { changed: oneOf(CHANGED_ANSWERS, item.changed), sus: susScore(answers) };
        answers.forEach((a, i) => { row[`q${i + 1}`] = a; });
        return row;
    }

    if (kind === 'error') {
        const message = typeof item.message === 'string'
            ? str(scrub(cleanText(item.message)).replace(/\s+/g, ' '), MAX_ERROR_CHARS) : null;
        if (!message) return null;
        // file:line:column, built by the app from the error itself. Checked
        // against that shape rather than scrubbed: line numbers in script.js
        // run to four digits, which the number mask would destroy.
        const rawSource = str(item.source, MAX_SOURCE_CHARS);
        const source = rawSource && SOURCE_PATTERN.test(rawSource) ? rawSource : null;
        return {
            message,
            source,
            page: page(item.page),
            platform: oneOf(PLATFORMS, item.platform) || 'other',
        };
    }

    return null;
}

function startOfUtcDay(now) {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
}

export async function handleRecords(request, env, origin) {
    const { payload, error } = await readJson(request, origin);
    if (error) return error;

    const deviceId = str(payload?.device_id, MAX_ID_LEN);
    const appVersion = str(payload?.app_version, 20);
    if (!deviceId || !appVersion) {
        return json({ error: 'missing_fields' }, 400, origin);
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (items.length === 0) {
        return json({ error: 'no_items' }, 400, origin);
    }
    if (items.length > MAX_RECORDS_PER_BATCH) {
        return json({ error: 'too_many_items' }, 413, origin);
    }

    const now = new Date();
    const receivedAt = now.toISOString();

    // How many of each kind this device has already sent today. Read once per
    // request, then counted down as this batch is accepted.
    const remaining = {};
    for (const kind of Object.keys(TABLE)) {
        if (!items.some(i => i?.kind === kind)) continue;
        const row = await env.DB.prepare(
            `SELECT COUNT(*) AS n FROM ${TABLE[kind]} WHERE device_id = ? AND received_at >= ?`
        ).bind(deviceId, startOfUtcDay(now)).first();
        remaining[kind] = DAILY_CAPS[kind] - (row?.n || 0);
    }

    const statements = [];
    const seen = new Set();
    for (const item of items) {
        const kind = item?.kind;
        if (!Object.hasOwn(TABLE, kind)) continue;

        const rid = str(item?.id, MAX_ID_LEN);
        if (!rid || !EID_PATTERN.test(rid) || seen.has(rid)) continue;

        // Same rule as usage events: each record carries the role and setting
        // of the launch that wrote it, because the queue outlives the launch.
        const role = str(item?.role, MAX_ID_LEN);
        const location = str(item?.location, MAX_ID_LEN);
        if (!role || !location ||
            !ALLOWED_ROLES.has(role) || !ALLOWED_LOCATIONS.has(location)) continue;

        const fields = validate(kind, item);
        if (!fields) continue;

        if (remaining[kind] <= 0) continue;
        remaining[kind]--;
        seen.add(rid);

        const row = {
            rid,
            received_at: receivedAt,
            occurred_at: occurredAt(item?.t, now),
            device_id: deviceId,
            role,
            location,
            app_version: appVersion,
            ...fields,
        };
        const columns = Object.keys(row);
        statements.push(
            env.DB.prepare(
                `INSERT OR IGNORE INTO ${TABLE[kind]} (${columns.join(', ')})
                 VALUES (${columns.map(() => '?').join(', ')})`
            ).bind(...columns.map(c => row[c]))
        );
    }

    if (statements.length === 0) {
        return json({ error: 'no_valid_items' }, 400, origin);
    }

    try {
        await env.DB.batch(statements);
    } catch {
        // The app keeps the batch and retries, the same as for events.
        return json({ error: 'write_failed' }, 500, origin);
    }

    return json({ ok: true, stored: statements.length }, 200, origin);
}
