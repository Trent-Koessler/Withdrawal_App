// Search across every page of the app.
//
// There are more than twenty pages, most of them two or three taps from home,
// and at 3am "where was the GHB page" should be a word typed, not a menu
// remembered. The index is built from the rendered DOM rather than kept as a
// separate list, so a heading added to index.html is searchable in the same
// commit with nothing else to update — and nothing here can drift from what
// the page actually says.
//
// Search is navigation only. It never changes what a page says, and nothing
// typed into the box is recorded or leaves the device: the page_view that
// follows a tapped result is the same event a tapped menu button sends.

// Alternative words clinicians type for the same thing. Only names and
// abbreviations — never a clinical equivalence. A query word matches if it, or
// any word listed against it, appears in the entry.
export const SYNONYMS = {
    bupe: ['buprenorphine'],
    suboxone: ['buprenorphine'],
    subutex: ['buprenorphine'],
    buvidal: ['buprenorphine'],
    sublocade: ['buprenorphine'],
    etoh: ['alcohol'],
    dts: ['delirium'],
    oat: ['opioid treatment', 'otp'],
    otp: ['opioid treatment'],
    ice: ['methamphetamine', 'stimulant'],
    meth: ['methamphetamine', 'stimulant'],
    speed: ['amphetamine', 'stimulant'],
    cocaine: ['stimulant'],
    weed: ['cannabis'],
    thc: ['cannabis'],
    uds: ['urine drug screen'],
    lyrica: ['pregabalin'],
    smoking: ['nicotine'],
    vape: ['nicotine'],
    vaping: ['nicotine'],
    nrt: ['nicotine'],
    inhalants: ['volatile'],
    huffing: ['volatile'],
    gbl: ['ghb'],
    wernicke: ['thiamine'],
};

const MAX_RESULTS = 12;

