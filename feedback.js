// "Was this page helpful?" and the feedback form at the foot of every page.
//
// Two very different things share one box:
//
//   The thumbs are a usage event like any other — a page id and yes or no,
//   nothing typed. They go through record() and the allow-listed events table.
//
//   The form is the one place in the app where a clinician's own words are
//   sent anywhere. It goes through submit() to its own table, it says plainly
//   what is sent with it, and it warns against patient details every time it
//   is opened, because the person typing may be standing at a bedside.
//
// The page key is the page id plus the open tab, when the page has tabs
// (`scales-page/ciwa-ar`), so a rating or a comment says which calculator or
// section it was about rather than just "the scales page".

import { record, submit, isCollecting, currentContext } from './metrics.js';
import { ROLES, CONSULT_LOCATIONS } from './data/access-config.js';

export const MAX_MESSAGE = 1000;

export const CATEGORIES = [
    { id: 'error', label: 'Error' },
    { id: 'unclear', label: 'Unclear' },
    { id: 'suggestion', label: 'Suggestion' },
    { id: 'praise', label: 'Praise' },
];

// The ratings given this launch, by page key, so moving away from a page and
// back shows the thanks rather than asking again.
const rated = new Map();
let fallbackEmail = '';
let appVersion = '';

/** The page id, plus the open top-level tab when the page has tabs. */
export function pageKey(page) {
    const tab = page.querySelector('.tab-container > .tab-buttons > .tab-button.active');
    return tab && tab.dataset.tab ? `${page.id}/${tab.dataset.tab}` : page.id;
}

