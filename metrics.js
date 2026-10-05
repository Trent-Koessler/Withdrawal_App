// Usage telemetry for the research project.
//
// What leaves the device: a random device id, the role and location the
// clinician selected, which feature was used, and when. Nothing a clinician
// typed — no scores, no patient details, no free text. The worker enforces the
// same lists again on arrival, so widening what is collected takes a deliberate
// change in two places.
//
// The hard part is not sending; it is sending from a ward. The app is
// offline-first and a real share of use happens with no signal, so events are
// written to a local queue first and drained when a connection appears. Send
// directly and the dataset would show only the clinicians who happened to be
// standing near an access point — which is the opposite of the finding this
// project exists to produce.

const QUEUE_KEY = 'sud.queue';
const OUTBOX_KEY = 'sud.outbox';
const DEVICE_KEY = 'sud.device';

// The deployed worker — see worker/README.md. Setting this to '' switches
// collection off completely: every function here becomes a no-op and nothing is
// even queued. The privacy statement on the About page describes collection as
// on, so it has to change in the same release as this line.
const ENDPOINT = 'https://metrics.sudtoolkit.org/e';

// Roughly a fortnight of heavy single-device use. Past this the oldest events
// are dropped: a device that has been offline for a month is a device whose
// early events are already the least interesting, and an unbounded queue in
// localStorage eventually throws on write and takes the app with it.
const MAX_QUEUED = 500;

// Matches MAX_EVENTS_PER_BATCH in the worker. A larger batch is rejected whole.
const MAX_BATCH = 100;

// Feedback, survey answers and error reports go to their own endpoint beside
// the events one, through their own queue: they are fewer, larger, and one of
// them is free text, so the worker validates them separately. The queue cap is
// small because each item is a deliberate act, not a page view.
const RECORDS_ENDPOINT = ENDPOINT ? ENDPOINT.replace(/\/e$/, '/r') : '';
const MAX_OUTBOX = 50;
// Matches MAX_RECORDS_PER_BATCH in the worker.
const MAX_RECORDS_BATCH = 20;

// At most this many error reports from one launch. A fault in a render loop
// would otherwise send the same error a thousand times.
const MAX_ERRORS_PER_LAUNCH = 5;

const FLUSH_DEBOUNCE_MS = 5000;

let role = null;
let location = null;
let appVersion = '';
let flushTimer = null;
let flushDueAt = 0;
let flushing = false;
let flushingOutbox = false;

function readQueue() {
    try {
        const raw = window.localStorage.getItem(QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        // Corrupt or unavailable. An unreadable queue is discarded rather than
        // retried forever — telemetry is never worth breaking the app for.
        return [];
    }
}

function writeQueue(events) {
    try {
        window.localStorage.setItem(QUEUE_KEY, JSON.stringify(events));
    } catch {
        /* Full or blocked. The events are lost; the app carries on. */
    }
}

function readOutbox() {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(OUTBOX_KEY) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeOutbox(items) {
    try {
        window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
        return true;
    } catch {
        return false;
    }
}

/**
 * A random identifier for this install, minted once.
 *
 * It is not derived from anything about the device or the person — it exists
 * only so repeat use can be told apart from ten separate clinicians, which is
 * the difference between "40 sessions" and "40 sessions across 4 devices".
 * Clearing site data mints a new one and the old device simply looks retired.
 */
function deviceId() {
    try {
        let id = window.localStorage.getItem(DEVICE_KEY);
        if (!id) {
            id = window.crypto.randomUUID();
            window.localStorage.setItem(DEVICE_KEY, id);
        }
        return id;
    } catch {
        return null;
    }
}

// True when launched from a home-screen icon rather than a browser tab.
function isStandalone() {
    return Boolean(
        window.matchMedia?.('(display-mode: standalone)').matches ||
        window.navigator.standalone
    );
}

/**
 * Start collecting. Called once the clinician has answered the gate, because
 * until then there is no role or location to attribute an event to — so
 * record() stays inert before this runs.
 *
 * Role and location come from this launch's answers, not from storage: the
 * stored values are only a pre-selection, and the clinician may have changed
 * them precisely because the device's last user was someone else.
 */
export function startMetrics(context, version) {
    role = context.role;
    location = context.location;
    appVersion = version;

    if (!ENDPOINT) return;

    // Minted here rather than lazily at flush time, so it is in place before
    // the first event is recorded against it.
    deviceId();

    // Errors that happened before the gate was answered. They belong to this
    // launch, so they are sent with this launch's role and setting — and only
    // now, so a launch that never gets past the gate sends nothing at all.
    for (const report of earlyErrors.splice(0)) {
        submit('error', report);
    }

    window.addEventListener('online', () => flush());

    // The last events of a session would otherwise sit in the queue until the
    // next launch. `pagehide` rather than `unload`: iOS Safari never fires
    // unload for a PWA, which is most of the devices this runs on.
    window.addEventListener('pagehide', () => flush({ keepalive: true }));
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flush({ keepalive: true });
    });

    flush();
}