/** Lower-case, strip accents, and turn punctuation into spaces. */
export function normalise(text) {
    return String(text ?? '')
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

function termsOf(query) {
    return normalise(query).split(' ').filter(Boolean);
}

// Every spelling that counts as a hit for one query word.
function variantsOf(term) {
    return [term, ...(SYNONYMS[term] || []).map(normalise)];
}

// Score one field for one term: 0 if absent, more if the term starts a word.
function fieldScore(field, variants, weight) {
    let best = 0;
    for (const v of variants) {
        const at = field.indexOf(v);
        if (at === -1) continue;
        const wordStart = at === 0 || field[at - 1] === ' ';
        best = Math.max(best, wordStart ? weight * 1.5 : weight);
    }
    return best;
}

/**
 * Rank index entries against a query.
 *
 * Every query word has to appear somewhere in the entry (title, heading or
 * body), so adding a word narrows the results rather than widening them. A
 * word found in a heading counts for far more than one found in body text, so
 * "cows" lands on the COWS calculator before a paragraph that mentions it.
 *
 * Entries are `{ heading, pageTitle, text }` plus whatever the caller needs to
 * navigate; the originals are returned, best first, with `matchedIn`
 * ('heading' or 'text') and a `snippet` when only the body matched.
 */
export function searchEntries(entries, query, limit = MAX_RESULTS) {
    const terms = termsOf(query);
    if (!terms.length) return [];

    const scored = [];
    for (const entry of entries) {
        const heading = normalise(entry.heading);
        const page = normalise(entry.pageTitle);
        const text = normalise(entry.text);

        let score = 0;
        let headingHits = 0;
        let matchedAll = true;
        for (const term of terms) {
            const variants = variantsOf(term);
            const h = fieldScore(heading, variants, 10);
            const p = fieldScore(page, variants, 4);
            const t = fieldScore(text, variants, 1);
            if (!h && !p && !t) {
                matchedAll = false;
                break;
            }
            if (h) headingHits++;
            score += Math.max(h, p, t);
        }
        if (!matchedAll) continue;

        // A heading that is exactly what was typed ("cows", "thiamine") is
        // almost certainly the thing being looked for.
        if (heading === terms.join(' ')) score += 20;
        // Whole pages before sections of them, all else being equal.
        if (entry.isPage) score += 0.5;

        scored.push({
            ...entry,
            score,
            matchedIn: headingHits ? 'heading' : 'text',
            snippet: headingHits ? '' : snippetFor(entry.text, terms),
        });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
}

/**
 * A short piece of body text around the first place a query word appears,
 * so a result found only in the text shows why it matched.
 */
export function snippetFor(text, terms, radius = 60) {
    const flat = String(text ?? '').replace(/\s+/g, ' ').trim();
    const lower = flat.toLowerCase();
    let at = -1;
    for (const term of terms) {
        for (const v of variantsOf(term)) {
            const i = lower.indexOf(v);
            if (i !== -1 && (at === -1 || i < at)) at = i;
        }
    }
    if (at === -1) {
        // Matched on the page title only: show how the section starts.
        return flat.length > radius * 2 ? flat.slice(0, radius * 2).trim() + '…' : flat;
    }
    const start = Math.max(0, at - radius);
    const end = Math.min(flat.length, at + radius);
    return (start > 0 ? '…' : '') + flat.slice(start, end).trim() + (end < flat.length ? '…' : '');
}

// ---- Building the index from the page ---------------------------------------

const HEADINGS = 'h2, h3, h4, h5';

// Sections whose headings are noise in search: the changelog is a list of
// version numbers, and every clinical word in it also lives on a real page.
const PAGE_ONLY = new Set(['changelog-page']);

/**
 * Pages a clinician can reach by tapping, starting from home and the header
 * menu. Anything else — a section parked behind .pending-publish — is left
 * out, so search does not become a back door to content that is not ready.
 */
export function reachablePages(root = document) {
    const seen = new Set(['home-page', 'about-page']);
    const queue = [...seen];
    while (queue.length) {
        const page = root.getElementById(queue.shift());
        if (!page) continue;
        page.querySelectorAll('[data-page]').forEach(btn => {
            if (btn.closest('.pending-publish')) return;
            const id = btn.dataset.page;
            if (!seen.has(id)) {
                seen.add(id);
                queue.push(id);
            }
        });
    }
    return seen;
}

// Text from just after a heading up to the next heading, in document order.
function sectionText(heading, page) {
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    walker.currentNode = heading;
    // Skip the heading's own text.
    let node = heading;
    while (node && heading.contains(node)) node = walker.nextNode();

    const parts = [];
    let length = 0;
    while (node && length < 4000) {
        if (node.nodeType === Node.ELEMENT_NODE && node.matches(HEADINGS)) break;
        if (node.nodeType === Node.TEXT_NODE && !node.parentElement.closest('script, style, button')) {
            parts.push(node.nodeValue);
            length += node.nodeValue.length;
        }
        node = walker.nextNode();
    }
    return parts.join(' ').replace(/\s+/g, ' ').trim();
}

// True when every word of the shorter heading appears in the longer one, so
// "GHB Withdrawal" and "GHB/GBL Withdrawal Syndrome" count as the same place.
function sameSubject(a, b) {
    const [short, long] = a.length <= b.length ? [a, b] : [b, a];
    const words = new Set(long.split(' '));
    return short.split(' ').every(w => words.has(w));
}

/**
 * Build the index from the current DOM. `titleFor(pageId)` supplies the same
 * page title the header shows.
 */
export function buildSearchIndex(titleFor, root = document) {
    const entries = [];
    const reachable = reachablePages(root);
    reachable.delete('home-page');

    for (const pageId of reachable) {
        const page = root.getElementById(pageId);
        if (!page || !page.classList.contains('page')) continue;
        const pageTitle = titleFor(pageId);

        const headings = [...page.querySelectorAll(HEADINGS)].filter(h =>
            h.textContent.trim() &&
            !h.closest('#calculator-template, .pending-publish, [hidden]'));

        const pageEntry = {
            pageId,
            pageTitle,
            heading: pageTitle,
            // A page with no headings (the flowchart, the substance list) is
            // found by what is on it.
            text: headings.length ? '' : page.textContent.replace(/\s+/g, ' ').trim().slice(0, 4000),
            target: null,
            isPage: true,
        };
        entries.push(pageEntry);

        if (PAGE_ONLY.has(pageId)) continue;

        const pageKey = normalise(pageTitle);
        headings.forEach((h, i) => {
            const heading = h.textContent.replace(/\s+/g, ' ').trim();
            const key = normalise(heading);
            // A page's opening heading usually repeats its title ("Opioid
            // Withdrawal" / "Opioid Withdrawal Syndrome"); fold it into the
            // page entry rather than listing the same place twice.
            if (i === 0 && sameSubject(key, pageKey)) {
                pageEntry.text = sectionText(h, page);
                return;
            }
            entries.push({
                pageId,
                pageTitle,
                heading,
                text: sectionText(h, page),
                target: h,
                isPage: false,
            });
        });
    }
    return entries;
}

/**
 * Make `el` visible: select every tab it sits inside, outermost first, so a
 * heading on the CIWA-Ar tab or the Regimens tab is actually on screen.
 */
export function revealElement(el) {
    const panels = [];
    for (let node = el.closest('.tab-content'); node; node = node.parentElement?.closest('.tab-content')) {
        panels.unshift(node);
    }
    for (const panel of panels) {
        const container = panel.parentElement?.closest('.tab-container');
        const button = container?.querySelector(
            `:scope > .tab-buttons > .tab-button[data-tab="${panel.id}"]`);
        if (button && !button.classList.contains('active')) button.click();
    }
    // A heading that opens its tab (a calculator's title, say) is shown with
    // the tab row above it still on screen, so the other tabs stay one tap away.
    const panel = panels[panels.length - 1];
    const opensPanel = panel && panel.querySelector(HEADINGS) === el;
    const strip = opensPanel && panel.parentElement.querySelector(':scope > .tab-buttons');
    (strip || el).scrollIntoView({ block: 'start' });

    // A brief highlight, so the eye lands on the right line of a long page.
    el.classList.remove('search-hit');
    void el.offsetWidth;
    el.classList.add('search-hit');
    setTimeout(() => el.classList.remove('search-hit'), 2000);
}
