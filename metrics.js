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
const DEVICE_KEY = 'sud.device';

// Set this to the deployed worker once it exists — see worker/README.md. While
// it is empty every function here is a no-op, so the access-code gate can ship
// and be used before any collection is switched on.
const ENDPOINT = '';

// Roughly a fortnight of heavy single-device use. Past this the oldest events
// are dropped: a device that has been offline for a month is a device whose
// early events are already the least interesting, and an unbounded queue in
// localStorage eventually throws on write and takes the app with it.
const MAX_QUEUED = 500;

// Matches MAX_EVENTS_PER_BATCH in the worker. A larger batch is rejected whole.
const MAX_BATCH = 100;

const FLUSH_DEBOUNCE_MS = 5000;

let role = null;
let location = null;
let appVersion = '';
let flushTimer = null;
let flushing = false;

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

    clearTimeout(flushTimer);
    flushTimer = setTimeout(() => flush(), FLUSH_DEBOUNCE_MS);
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
    if (!ENDPOINT || !role || flushing || !navigator.onLine) return;

    const device = deviceId();
    if (!device) return;

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
