// The daily feedback email.
//
// Feedback is saved to the database the moment it arrives; this email is only
// a reminder that there is something to read. So it is built from whatever has
// not been emailed yet rather than from "yesterday" — a day the send fails is
// picked up by the next morning's email instead of being lost — and no email
// goes out on a day with nothing new.
//
// Sent with Cloudflare Email Routing's send_email binding, to an address that
// has been verified in Email Routing. See worker/README.md for the setup.

import { ROLE_LABELS, LOCATION_LABELS, pageName } from './labels.js';

export const DIGEST_HOUR = 9;
export const DIGEST_TIME_ZONE = 'Australia/Sydney';
const MAX_ITEMS = 50;

const CATEGORY_LABELS = { error: 'Error', unclear: 'Unclear', suggestion: 'Suggestion', praise: 'Praise' };

// The cron fires at two UTC hours; only the one that is 9am in Sydney sends.
export function isDigestHour(now) {
    const hour = new Intl.DateTimeFormat('en-AU', {
        timeZone: DIGEST_TIME_ZONE, hour: 'numeric', hourCycle: 'h23',
    }).format(now);
    return Number(hour) === DIGEST_HOUR;
}

export function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function who(i) {
    return `${ROLE_LABELS[i.role] || i.role}, ${LOCATION_LABELS[i.location] || i.location}`;
}


export function buildDigest(items, stats, adminUrl) {
    const errors = items.filter(i => i.category === 'error').length;
    const subject = `SUD Toolkit: ${items.length} new feedback item${items.length === 1 ? '' : 's'}`
        + (errors ? ` (${errors} error${errors === 1 ? '' : 's'})` : '');

    const statsLine = `In the last 24 hours: ${stats.sessions} sessions, `
        + `${stats.yes} helpful / ${stats.no} not helpful ratings, `
        + `${stats.surveys} surveys completed, ${stats.errors} app errors.`;

    const text = [
        'New feedback',
        '',
        ...items.flatMap(i => [
            `[${CATEGORY_LABELS[i.category]}] ${pageName(i.page)} - ${who(i)}`,
            i.message,
            '',
        ]),
        statsLine,
        '',
        adminUrl ? `Open the admin page: ${adminUrl}` : '',
    ].join('\n');

    // Every value from the database is escaped: messages are typed by anyone
    // who can open the app.
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
<h2 style="margin:0 0 12px">New feedback</h2>
${items.map(i => `<div style="border-left:3px solid #ccc;padding:4px 12px;margin:10px 0">
<strong>${escapeHtml(CATEGORY_LABELS[i.category])}</strong> &middot; <strong>${escapeHtml(pageName(i.page))}</strong>
<span style="color:#666">&middot; ${escapeHtml(who(i))}</span><br>
${escapeHtml(i.message).replace(/\n/g, '<br>')}</div>`).join('\n')}
<p style="color:#555">${escapeHtml(statsLine)}</p>
${adminUrl ? `<p><a href="${escapeHtml(adminUrl)}">Open the admin page</a></p>` : ''}
<p style="color:#888;font-size:12px">No email is sent on days with no new feedback.</p>
</body></html>`;

    return { subject, text, html };
}

function base64Lines(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    for (const b of bytes) binary += String.fromCharCode(b);
    return btoa(binary).replace(/.{1,76}/g, '$&\r\n');
}

// A plain multipart/alternative message. Both parts are base64 so a message
// containing any character at all survives transport intact.
export function buildMime({ from, to, subject, text, html, now }) {
    const boundary = `sud-${crypto.randomUUID()}`;
    const domain = from.split('@')[1] || 'localhost';
    return [
        `From: SUD Toolkit <${from}>`,
        `To: ${to}`,
        `Subject: ${subject.replace(/[\r\n]/g, ' ')}`,
        `Date: ${now.toUTCString()}`,
        `Message-ID: <${crypto.randomUUID()}@${domain}>`,
        'MIME-Version: 1.0',
        `Content-Type: multipart/alternative; boundary="${boundary}"`,
        '',
        `--${boundary}`,
        'Content-Type: text/plain; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Lines(text),
        `--${boundary}`,
        'Content-Type: text/html; charset=utf-8',
        'Content-Transfer-Encoding: base64',
        '',
        base64Lines(html),
        `--${boundary}--`,
        '',
    ].join('\r\n');
}

// Imported only when an email is actually sent: `cloudflare:email` exists in
// the Workers runtime and nowhere else, so the tests pass their own sender.
async function sendWithCloudflare(env, raw) {
    const { EmailMessage } = await import('cloudflare:email');
    await env.DIGEST.send(new EmailMessage(env.DIGEST_FROM, env.DIGEST_TO, raw));
}

export async function runDigest(env, now, { send = sendWithCloudflare, force = false } = {}) {
    if (!force && !isDigestHour(now)) return { sent: false, reason: 'not_digest_hour' };
    if (!env.DIGEST_FROM || !env.DIGEST_TO || (!env.DIGEST && send === sendWithCloudflare)) {
        console.warn('[digest] not configured: set DIGEST_FROM, DIGEST_TO and the DIGEST binding');
        return { sent: false, reason: 'not_configured' };
    }

    const { results } = await env.DB.prepare(
        `SELECT id, page, category, role, location, message FROM feedback
          WHERE emailed_at IS NULL ORDER BY id LIMIT ${MAX_ITEMS}`
    ).all();
    const items = results || [];
    if (items.length === 0) return { sent: false, reason: 'nothing_new' };

    const since = new Date(now.getTime() - 86_400_000).toISOString();
    const [events, surveys, errors] = await Promise.all([
        env.DB.prepare(
            `SELECT SUM(event = 'session') AS sessions, SUM(event = 'helpful_yes') AS yes,
                    SUM(event = 'helpful_no') AS no FROM events WHERE occurred_at >= ?`
        ).bind(since).first(),
        env.DB.prepare('SELECT COUNT(*) AS n FROM survey_responses WHERE occurred_at >= ?').bind(since).first(),
        env.DB.prepare('SELECT COUNT(*) AS n FROM app_errors WHERE occurred_at >= ?').bind(since).first(),
    ]);

    const stats = {
        sessions: events?.sessions || 0,
        yes: events?.yes || 0,
        no: events?.no || 0,
        surveys: surveys?.n || 0,
        errors: errors?.n || 0,
    };

    const { subject, text, html } = buildDigest(items, stats, env.ADMIN_URL);
    const raw = buildMime({ from: env.DIGEST_FROM, to: env.DIGEST_TO, subject, text, html, now });

    await send(env, raw);

    // Marked only after the send succeeded: a failed send leaves them for
    // tomorrow's email.
    const ids = items.map(i => i.id);
    await env.DB.prepare(
        `UPDATE feedback SET emailed_at = ? WHERE id IN (${ids.map(() => '?').join(', ')})`
    ).bind(now.toISOString(), ...ids).run();

    return { sent: true, count: items.length, subject };
}
