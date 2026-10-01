// The usability survey: the System Usability Scale, plus one question of the
// app's own.
//
// The SUS is ten standard statements answered from 1 (strongly disagree) to 5
// (strongly agree), scored 0-100. It is used here, rather than questions
// written for this app, because its scores can be compared with published
// ones: a score of 68 is the average across hundreds of studies. "System" is
// replaced with "app" throughout, which is a standard and validated wording.
// Brooke J. SUS: a "quick and dirty" usability scale. In: Usability Evaluation
// in Industry. 1996. Bangor A et al. Int J Hum Comput Interact 2008;24:574-94.
//
// When it is asked: once this device has been used for 5 sessions, then again
// a month after each completed survey, so a change over time can be seen. It
// appears when the clinician comes back to the Home page — the end of a task,
// never the middle of one — and at most once per launch. "Not now" asks again
// in a week; "Don't ask me again" is final for this device.

import { record, submit, isCollecting } from './metrics.js';

export const SUS_ITEMS = [
    'I think that I would like to use this app frequently.',
    'I found the app unnecessarily complex.',
    'I thought the app was easy to use.',
    'I think that I would need the support of a technical person to be able to use this app.',
    'I found the various functions in this app were well integrated.',
    'I thought there was too much inconsistency in this app.',
    'I would imagine that most people would learn to use this app very quickly.',
    'I found the app very cumbersome to use.',
    'I felt very confident using the app.',
    'I needed to learn a lot of things before I could get going with this app.',
];

export const CHANGED_QUESTION = 'Has using this app changed how you managed a patient?';
export const CHANGED_OPTIONS = [
    { id: 'yes', label: 'Yes' },
    { id: 'no', label: 'No' },
    { id: 'unsure', label: 'Not sure' },
];

export const MIN_SESSIONS = 5;
export const REPEAT_DAYS = 30;
export const SNOOZE_DAYS = 7;

const SESSIONS_KEY = 'sud.sessions';
const LAST_KEY = 'sud.survey.last';
const SNOOZE_KEY = 'sud.survey.snooze';
const OPTOUT_KEY = 'sud.survey.optout';

const DAY_MS = 86_400_000;

let offeredThisLaunch = false;

function read(key) {
    try { return window.localStorage.getItem(key); } catch { return null; }
}

function write(key, value) {
    try {
        if (value === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, value);
    } catch { /* storage refused: the survey simply may be asked again */ }
}

/** Same scoring as the worker; a test asserts the two agree. */
export function susScore(answers) {
    let sum = 0;
    answers.forEach((a, i) => { sum += i % 2 === 0 ? a - 1 : 5 - a; });
    return sum * 2.5;
}

/**
 * Whether the survey is due. Pure, so the rule can be tested without a
 * browser: enough sessions, not opted out, not snoozed, and either never
 * completed or completed at least REPEAT_DAYS ago.
 */
export function surveyDue({ sessions, last, snoozeUntil, optedOut, now }) {
    if (optedOut) return false;
    if (!(sessions >= MIN_SESSIONS)) return false;
    if (snoozeUntil && now < snoozeUntil) return false;
    if (last && now - last < REPEAT_DAYS * DAY_MS) return false;
    return true;
}

/** Count a session on this device. Called once per launch, after the gate. */
export function noteSession() {
    const n = Number.parseInt(read(SESSIONS_KEY) || '0', 10) || 0;
    write(SESSIONS_KEY, String(n + 1));
}

function due(now = Date.now()) {
    return surveyDue({
        sessions: Number.parseInt(read(SESSIONS_KEY) || '0', 10) || 0,
        last: Date.parse(read(LAST_KEY) || '') || null,
        snoozeUntil: Date.parse(read(SNOOZE_KEY) || '') || null,
        optedOut: read(OPTOUT_KEY) === '1',
        now,
    });
}

function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
        if (value === null || value === undefined || value === false) continue;
        if (key === 'class') node.className = value;
        else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
        else node.setAttribute(key, value === true ? '' : String(value));
    }
    for (const child of children.flat()) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

// Every list of children goes through here: replaceChildren() would print a
// null - an optional part that is not shown - as the word "null".
function fill(node, ...children) {
    node.replaceChildren(...children.flat().filter(c => c !== null && c !== undefined && c !== false));
}

function openModal() {
    const card = el('div', { class: 'modal-content survey-card' });
    const modal = el('div', {
        class: 'modal survey-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'survey-title',
    }, card);
    const previousFocus = document.activeElement;

    const close = () => {
        modal.remove();
        document.body.classList.remove('modal-open');
        document.removeEventListener('keydown', onKey);
        if (previousFocus && previousFocus.focus) previousFocus.focus();
    };
    // Escape is "Not now", never an answer.
    const onKey = event => {
        if (event.key === 'Escape') {
            snooze();
            close();
        }
    };
    document.addEventListener('keydown', onKey);

    document.body.append(modal);
    document.body.classList.add('modal-open');
    modal.style.display = 'block';
    return { card, close };
}