function labelFor(list, id) {
    return list.find(item => item.id === id)?.label || id;
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

// The name a clinician would recognise: the button that opens the page, then
// the open tab's label.
function pageTitle(page) {
    const button = document.querySelector(`[data-page='${page.id}']`);
    const name = page.id === 'home-page' ? 'Home' : (button?.textContent || page.dataset.title || page.id);
    const tab = page.querySelector('.tab-container > .tab-buttons > .tab-button.active');
    return [name, tab?.textContent].filter(Boolean).map(t => t.replace(/\s+/g, ' ').trim()).join(' › ');
}

// The email route, for when collection is switched off: the same mailto the
// Feedback button always used, now saying which page it is about.
function mailtoFor(page) {
    const subject = `SUD Toolkit feedback: ${pageTitle(page)} (${pageKey(page)}, v${appVersion})`;
    return `mailto:${fallbackEmail}?subject=${encodeURIComponent(subject)}`;
}

function thumbs(section, page, key) {
    const current = rated.get(key);
    const choose = value => {
        if (rated.has(key)) return;
        rated.set(key, value);
        // Two literal calls rather than one computed name, so the test that
        // checks every recorded event name against the worker can see both.
        if (value === 'yes') record('helpful_yes', key);
        else record('helpful_no', key);
        // A No opens the form straight away: that is the moment someone is
        // most willing to say what was wrong.
        render(section, page, { form: value === 'no' });
    };
    return el('div', { class: 'feedback-thumbs', role: 'group', 'aria-label': 'Was this page helpful?' },
        el('button', {
            type: 'button', class: 'feedback-thumb', 'aria-pressed': current === 'yes' ? 'true' : 'false',
            disabled: current ? true : null, onclick: () => choose('yes'),
        }, el('span', { 'aria-hidden': 'true' }, '👍'), ' Yes'),
        el('button', {
            type: 'button', class: 'feedback-thumb', 'aria-pressed': current === 'no' ? 'true' : 'false',
            disabled: current ? true : null, onclick: () => choose('no'),
        }, el('span', { 'aria-hidden': 'true' }, '👎'), ' No'));
}

function form(section, page, key) {
    const helpful = rated.get(key) || null;
    const context = currentContext();
    const textarea = el('textarea', {
        class: 'feedback-text', maxlength: MAX_MESSAGE, rows: 4, 'aria-label': 'Your feedback',
        placeholder: helpful === 'no' ? 'What could be better on this page?' : 'What would you like to tell the author?',
    });
    const counter = el('span', { class: 'feedback-counter', 'aria-live': 'polite' }, `0 / ${MAX_MESSAGE}`);
    const send = el('button', { type: 'submit', class: 'feedback-send', disabled: true }, 'Send feedback');
    const chips = el('fieldset', { class: 'feedback-chips' },
        el('legend', null, 'What kind of feedback?'),
        CATEGORIES.map(c => el('label', { class: 'feedback-chip' },
            el('input', { type: 'radio', name: `feedback-category-${page.id}`, value: c.id }),
            el('span', null, c.label))));

    const update = () => {
        const chosen = chips.querySelector('input:checked');
        counter.textContent = `${textarea.value.length} / ${MAX_MESSAGE}`;
        send.disabled = !chosen || !textarea.value.trim();
    };
    textarea.addEventListener('input', update);
    chips.addEventListener('change', update);

    const node = el('form', {
        class: 'feedback-form',
        onsubmit: event => {
            event.preventDefault();
            const chosen = chips.querySelector('input:checked');
            const message = textarea.value.trim();
            if (!chosen || !message) return;
            const queued = submit('feedback', { page: key, category: chosen.value, message, helpful });
            render(section, page, { sent: queued ? (navigator.onLine ? 'online' : 'offline') : 'failed' });
        },
    },
    el('p', { class: 'feedback-heading' }, helpful ? 'Tell us more (optional)' : 'Report a problem or suggest a change'),
    chips,
    textarea,
    counter,
    el('div', { class: 'feedback-warning', role: 'note' },
        el('strong', null, '⚠ No patient details.'),
        ' Describe the problem with the page, not the patient.'),
    el('p', { class: 'feedback-meta' },
        `Sent with: the page you are on - ${pageTitle(page)} - the app version, and your role and `
        + `setting: ${labelFor(ROLES, context.role)}, ${labelFor(CONSULT_LOCATIONS, context.location)}. `
        + 'No name or email. Only the author can read it.'),
    el('div', { class: 'button-group feedback-buttons' },
        send,
        el('button', {
            type: 'button', class: 'secondary-btn',
            onclick: () => render(section, page, {}),
        }, 'Cancel')));

    requestAnimationFrame(() => textarea.focus({ preventScroll: true }));
    return node;
}

function sentMessage(how) {
    if (how === 'failed') {
        return el('p', { class: 'feedback-done', role: 'status' },
            'Sorry, your feedback could not be saved on this device. ',
            el('a', { href: `mailto:${fallbackEmail}` }, 'Email the author instead.'));
    }
    return el('div', { class: 'feedback-done', role: 'status' },
        el('span', { class: 'feedback-tick', 'aria-hidden': 'true' }, '✓'),
        el('div', null,
            el('strong', null, 'Thanks, your feedback has been saved.'),
            el('br'),
            el('span', { class: 'feedback-sub' }, how === 'offline'
                ? "No signal right now. It will send automatically when you're back online."
                : 'It has been sent to the author.')));
}

function render(section, page, { form: showForm = false, sent = null } = {}) {
    const key = pageKey(page);
    section.dataset.key = key;
    section.dataset.state = sent ? 'sent' : showForm ? 'form' : 'ask';

    // Collection switched off: no thumbs (they would record nothing) and the
    // form is replaced by the email link the app has always had.
    if (!isCollecting()) {
        fill(section,
            el('a', { class: 'feedback-link', href: mailtoFor(page) }, 'Email feedback about this page'));
        return;
    }

    if (sent) {
        fill(section, sentMessage(sent));
        return;
    }

    const current = rated.get(key);
    fill(section,
        el('p', { class: 'feedback-question' }, 'Was this page helpful?'),
        thumbs(section, page, key),
        current === 'yes' && !showForm ? el('p', { class: 'feedback-thanks' }, 'Thanks!') : null,
        showForm ? form(section, page, key) : el('button', {
            type: 'button', class: 'feedback-link',
            onclick: () => render(section, page, { form: true }),
        }, current === 'yes' ? 'Tell us more' : 'Report a problem or suggest a change'));
}

/**
 * Bring a page's box up to date with its open tab. Called when a page is shown
 * or a tab changes. A form that is open with text in it is left alone — the
 * clinician may have tapped a tab to check something they are writing about.
 */
export function refreshFeedback(page) {
    const section = page?.querySelector(':scope > .page-feedback');
    if (!section) return;
    if (section.dataset.state === 'form') return;
    if (section.dataset.state === 'sent' && section.dataset.key === pageKey(page)) return;
    render(section, page);
}

/** Re-draw every page's box. Called once the gate is answered and collection starts. */
export function refreshAllFeedback() {
    document.querySelectorAll('#main-content .page').forEach(refreshFeedback);
}

/** Open the form on whichever page is showing, and bring it into view. */
export function openFeedbackForm() {
    const page = document.querySelector('.page.active-page');
    const section = page?.querySelector(':scope > .page-feedback');
    if (!section) return false;
    if (!isCollecting()) {
        window.location.href = mailtoFor(page);
        return true;
    }
    if (section.dataset.state !== 'form') render(section, page, { form: true });
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return true;
}

/**
 * Add the box to the foot of every page — above the "content last reviewed"
 * line where a page has one, so that line stays the last thing on the page.
 */
export function initFeedback({ email, version }) {
    fallbackEmail = email;
    appVersion = version;
    document.querySelectorAll('#main-content .page').forEach(page => {
        const section = el('section', { class: 'page-feedback', 'aria-label': 'Feedback on this page' });
        const meta = page.querySelector(':scope > .review-meta');
        if (meta) page.insertBefore(section, meta);
        else page.append(section);
        render(section, page);
    });
}
