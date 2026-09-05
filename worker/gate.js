// A shared-password gate that runs at Cloudflare's edge, in front of the
// GitHub Pages origin. Everything below the gate is the site exactly as it is
// today: the Worker either passes the request through untouched, or answers it
// with the login page instead.
//
// Why a Worker and not Cloudflare Access: Access authenticates *people* (email
// one-time PIN, or an identity provider). There is no shared-password login in
// Zero Trust, and no dashboard setting that turns a stored secret into a login
// prompt. A secret is only storage — something has to read it and decide. This
// file is that something.
//
// What the gate actually protects, given the service worker: sw.js is
// cache-first from the snapshot it installed (see its fetch handler), so an
// already-installed device serves the whole app from its own cache and never
// reaches the edge. The password therefore gates FIRST LOAD and UPDATES, not
// every use. That is the right shape for a ward phone — a clinician mid-shift
// is never bounced to a login screen — but it does mean revoking the password
// does not evict anyone already carrying a copy.

const COOKIE_NAME = 'sud_gate';
const LOGIN_PATH = '/__gate';
const LOGOUT_PATH = '/__gate/logout';

// Long on purpose. A short session means a login prompt lands on someone
// mid-consultation, and the failure mode of that is a clinician who gives up
// and uses something else. Thirty days is a deliberate trade of strictness for
// the thing actually being defended: casual public discovery of the site.
const SESSION_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

// ---------------------------------------------------------------------------
// Crypto helpers. Exported for the unit tests in test/gate.test.js — they are
// pure functions of their arguments and hold no Worker state.
// ---------------------------------------------------------------------------