/**
 * Record one event.
 *
 * `detail` names which feature — a scale id, a page id — and is dropped by the
 * worker unless it matches the expected shape. Never pass anything a clinician
 * entered.
 */
export function record(event, detail = null) {
    // No endpoint means collection is not switched on yet, and nothing is
    // recorded at all — not even locally. Queueing quietly instead would mean
    // that the day the endpoint is configured, a backlog of events from before
    // anyone was told the app was being monitored is uploaded along with the
    // first real one.
    if (!ENDPOINT || !role) return;

    let eid;
    try {
        eid = window.crypto.randomUUID();
    } catch {
        return;
    }

    const queue = readQueue();
    queue.push({
        eid,
        event,
        detail,
        // Stamped here, not at send time. The queue lives in localStorage and
        // is therefore shared by every tab on the device and outlives the
        // launch that wrote it — so an event can easily be sent by a different
        // launch, with a different person at the keyboard. Labelling at flush
        // would then attribute a night registrar's ED session to whoever opened
        // the app next, which is precisely the confusion this study cannot
        // afford. The event carries the context it happened in.
        role,
        location,
        t: new Date().toISOString(),
        // Recorded now, because by flush time the connection has returned and
        // the fact that this happened offline would be lost.
        queued: navigator.onLine ? 0 : 1,
    });

    writeQueue(queue.slice(-MAX_QUEUED));

    scheduleFlush(FLUSH_DEBOUNCE_MS);
}

// Whichever send is due first wins. A usage event recorded just after a
// survey is submitted must not push the survey's send back by five seconds,
// during which the app may well be closed; and a burst of page views sends
// once, five seconds after the first, rather than never while they continue.
function scheduleFlush(delay) {
    const due = Date.now() + delay;
    if (flushTimer && flushDueAt <= due) return;
    clearTimeout(flushTimer);
    flushDueAt = due;
    flushTimer = setTimeout(() => { flushTimer = null; flush(); }, delay);
}

/**
 * Try to send whatever is queued.
 *
 * Sends whatever is in the queue, including events another launch recorded
 * under a different role — each event carries its own, so that is correct
 * rather than merely tolerated.
 *
 * Events are removed only once the server has confirmed the write. A resend
 * after an ambiguous failure is expected and safe — each event carries a unique
 * id and the worker ignores one it already holds.
 */
export async function flush({ keepalive = false } = {}) {
    if (!ENDPOINT || !role || !navigator.onLine) return;

    const device = deviceId();
    if (!device) return;

    await flushEvents(device, keepalive);
    await flushOutbox(device, keepalive);
}

async function flushEvents(device, keepalive) {
    if (flushing) return;
    const queue = readQueue();
    if (queue.length === 0) return;

    const batch = queue.slice(0, MAX_BATCH);
    flushing = true;

    try {
        const response = await fetch(ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                device_id: device,
                app_version: appVersion,
                standalone: isStandalone(),
                events: batch,
            }),
            keepalive,
        });

        if (response.ok) {
            // Re-read rather than reusing `queue`: record() may have appended
            // while the request was in flight, and writing the stale array back
            // would silently drop those events.
            const current = readQueue();
            const sent = new Set(batch.map(e => e.eid));
            writeQueue(current.filter(e => !sent.has(e.eid)));
        } else if (response.status >= 400 && response.status < 500 &&
                   response.status !== 429) {
            // The server will never accept this batch — an unknown role, or
            // events from a version whose names it no longer allows. Retrying
            // forever would wedge the queue and block everything behind it.
            const current = readQueue();
            const sent = new Set(batch.map(e => e.eid));
            writeQueue(current.filter(e => !sent.has(e.eid)));
        }
        // 5xx and 429: leave the batch queued and try again later.
    } catch {
        /* Offline or blocked by a hospital proxy. The queue keeps it. */
    } finally {
        flushing = false;
    }
}