function snooze() {
    write(SNOOZE_KEY, new Date(Date.now() + SNOOZE_DAYS * DAY_MS).toISOString());
    record('survey', 'later');
}

function showInvite({ card, close }) {
    fill(card,
        el('h3', { id: 'survey-title' }, 'Help improve this app'),
        el('p', null, "You've used the app a few times now. Would you answer ",
            el('strong', null, `${SUS_ITEMS.length + 1} quick questions`),
            ' about how easy it is to use? It takes about 2 minutes.'),
        el('p', { class: 'survey-small' }, 'Your answers are sent with your role and setting but no name, and are '
            + 'used only to improve the app and for its evaluation. No patient information is asked for.'),
        el('div', { class: 'survey-actions' },
            el('button', {
                type: 'button', class: 'survey-primary',
                onclick: () => { record('survey', 'started'); showQuestion({ card, close }, 0, []); },
            }, 'Start survey'),
            el('button', {
                type: 'button', class: 'secondary-btn',
                onclick: () => { snooze(); close(); },
            }, 'Not now - ask me later'),
            el('button', {
                type: 'button', class: 'survey-never',
                onclick: () => { write(OPTOUT_KEY, '1'); record('survey', 'never'); close(); },
            }, "Don't ask me again")));
    card.querySelector('.survey-primary').focus();
}

function showQuestion(modal, index, answers) {
    const { card, close } = modal;
    const total = SUS_ITEMS.length + 1;
    const isLast = index === SUS_ITEMS.length;
    const options = isLast
        ? CHANGED_OPTIONS.map(o => ({ value: o.id, label: o.label }))
        : [1, 2, 3, 4, 5].map(v => ({ value: v, label: String(v) }));

    const next = el('button', { type: 'button', class: 'survey-primary', disabled: answers[index] === undefined ? true : null },
        isLast ? 'Finish' : 'Next');
    const group = el('div', {
        class: isLast ? 'survey-options survey-options-wide' : 'survey-options',
        role: 'radiogroup', 'aria-labelledby': 'survey-title',
    }, options.map(o => el('button', {
        type: 'button', role: 'radio', class: 'survey-option',
        'aria-checked': answers[index] === o.value ? 'true' : 'false',
        'aria-label': isLast ? o.label : `${o.label} of 5`,
        onclick: event => {
            answers[index] = o.value;
            group.querySelectorAll('.survey-option').forEach(b => b.setAttribute('aria-checked', 'false'));
            event.currentTarget.setAttribute('aria-checked', 'true');
            next.disabled = false;
        },
    }, o.label)));

    next.addEventListener('click', () => {
        if (!isLast) {
            showQuestion(modal, index + 1, answers);
            return;
        }
        submit('survey', { answers: answers.slice(0, SUS_ITEMS.length), changed: answers[SUS_ITEMS.length] });
        write(LAST_KEY, new Date().toISOString());
        write(SNOOZE_KEY, null);
        record('survey', 'completed');
        fill(card,
            el('h3', { id: 'survey-title' }, 'Thank you'),
            el('p', null, 'Your answers have been saved. The survey will ask again in about a month, '
                + 'so changes to the app can be measured over time.'),
            el('div', { class: 'survey-actions' },
                el('button', { type: 'button', class: 'survey-primary', onclick: close }, 'Close')));
        card.querySelector('.survey-primary').focus();
    });

    fill(card,
        el('div', { class: 'survey-small' }, `Question ${index + 1} of ${total}`),
        el('div', { class: 'survey-progress', 'aria-hidden': 'true' },
            el('i', { class: 'survey-progress-bar' })),
        el('h3', { id: 'survey-title', class: 'survey-question' }, isLast ? CHANGED_QUESTION : SUS_ITEMS[index]),
        group,
        isLast ? null : el('div', { class: 'survey-ends', 'aria-hidden': 'true' },
            el('span', null, 'Strongly disagree'), el('span', null, 'Strongly agree')),
        el('div', { class: 'survey-nav' },
            el('button', {
                type: 'button', class: 'secondary-btn',
                onclick: () => (index === 0 ? showInvite(modal) : showQuestion(modal, index - 1, answers)),
            }, 'Back'),
            next),
        el('button', {
            type: 'button', class: 'survey-never',
            onclick: () => { snooze(); close(); },
        }, 'Stop - ask me later'));
    card.querySelector('.survey-progress-bar').style.width = `${(100 * index) / total}%`;
    card.querySelector('.survey-option')?.focus();
}

/**
 * Offer the survey if it is due. Called when the clinician arrives back on the
 * Home page from somewhere else. Does nothing if collection is off, another
 * dialog or the search panel is open, or it has already been offered this
 * launch.
 */
export function maybeOfferSurvey() {
    if (offeredThisLaunch || !isCollecting() || !due()) return false;
    if (document.body.classList.contains('modal-open')) return false;
    const search = document.getElementById('search-panel');
    if (search && !search.hidden) return false;

    offeredThisLaunch = true;
    record('survey', 'offered');
    showInvite(openModal());
    return true;
}