// Compares without leaking, through timing, how much of the input was right.
// A plain === on two strings bails at the first differing byte, which tells a
// patient attacker the password's length and then its prefix one character at
// a time. Both callers below hash their inputs first, so the arrays are always
// the same length and only the constant-time property matters here.
export function timingSafeEqual(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

export async function sha256(value) {
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
    return new Uint8Array(digest);
}

// The submitted password is compared as a digest rather than as text: equal
// digests mean equal passwords, and the digests are a fixed 32 bytes whatever
// the inputs were, so the length check in timingSafeEqual can never short out.
export async function passwordMatches(submitted, expected) {
    const [a, b] = await Promise.all([sha256(submitted), sha256(expected)]);
    return timingSafeEqual(a, b);
}

function base64url(bytes) {
    let binary = '';
    for (const byte of new Uint8Array(bytes)) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret, message) {
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    return base64url(await crypto.subtle.sign('HMAC', key, encoder.encode(message)));
}

// The cookie is `<unix-expiry>.<signature over that expiry>`. Signing is what
// makes it a credential rather than a suggestion: without it, anyone can open
// devtools, set sud_gate=whatever, and walk straight past the form.
export async function issueToken(signingSecret, expiresAt) {
    return `${expiresAt}.${await hmac(signingSecret, String(expiresAt))}`;
}

export async function verifyToken(signingSecret, token, nowSeconds) {
    if (typeof token !== 'string') {
        return false;
    }
    const separator = token.indexOf('.');
    if (separator < 1) {
        return false;
    }
    const expiresAt = token.slice(0, separator);
    const signature = token.slice(separator + 1);

    // Check the signature before the expiry, and with the same comparison used
    // for the password: the expiry is attacker-supplied until proven otherwise.
    if (!/^\d+$/.test(expiresAt)) {
        return false;
    }
    const expected = await hmac(signingSecret, expiresAt);
    if (!timingSafeEqual(encoder.encode(signature), encoder.encode(expected))) {
        return false;
    }
    return Number(expiresAt) > nowSeconds;
}

export function readCookie(header, name) {
    if (!header) {
        return null;
    }
    for (const part of header.split(';')) {
        const eq = part.indexOf('=');
        if (eq === -1) {
            continue;
        }
        if (part.slice(0, eq).trim() === name) {
            return part.slice(eq + 1).trim();
        }
    }
    return null;
}

// Where to send someone after they log in. Only same-origin paths: a bare
// `//evil.example` or `https://evil.example` in the redirect would turn the
// login form into an open redirect that borrows this domain's credibility.
export function safeNext(value) {
    if (typeof value !== 'string' || !value.startsWith('/')) {
        return '/';
    }
    if (value.startsWith('//') || value.startsWith('/\\') || value.startsWith(LOGIN_PATH)) {
        return '/';
    }
    return value;
}

// ---------------------------------------------------------------------------
// The login page
// ---------------------------------------------------------------------------

function escapeHtml(value) {
    return value.replace(/[&<>"']/g, ch => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
    ));
}

// Inline styles, no external requests: this page has to render for someone who
// has never been past the gate and therefore has nothing cached, and on a
// hospital network that may block whatever it does not recognise. The palette
// is style.css's, so the gate does not look like a different site.
function loginPage(message, next) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>SUD Toolkit</title>
<style>
:root { --bg: #f0f0f0; --fg: #000; --card: #fff; --border: #ced4da; --btn: #007BFF; --btn-hover: #0056b3; --muted: #495057; --danger: #721c24; --danger-bg: #f8d7da; --danger-border: #dc3545; }
@media (prefers-color-scheme: dark) {
  :root { --bg: #2b2b2b; --fg: #fff; --card: #3a3a3a; --border: #555; --muted: #ced4da; --danger: #f5c6cb; --danger-bg: #58151c; }
}
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 1.5rem;
       background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
main { width: 100%; max-width: 22rem; background: var(--card); border: 1px solid var(--border); border-radius: 8px; padding: 1.75rem; }
h1 { margin: 0 0 .25rem; font-size: 1.35rem; }
p { margin: 0 0 1.25rem; color: var(--muted); font-size: .9rem; line-height: 1.45; }
label { display: block; font-size: .85rem; font-weight: 600; margin-bottom: .4rem; }
input { width: 100%; padding: .7rem; font-size: 1rem; color: var(--fg); background: var(--bg);
        border: 1px solid var(--border); border-radius: 4px; }
input:focus-visible, button:focus-visible { outline: 3px solid var(--btn); outline-offset: 2px; }
button { width: 100%; margin-top: 1rem; padding: .7rem; font-size: 1rem; font-weight: 600; color: #fff;
         background: var(--btn); border: none; border-radius: 4px; cursor: pointer; }
button:hover { background: var(--btn-hover); }
.error { margin: 0 0 1rem; padding: .6rem .75rem; font-size: .85rem; border-radius: 4px;
         color: var(--danger); background: var(--danger-bg); border: 1px solid var(--danger-border); }
</style>
</head>
<body>
<main>
  <h1>SUD Toolkit</h1>
  <p>This clinical decision support tool is restricted. Enter the access password to continue.</p>
  ${message ? `<p class="error" role="alert">${escapeHtml(message)}</p>` : ''}
  <form method="POST" action="${escapeHtml(LOGIN_PATH)}">
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <label for="password">Access password</label>
    <input id="password" name="password" type="password" autocomplete="current-password"
           autocapitalize="none" autocorrect="off" spellcheck="false" required autofocus>
    <button type="submit">Continue</button>
  </form>
</main>
</body>
</html>`;
}

// 401 rather than 200, and never stored. The status matters to sw.js: its
// precache rejects any non-OK response (see the response.ok check in
// precache()), so a worker install that runs into an expired session skips
// those files and fails cleanly instead of writing the login page into the
// offline snapshot under the name of script.js.
function loginResponse(message, next, status = 401) {
    return new Response(loginPage(message, next), {
        status,
        headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store, must-revalidate',
            'x-robots-tag': 'noindex, nofollow',
        },
    });
}

function cookieHeader(value, maxAge) {
    // HttpOnly so page scripts cannot read it; SameSite=Lax so it still rides
    // along when someone follows a link to the site from email or a chat app,
    // which is how most people will arrive.
    return `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

// ---------------------------------------------------------------------------
// Request handling
// ---------------------------------------------------------------------------

export default {
    async fetch(request, env) {
        const sitePassword = env.SITE_PASSWORD;
        const signingSecret = env.GATE_SIGNING_SECRET;

        // Fail closed. If the secrets are missing the gate cannot tell a
        // clinician from a stranger, and quietly serving the app to everyone
        // would be a silent loss of the only control there is. Installed
        // devices keep working from their cached snapshot regardless.
        if (!sitePassword || !signingSecret) {
            return new Response('Access gate is not configured.', {
                status: 503,
                headers: { 'cache-control': 'no-store' },
            });
        }

        const url = new URL(request.url);
        const now = Math.floor(Date.now() / 1000);

        if (url.pathname === LOGOUT_PATH) {
            return new Response(null, {
                status: 303,
                headers: { location: '/', 'set-cookie': cookieHeader('', 0) },
            });
        }

        if (url.pathname === LOGIN_PATH && request.method === 'POST') {
            const form = await request.formData();
            const next = safeNext(form.get('next'));
            const submitted = form.get('password');

            if (typeof submitted !== 'string' || !(await passwordMatches(submitted, sitePassword))) {
                // Deliberately vague, and deliberately slow. There is no rate
                // limiter here (that needs KV or a Durable Object), so a fixed
                // delay on failure is the cheap brake on someone scripting
                // guesses. Choose a long password and it is enough.
                await new Promise(resolve => setTimeout(resolve, 500));
                return loginResponse('Incorrect password.', next, 401);
            }

            const token = await issueToken(signingSecret, now + SESSION_SECONDS);
            return new Response(null, {
                status: 303,
                headers: {
                    location: next,
                    'set-cookie': cookieHeader(token, SESSION_SECONDS),
                    'cache-control': 'no-store',
                },
            });
        }

        const token = readCookie(request.headers.get('cookie'), COOKIE_NAME);
        if (await verifyToken(signingSecret, token, now)) {
            return fetch(request);
        }

        // A GET of the login path is someone arriving at the form directly;
        // anything else is an unauthenticated request for real content, and
        // the path it wanted becomes the post-login destination.
        const next = url.pathname === LOGIN_PATH ? '/' : safeNext(url.pathname + url.search);
        return loginResponse(null, next);
    },
};
