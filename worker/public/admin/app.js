// Admin page for sudtoolkit.org feedback and usage.
//
// Rule for this file: text from the database is only ever written with
// textContent (through el() below), never as HTML. Feedback messages are typed
// by anyone who can open the app, and this page is the one place they are
// displayed with the author's password in memory. The page's
// Content-Security-Policy blocks inline scripts as a second line of defence.

'use strict';

(function () {
    const TOKEN_KEY = 'sud.admin.token';

    const CATEGORY_LABELS = { error: 'Error', unclear: 'Unclear', suggestion: 'Suggestion', praise: 'Praise' };
    const STATUS_LABELS = { new: 'New', actioned: 'Actioned', wontfix: "Won't fix" };
    const DAY_LABELS = { 7: 'Last 7 days', 30: 'Last 30 days', 90: 'Last 90 days', 365: 'Last 12 months', 0: 'All time' };
    const CHANGED_LABELS = { yes: 'Yes', no: 'No', unsure: 'Not sure' };

    // The ten System Usability Scale items, in order, as the app asks them.
    // Kept in step with SUS_ITEMS in survey.js by a test.
    const SUS_ITEMS = [
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

    // Page ids are what the app records; these make the common ones readable.
    // The same list as PAGE_NAMES in worker/src/labels.js (a test checks).
    const PAGE_NAMES = {
        'home': 'Home', 'scales': 'Scales', 'alcohol-withdrawal': 'Triage flowchart',
        'inpatient-guidelines': 'Inpatient guidelines', 'ambulatory-guidelines': 'Ambulatory guidelines',
        'ciwa-ar': 'CIWA-Ar', 'ciwa-b': 'CIWA-B', 'aws': 'AWS', 'saws': 'SAWS', 'cows': 'COWS',
        'nsw-cws': 'CWS', 'cwas': 'CWAS', 'awq': 'AWQ', 'rass': 'RASS', 'std-drinks': 'Standard drinks',
        'otp': 'OTP', 'otp-transfers': 'OTP transfers', 'bbv-sti': 'BBV/STI',
    };

    const state = {
        token: readToken(),
        view: 'feedback',
        days: 30,
        role: '',
        location: '',
        status: 'new',
        category: '',
        page: '',
        labels: { roles: {}, locations: {} },
        newCount: null,
    };

    const root = document.getElementById('root');

    // --- helpers --------------------------------------------------------

    function el(tag, attrs, ...children) {
        const node = document.createElement(tag);
        for (const [key, value] of Object.entries(attrs || {})) {
            if (value === null || value === undefined || value === false) continue;
            if (key === 'class') node.className = value;
            else if (key === 'onclick' || key === 'onchange' || key === 'onsubmit') node.addEventListener(key.slice(2), value);
            else if (key === 'width') node.style.width = value;
            else if (key === 'height') node.style.height = value;
            else node.setAttribute(key, value === true ? '' : String(value));
        }
        for (const child of children.flat()) {
            if (child === null || child === undefined || child === false) continue;
            node.append(child instanceof Node ? child : document.createTextNode(String(child)));
        }
        return node;
    }

    function readToken() {
        try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
    }

    function writeToken(value) {
        try {
            if (value) sessionStorage.setItem(TOKEN_KEY, value);
            else sessionStorage.removeItem(TOKEN_KEY);
        } catch { /* private mode: stays in memory for this tab */ }
    }

    function query(extra) {
        const p = new URLSearchParams();
        p.set('days', String(state.days));
        if (state.role) p.set('role', state.role);
        if (state.location) p.set('location', state.location);
        for (const [k, v] of Object.entries(extra || {})) if (v) p.set(k, v);
        return p.toString();
    }

    async function api(path, options) {
        const response = await fetch('/admin/api/' + path, {
            ...options,
            headers: { Authorization: 'Bearer ' + state.token, 'Content-Type': 'application/json' },
        });
        if (response.status === 401) {
            logout('That password was not accepted.');
            throw new Error('unauthorized');
        }
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response;
    }

    const getJson = async path => (await api(path)).json();

    function roleName(id) { return state.labels.roles[id] || id; }
    function locationName(id) { return state.labels.locations[id] || id; }

    function pageName(key) {
        if (!key) return '—';
        return key.split('/').map(part => {
            const id = part.replace(/-page$/, '');
            if (PAGE_NAMES[id]) return PAGE_NAMES[id];
            const words = id.replace(/-/g, ' ');
            return words.charAt(0).toUpperCase() + words.slice(1);
        }).join(' › ');
    }

    function when(iso) {
        if (!iso) return ['', ''];
        const d = new Date(iso);
        return [
            d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }),
            d.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
        ];
    }

    function pct(part, whole) {
        return whole ? Math.round((100 * part) / whole) : 0;
    }

    function susGrade(score) {
        if (score === null || score === undefined) return '';
        if (score > 80.3) return 'Excellent';
        if (score >= 68) return 'Good';
        if (score >= 51) return 'Below average';
        return 'Poor';
    }

    function fmt(n, digits = 0) {
        return n === null || n === undefined ? '—' : Number(n).toFixed(digits);
    }

    // --- login ----------------------------------------------------------

    function renderLogin(message) {
        const input = el('input', { type: 'password', id: 'pw', autocomplete: 'current-password', 'aria-label': 'Password' });
        const form = el('form', {
            class: 'login',
            onsubmit: async event => {
                event.preventDefault();
                state.token = input.value.trim();
                if (!state.token) return;
                try {
                    await loadLabels();
                    writeToken(state.token);
                    render();
                } catch { /* api() already showed the login again */ }
            },
        },
        el('h1', null, 'SUD Toolkit admin'),
        el('p', null, 'Enter the admin password (the EXPORT_TOKEN secret).'),
        message ? el('div', { class: 'error', role: 'alert' }, message) : null,
        input,
        el('button', { class: 'primary', type: 'submit' }, 'Sign in'));
        root.replaceChildren(form);
        input.focus();
    }

    function logout(message) {
        state.token = '';
        writeToken('');
        renderLogin(message);
    }

    async function loadLabels() {
        state.labels = await getJson('labels');
    }

    // --- layout ---------------------------------------------------------

    const VIEWS = [
        ['feedback', 'Feedback'],
        ['overview', 'Overview'],
        ['survey', 'Survey'],
        ['errors', 'Errors'],
    ];

    function header() {
        return el('header', null,
            el('h1', null, 'SUD Toolkit · Admin'),
            el('nav', { 'aria-label': 'Sections' },
                VIEWS.map(([id, label]) => el('button', {
                    'aria-current': state.view === id ? 'page' : null,
                    onclick: () => { state.view = id; render(); },
                }, label, id === 'feedback' && state.newCount
                    ? el('span', { class: 'badge' }, `${state.newCount} new`) : null))),
            el('button', { class: 'logout', onclick: () => logout() }, 'Log out'));
    }

    function select(label, value, options, onchange) {
        return el('label', null, label,
            el('select', { onchange: e => onchange(e.target.value) },
                options.map(([v, text]) => el('option', { value: v, selected: String(v) === String(value) }, text))));
    }

    function filterBar(extra) {
        const roles = [['', 'All roles'], ...Object.entries(state.labels.roles)];
        const locations = [['', 'All settings'], ...Object.entries(state.labels.locations)];
        const exportName = { feedback: 'feedback', overview: 'events', survey: 'survey', errors: 'errors' }[state.view];
        return el('div', { class: 'bar' },
            select('Dates', state.days, [7, 30, 90, 365, 0].map(d => [d, DAY_LABELS[d]]),
                v => { state.days = Number(v); render(); }),
            select('Role', state.role, roles, v => { state.role = v; render(); }),
            select('Setting', state.location, locations, v => { state.location = v; render(); }),
            extra,
            el('button', { class: 'primary', onclick: () => download(exportName) }, '⬇ Download CSV'));
    }

    async function download(name) {
        const extra = name === 'feedback'
            ? { status: state.status, category: state.category, page: state.page } : {};
        const response = await api(`export/${name}.csv?${query(extra)}`);
        const blob = await response.blob();
        const disposition = response.headers.get('content-disposition') || '';
        const filename = (disposition.match(/filename="([^"]+)"/) || [])[1] || `${name}.csv`;
        const link = el('a', { href: URL.createObjectURL(blob), download: filename });
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }

    async function render() {
        if (!state.token) return renderLogin();
        const body = el('main', null, el('div', { class: 'loading' }, 'Loading…'));
        root.replaceChildren(header(), body);
        try {
            const view = await ({
                feedback: feedbackView, overview: overviewView, survey: surveyView, errors: errorsView,
            })[state.view]();
            body.replaceChildren(...view);
            // The badge reflects the latest count from whichever view loaded it.
            root.replaceChild(header(), root.firstChild);
        } catch (err) {
            if (err.message !== 'unauthorized') {
                body.replaceChildren(el('div', { class: 'empty' }, 'Could not load this view: ' + err.message));
            }
        }
    }

    // --- feedback -------------------------------------------------------

    async function feedbackView() {
        const data = await getJson('feedback?' + query({ status: state.status, category: state.category, page: state.page }));
        state.newCount = data.newCount;

        const bar = filterBar([
            select('Status', state.status, [['', 'Any status'], ...Object.entries(STATUS_LABELS)],
                v => { state.status = v; render(); }),
            select('Type', state.category, [['', 'Any type'], ...Object.entries(CATEGORY_LABELS)],
                v => { state.category = v; render(); }),
            select('Page', state.page, [['', 'Any page'], ...data.pages.map(p => [p, pageName(p)])],
                v => { state.page = v; render(); }),
        ]);

        if (data.items.length === 0) {
            return [bar, el('div', { class: 'empty' }, 'No feedback matches these filters.')];
        }

        const rows = data.items.map(item => {
            const [date, time] = when(item.occurred_at);
            const statusCell = el('div', { class: 'status', role: 'group', 'aria-label': 'Status' });
            const paint = current => statusCell.replaceChildren(...Object.entries(STATUS_LABELS).map(([s, label]) =>
                el('button', {
                    'aria-pressed': current === s ? 'true' : 'false',
                    onclick: async () => {
                        await api('feedback/status', { method: 'POST', body: JSON.stringify({ id: item.id, status: s }) });
                        if (item.status === 'new' && s !== 'new') state.newCount = Math.max(0, state.newCount - 1);
                        if (item.status !== 'new' && s === 'new') state.newCount += 1;
                        item.status = s;
                        paint(s);
                        root.replaceChild(header(), root.firstChild);
                    },
                }, label)));
            paint(item.status);

            return el('tr', null,
                el('td', null, date, el('small', null, time)),
                el('td', null, pageName(item.page),
                    item.helpful ? el('small', null, item.helpful === 'yes' ? 'Rated 👍' : 'Rated 👎') : null),
                el('td', null, el('span', { class: `cat cat-${item.category}` }, CATEGORY_LABELS[item.category] || item.category)),
                el('td', null, roleName(item.role), el('small', null, locationName(item.location))),
                el('td', { class: 'msg' }, item.message, el('small', null, 'v' + item.app_version)),
                el('td', null, statusCell));
        });

        return [
            bar,
            el('div', { class: 'table-wrap' }, el('table', null,
                el('thead', null, el('tr', null, ['Sent', 'Page', 'Type', 'Who / where', 'Message', 'Status'].map(h => el('th', null, h)))),
                el('tbody', null, rows))),
            el('p', { class: 'note' }, `Showing ${data.items.length} item${data.items.length === 1 ? '' : 's'}. `
                + 'Download CSV exports everything matching these filters, including the status column.'),
        ];
    }

    // --- overview -------------------------------------------------------

    function tile(key, value, sub, tag) {
        return el('div', { class: 'tile' },
            el('div', { class: 'k' }, key),
            el('div', { class: 'v' }, value, tag ? el('span', { class: 'tag' }, tag) : null),
            el('div', { class: 's' }, sub));
    }

    function bars(rows, { label, value, display, max }) {
        const top = max ?? Math.max(1, ...rows.map(value));
        return rows.map(r => el('div', { class: 'hb', title: `${label(r)}: ${display(r)}` },
            el('span', null, label(r)),
            el('span', { class: 't' }, el('i', { width: `${(100 * value(r)) / top}%` })),
            el('span', { class: 'n' }, display(r))));
    }

    function panel(title, sub, ...content) {
        const body = content.flat();
        return el('div', { class: 'panel' },
            el('h2', null, title),
            el('div', { class: 'sub' }, sub),
            body.length ? body : el('div', { class: 'note' }, 'Nothing recorded yet.'));
    }

    async function overviewView() {
        const d = await getJson('overview?' + query());
        state.newCount = d.feedbackNew;
        const rated = d.ratings.yes + d.ratings.no;
        const weeklyMax = Math.max(1, ...d.weekly.map(w => w.n));

        return [
            filterBar(),
            el('div', { class: 'tiles' },
                tile('Sessions', d.sessions.toLocaleString(), `across ${d.devices} device${d.devices === 1 ? '' : 's'}`),
                tile('Returning devices', `${pct(d.returning, d.devices)}%`, 'used it in 2 or more separate weeks'),
                tile('Pages rated helpful', rated ? `${pct(d.ratings.yes, rated)}%` : '—', `👍 ${d.ratings.yes} · 👎 ${d.ratings.no}`),
                tile('Usability score (SUS)', fmt(d.survey.avg), `from ${d.survey.n} survey${d.survey.n === 1 ? '' : 's'} · published average is 68`,
                    susGrade(d.survey.avg))),
            el('div', { class: 'grid' },
                panel('Helpfulness by page', '% of 👍 ratings · pages with the most ratings first',
                    bars(d.byPage, {
                        label: r => pageName(r.page), value: r => pct(r.yes, r.yes + r.no), max: 100,
                        display: r => `${pct(r.yes, r.yes + r.no)}% · ${r.yes + r.no}`,
                    })),
                panel('Sessions per week', 'app launches after the sign-in screen',
                    d.weekly.length ? [
                        el('div', { class: 'cols' }, d.weekly.map(w =>
                            el('i', { height: `${(100 * w.n) / weeklyMax}%`, title: `Week of ${w.start}: ${w.n} sessions` }))),
                        el('div', { class: 'cols-axis' }, el('span', null, d.weekly[0].start),
                            el('span', null, `peak ${weeklyMax}`), el('span', null, d.weekly[d.weekly.length - 1].start)),
                    ] : []),
                panel('Use by role', 'sessions', bars(d.byRole, { label: r => roleName(r.label), value: r => r.n, display: r => r.n })),
                panel('Use by setting', 'sessions', bars(d.byLocation, { label: r => locationName(r.label), value: r => r.n, display: r => r.n })),
                panel('Most viewed pages', 'page views', bars(d.topPages, { label: r => pageName(r.label), value: r => r.n, display: r => r.n })),
                panel('Scales completed', 'a patient scored on a scale', bars(d.topScales, { label: r => pageName(r.label), value: r => r.n, display: r => r.n })),
                panel('Recent errors', 'app problems logged automatically — see the Errors tab',
                    d.errors.map(e => el('div', { class: 'err-row' },
                        el('div', null, e.message, el('small', null, `${pageName(e.page)} · v${e.version}`)),
                        el('span', { class: 'n' }, `×${e.n}`))))),
        ];
    }

    // --- survey ---------------------------------------------------------

    async function surveyView() {
        const s = await getJson('survey?' + query());
        const answered = s.changed.filter(c => c.label).reduce((sum, c) => sum + c.n, 0);
        const yes = (s.changed.find(c => c.label === 'yes') || { n: 0 }).n;

        return [
            filterBar(),
            el('div', { class: 'tiles' },
                tile('Responses', s.n, 'completed surveys'),
                tile('Usability score (SUS)', fmt(s.avg), 'out of 100 · published average is 68', susGrade(s.avg)),
                tile('Changed management', answered ? `${pct(yes, answered)}%` : '—',
                    `said Yes, of ${answered} who answered`)),
            el('div', { class: 'grid' },
                panel('Average answer by question', '1 = strongly disagree, 5 = strongly agree. Even-numbered items are worded negatively, so lower is better for them.',
                    s.n ? SUS_ITEMS.map((text, i) => el('div', { class: 'hb', title: text },
                        el('span', null, `${i + 1}. ${text}`),
                        el('span', { class: 't' }, el('i', { width: `${((s.perQuestion[i] || 0) / 5) * 100}%` })),
                        el('span', { class: 'n' }, fmt(s.perQuestion[i], 1)))) : []),
                panel('Score by role', 'average SUS', bars(s.byRole, {
                    label: r => roleName(r.label), value: r => r.avg, max: 100, display: r => `${fmt(r.avg)} · n=${r.n}`,
                })),
                panel('Score by month', 'average SUS', bars(s.byMonth, {
                    label: r => r.month, value: r => r.avg, max: 100, display: r => `${fmt(r.avg)} · n=${r.n}`,
                })),
                panel('Has the app changed how you managed a patient?', 'all responses', bars(s.changed, {
                    label: r => CHANGED_LABELS[r.label] || 'Not answered', value: r => r.n, display: r => r.n,
                }))),
        ];
    }

    // --- errors ---------------------------------------------------------

    async function errorsView() {
        const { groups } = await getJson('errors?' + query());
        if (groups.length === 0) return [filterBar(), el('div', { class: 'empty' }, 'No app errors in this period.')];
        return [
            filterBar(),
            el('div', { class: 'table-wrap' }, el('table', null,
                el('thead', null, el('tr', null, ['Last seen', 'Error', 'Page', 'Where in the code', 'Versions', 'Devices', 'Count'].map(h => el('th', null, h)))),
                el('tbody', null, groups.map(g => {
                    const [date, time] = when(g.last_seen);
                    return el('tr', null,
                        el('td', null, date, el('small', null, time)),
                        el('td', { class: 'msg' }, g.message),
                        el('td', null, pageName(g.page)),
                        el('td', null, g.source || '—'),
                        el('td', null, g.versions, el('small', null, g.platforms)),
                        el('td', { class: 'num' }, g.devices),
                        el('td', { class: 'num' }, g.n));
                })))),
            el('p', { class: 'note' }, 'Grouped by message and place. Numbers and email addresses in messages are masked on the device before sending.'),
        ];
    }

    // --- start ----------------------------------------------------------

    if (state.token) {
        loadLabels().then(render).catch(() => { /* api() handles a bad token */ });
    } else {
        renderLogin();
    }
})();