// The same contract as the events queue: removed only once the server has
// confirmed the write or refused it outright; kept on a network failure, a 5xx
// or a 429.
async function flushOutbox(device, keepalive) {
    if (!RECORDS_ENDPOINT || flushingOutbox) return;
    const outbox = readOutbox();
    if (outbox.length === 0) return;

    const batch = outbox.slice(0, MAX_RECORDS_BATCH);
    flushingOutbox = true;
    try {
        const response = await fetch(RECORDS_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: device, app_version: appVersion, items: batch }),
            keepalive,
        });
        if (response.ok ||
            (response.status >= 400 && response.status < 500 && response.status !== 429)) {
            const sent = new Set(batch.map(i => i.id));
            writeOutbox(readOutbox().filter(i => !sent.has(i.id)));
        }
    } catch {
        /* Offline. It waits in the outbox. */
    } finally {
        flushingOutbox = false;
    }
}

/** True once the gate has been answered and an endpoint is configured. */
export function isCollecting() {
    return Boolean(ENDPOINT && role);
}

/** This launch's answers at the gate, for showing what a report will carry. */
export function currentContext() {
    return { role, location };
}

/**
 * Queue a feedback message, survey response or error report to send.
 *
 * Unlike record(), what is passed here can include text the clinician typed —
 * that is the point of a feedback form — so it is only ever called from the
 * feedback form and the survey, each of which tells the person what is sent.
 * Returns false if nothing was queued.
 */
export function submit(kind, data) {
    if (!ENDPOINT || !role) return false;

    let id;
    try {
        id = window.crypto.randomUUID();
    } catch {
        return false;
    }

    const outbox = readOutbox();
    outbox.push({
        ...data,
        id,
        kind,
        role,
        location,
        t: new Date().toISOString(),
        queued: navigator.onLine ? 0 : 1,
    });
    if (!writeOutbox(outbox.slice(-MAX_OUTBOX))) return false;

    // Sooner than a usage event: someone who has just pressed Send may close
    // the app straight away.
    scheduleFlush(500);
    return true;
}

// --- Error reports --- //
//
// Caught here, at module load, so that an error anywhere in the app is seen —
// but held in memory until the gate is answered, and sent with nothing but the
// message, where in the code it happened, which page was open, and a coarse
// device type. Long numbers and email addresses are masked first, because an
// error message can quote a value that came from an input.

const earlyErrors = [];
const seenErrors = new Set();
let errorsThisLaunch = 0;

export function scrubErrorText(text) {
    return String(text)
        .replace(/[^\s@]+@[^\s@]+/g, '[email]')
        .replace(/\d{4,}/g, '#')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 200);
}

function platform() {
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios';
    if (/Android/.test(ua)) return 'android';
    if (/Windows/.test(ua)) return 'windows';
    if (/Macintosh/.test(ua)) return 'mac';
    if (/Linux/.test(ua)) return 'linux';
    return 'other';
}

function noteError(error, file, line, column) {
    const raw = error && error.message ? error.message : error;
    if (!raw) return;
    const message = scrubErrorText(raw);
    // "Script error." is all a browser reports for a script from another
    // origin. This app loads none, so it carries no information.
    if (!message || /^Script error\.?$/.test(message)) return;

    // Only the file name, never a full URL: a URL could carry a query string.
    // A rejected promise has no file or line of its own, so those come from
    // the first frame of its stack instead.
    let where = file ? `${String(file).split(/[?#]/)[0].split('/').pop()}:${line || 0}:${column || 0}` : null;
    if (!where && error && typeof error.stack === 'string') {
        const frame = error.stack.match(/([A-Za-z0-9._-]+\.js)(?:\?[^:\s)]*)?:(\d+):(\d+)/);
        if (frame) where = `${frame[1]}:${frame[2]}:${frame[3]}`;
    }
    const key = `${message}|${where}`;
    if (seenErrors.has(key) || errorsThisLaunch >= MAX_ERRORS_PER_LAUNCH) return;
    seenErrors.add(key);
    errorsThisLaunch++;

    const page = window.location.hash.replace(/^#\/?/, '').slice(0, 81) || 'home-page';
    const report = { message, source: where, page, platform: platform() };
    if (role) submit('error', report);
    else earlyErrors.push(report);
}

if (ENDPOINT && typeof window !== 'undefined') {
    window.addEventListener('error', event => {
        noteError(event.error || event.message, event.filename, event.lineno, event.colno);
    });
    window.addEventListener('unhandledrejection', event => {
        noteError(event.reason);
    });
}
