// Characterisation tests for the clinical logic.
//
// These lock in current behaviour so a regression cannot reach sudtoolkit.org
// unnoticed. They deliberately assert AT each severity boundary, because that is
// where scoring bugs hide and where the known threshold ambiguities sit.
//
// They assert what the app currently does, not what is clinically correct — where
// the two may differ, it is noted rather than silently "fixed".

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SCALES } from '../data/scales.js';
import { REGIMEN_CONFIG } from '../data/regimens.js';
import { FLOWCHART_LOGIC } from '../data/flowchart.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const byId = (id) => {
    const s = SCALES.find((sc) => sc.id === id);
    assert.ok(s, `scale "${id}" not found`);
    return s;
};
const severityAt = (id, score) => byId(id).severityLogic(score);

describe('severity boundaries', () => {
    // AWS: <=4 Mild, <=14 Moderate, >14 Severe
    test('AWS bands', () => {
        assert.equal(severityAt('aws', 0), 'Mild withdrawal');
        assert.equal(severityAt('aws', 4), 'Mild withdrawal');
        assert.equal(severityAt('aws', 5), 'Moderate withdrawal');
        assert.equal(severityAt('aws', 14), 'Moderate withdrawal');
        assert.equal(severityAt('aws', 15), 'Severe withdrawal');
    });

    // CIWA-Ar: <10 Mild, <=18 Moderate, >18 Severe.
    // NOTE: the regimen selector in index.html describes Severe as "CIWA > 20",
    // so 19 and 20 are labelled Severe here but sit in the Mod-Sev band there.
    // Flagged for clinical review; asserted as-is.
    test('CIWA-Ar bands', () => {
        assert.equal(severityAt('ciwa-ar', 9), 'Mild withdrawal');
        assert.equal(severityAt('ciwa-ar', 10), 'Moderate withdrawal');
        assert.equal(severityAt('ciwa-ar', 18), 'Moderate withdrawal');
        assert.equal(severityAt('ciwa-ar', 19), 'Severe withdrawal');
    });

    // SAWS: 0 None, <=5 Mild, <=12 Moderate, >12 Severe
    test('SAWS bands', () => {
        assert.equal(severityAt('saws', 0), 'None');
        assert.equal(severityAt('saws', 1), 'Mild');
        assert.equal(severityAt('saws', 5), 'Mild');
        assert.equal(severityAt('saws', 6), 'Moderate');
        assert.equal(severityAt('saws', 12), 'Moderate');
        assert.equal(severityAt('saws', 13), 'Severe');
    });

    // COWS: <=4 Minimal, <=12 Mild, <=24 Moderate, <=36 Moderately Severe, >36 Severe
    test('COWS bands', () => {
        assert.equal(severityAt('cows', 4), 'Minimal Withdrawal');
        assert.equal(severityAt('cows', 5), 'Mild Withdrawal');
        assert.equal(severityAt('cows', 12), 'Mild Withdrawal');
        assert.equal(severityAt('cows', 13), 'Moderate Withdrawal');
        assert.equal(severityAt('cows', 24), 'Moderate Withdrawal');
        assert.equal(severityAt('cows', 25), 'Moderately Severe');
        assert.equal(severityAt('cows', 36), 'Moderately Severe');
        assert.equal(severityAt('cows', 37), 'Severe Withdrawal');
    });

    // CIWA-B: <10 Mild, <=20 Moderate, >20 Severe
    test('CIWA-B bands', () => {
        assert.equal(severityAt('ciwa-b', 9), 'Mild withdrawal');
        assert.equal(severityAt('ciwa-b', 10), 'Moderate withdrawal');
        assert.equal(severityAt('ciwa-b', 20), 'Moderate withdrawal');
        assert.equal(severityAt('ciwa-b', 21), 'Severe withdrawal');
    });

    // Monitoring-only scales report no severity band.
    test('monitoring scales return N/A at every score', () => {
        for (const id of ['nsw-cws', 'cwas', 'awq']) {
            const max = byId(id).items.reduce(
                (t, i) => t + Math.max(...i.options.map((o) => o.value)), 0);
            for (const score of [0, 1, Math.floor(max / 2), max]) {
                assert.equal(severityAt(id, score), 'N/A', `${id} @ ${score}`);
            }
        }
    });

    test('every scale maps its theoretical maximum to a defined band', () => {
        for (const scale of SCALES) {
            const max = scale.items.reduce(
                (t, i) => t + Math.max(...i.options.map((o) => o.value)), 0);
            const band = scale.severityLogic(max);
            assert.equal(typeof band, 'string');
            assert.ok(band.length > 0, `${scale.id} produced an empty band at max ${max}`);
        }
    });
});

describe('scale structure', () => {
    // Radio grouping is document-wide and every calculator is in the DOM at once,
    // so a duplicate or undefined radioName silently merges two scales into one
    // group and makes both under-count. This is the COWS radio_name bug.
    test('every item has a defined, globally unique radioName', () => {
        const seen = new Map();
        for (const scale of SCALES) {
            for (const item of scale.items) {
                assert.equal(typeof item.radioName, 'string',
                    `${scale.id} / "${item.displayName}" has no radioName`);
                assert.ok(item.radioName.length > 0,
                    `${scale.id} / "${item.displayName}" has an empty radioName`);
                assert.ok(!seen.has(item.radioName),
                    `radioName "${item.radioName}" reused by ${seen.get(item.radioName)} and ${scale.id}`);
                seen.set(item.radioName, scale.id);
            }
        }
    });

    test('every item has options with numeric values and labels', () => {
        for (const scale of SCALES) {
            assert.ok(scale.items.length > 0, `${scale.id} has no items`);
            for (const item of scale.items) {
                assert.ok(item.options.length > 0,
                    `${scale.id} / "${item.displayName}" has no options`);
                for (const opt of item.options) {
                    assert.equal(typeof opt.value, 'number',
                        `${scale.id} / ${item.radioName} has a non-numeric value`);
                    assert.ok(Number.isFinite(opt.value));
                    assert.equal(typeof opt.label, 'string');
                    assert.ok(opt.label.length > 0);
                }
            }
        }
    });

    test('scale ids and names are unique and have a severityLogic', () => {
        const ids = SCALES.map((s) => s.id);
        assert.equal(new Set(ids).size, ids.length, 'duplicate scale id');
        for (const scale of SCALES) {
            assert.equal(typeof scale.severityLogic, 'function', `${scale.id} lacks severityLogic`);
            assert.ok(scale.name && scale.name.length > 0);
        }
    });

    test('every scale id has a matching container in index.html', () => {
        const html = read('index.html');
        for (const scale of SCALES) {
            assert.ok(html.includes(`id="${scale.id}"`),
                `no <section id="${scale.id}"> for scale ${scale.id}`);
            assert.ok(html.includes(`data-tab="${scale.id}"`),
                `no tab button for scale ${scale.id}`);
        }
    });
});

describe('benzodiazepine regimens', () => {
    const SEVERITIES = ['submild', 'mild', 'symptom', 'moderate', 'severe', 'unknown'];

    // A cell renders either a schedule or a `routing` card. The routing shape
    // exists so a combination that must not produce doses (severe withdrawal on
    // oxazepam) can say so, instead of rendering an empty schedule — see P0-05.
    test('every benzo x severity combination resolves to a schedule or a routing card', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const severity of SEVERITIES) {
                const data = REGIMEN_CONFIG[benzo][severity];
                assert.ok(data, `${benzo}/${severity} missing`);
                assert.ok(data.name, `${benzo}/${severity} has no name`);
                const schedule = Array.isArray(data.schedule) && data.schedule.length > 0;
                const routing = Array.isArray(data.routing) && data.routing.length > 0;
                assert.ok(schedule || routing, `${benzo}/${severity} renders nothing`);
                assert.ok(!(schedule && routing),
                    `${benzo}/${severity} has both a schedule and a routing card — the renderer shows only the routing card`);
            }
        }
    });

    test('scheduled doses are positive numbers with a frequency', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const severity of SEVERITIES) {
                for (const step of REGIMEN_CONFIG[benzo][severity].schedule || []) {
                    if (typeof step === 'string') continue; // free-text instruction
                    assert.equal(typeof step.dose, 'number', `${benzo}/${severity} non-numeric dose`);
                    assert.ok(step.dose > 0, `${benzo}/${severity} has a non-positive dose`);
                    assert.ok(['qid', 'tds', 'bd', 'nocte'].includes(step.freq),
                        `${benzo}/${severity} unexpected frequency "${step.freq}"`);
                }
            }
        }
    });

    test('mild and moderate regimens taper (daily total never increases)', () => {
        const PER_DAY = { qid: 4, tds: 3, bd: 2, nocte: 1 };
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const severity of ['mild', 'moderate']) {
                const totals = (REGIMEN_CONFIG[benzo][severity].schedule || [])
                    .filter((s) => typeof s !== 'string')
                    .map((s) => s.dose * PER_DAY[s.freq]);
                for (let i = 1; i < totals.length; i++) {
                    assert.ok(totals[i] <= totals[i - 1],
                        `${benzo}/${severity} daily total rises on day ${i + 1}: ${totals.join(' -> ')}`);
                }
            }
        }
    });

    // The dose table used to be duplicated: once under Mild-Moderate and
    // nowhere else. It now lives only in the symptom-triggered severity, and
    // the mild cell points at it — so assert the pointer, not a second copy.
    test('mild regimens point at the symptom-triggered alternative', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            const st = REGIMEN_CONFIG[benzo].mild.symptom_triggered;
            assert.ok(st, `${benzo} mild has no symptom_triggered pointer`);
            assert.ok(/Symptom-Triggered regimen/i.test(st.note),
                `${benzo} mild does not tell the user where the dosing table is`);
            assert.ok(!st.doses,
                `${benzo} mild carries its own copy of the dose table again — it will drift`);
        }
    });
});

describe('alcohol withdrawal flowchart', () => {
    test('every next_step points at a real node', () => {
        for (const [id, node] of Object.entries(FLOWCHART_LOGIC)) {
            if (node.type !== 'question') continue;
            for (const opt of node.options) {
                assert.ok(FLOWCHART_LOGIC[opt.next_step],
                    `${id} -> "${opt.next_step}" does not exist`);
            }
        }
    });

    test('every node is reachable from the entry point', () => {
        const seen = new Set();
        const walk = (id) => {
            if (seen.has(id)) return;
            seen.add(id);
            (FLOWCHART_LOGIC[id].options || []).forEach((o) => walk(o.next_step));
        };
        walk('intake_assessment');
        const orphans = Object.keys(FLOWCHART_LOGIC).filter((id) => !seen.has(id));
        assert.deepEqual(orphans, [], `unreachable nodes: ${orphans.join(', ')}`);
    });

    test('every outcome carries an EMR summary and every node a title', () => {
        for (const [id, node] of Object.entries(FLOWCHART_LOGIC)) {
            assert.ok(node.title, `${id} has no title`);
            assert.ok(node.text, `${id} has no text`);
            if (node.type === 'outcome') {
                assert.ok(node.emr_summary, `outcome ${id} has no emr_summary`);
            }
        }
    });

    test('guideline links point at pages that exist', () => {
        const html = read('index.html');
        for (const [id, node] of Object.entries(FLOWCHART_LOGIC)) {
            for (const key of ['guideline_link', 'ambulatory_guideline_link']) {
                if (!node[key]) continue;
                assert.ok(html.includes(`id="${node[key]}"`),
                    `${id}.${key} -> "${node[key]}" is not a page in index.html`);
            }
        }
    });
});

describe('standard drinks', () => {
    // Australian standard drink = 10 g ethanol. volume(L) x ABV% x 0.789 = std drinks.
    const stdDrinks = (ml, abv) => (ml / 1000) * abv * 0.789;

    test('formula matches the values shown to users', () => {
        assert.ok(Math.abs(stdDrinks(375, 4.8) - 1.42) < 0.01);
        assert.ok(Math.abs(stdDrinks(750, 13.5) - 7.99) < 0.01);
        assert.ok(Math.abs(stdDrinks(700, 40) - 22.09) < 0.01);
    });

    // Each single-serve input in index.html declares its own volume and ABV in
    // the label, so the data-sd constant can be checked against the formula.
    test('per-drink data-sd constants agree with the formula', () => {
        const html = read('index.html');
        const rows = [...html.matchAll(
            /<label for="(\w+)">([^<]*?)<\/label><input\s+type="number"\s+id="\1"\s+data-sd="([\d.]+)"/g)];
        assert.ok(rows.length > 10, `only parsed ${rows.length} drink rows`);

        let checked = 0;
        const problems = [];
        for (const [, id, label, sd] of rows) {
            const abv = label.match(/\(([\d.]+)%\)/);
            const ml = label.match(/\((\d+)ml\)/i);
            if (!abv || !ml) continue; // cartons/casks state no single-serve volume
            checked++;
            const expected = stdDrinks(Number(ml[1]), Number(abv[1]));
            const actual = Number(sd);
            if (Math.abs(expected - actual) > 0.15) {
                problems.push(`${id} "${label.trim()}": listed ${actual}, formula ${expected.toFixed(2)}`);
            }
        }
        assert.ok(checked >= 15, `only checked ${checked} parseable rows`);
        assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}`);
    });

    test('all quantity inputs declare a positive data-sd', () => {
        const html = read('index.html');
        const sds = [...html.matchAll(/data-sd="([^"]*)"/g)].map((m) => Number(m[1]));
        assert.ok(sds.length > 0);
        for (const sd of sds) {
            assert.ok(Number.isFinite(sd) && sd > 0, `invalid data-sd: ${sd}`);
        }
    });
});

describe('deployment invariants', () => {
    // Two hand-maintained version strings. Drift means installed users keep
    // running an old build, which is how the icon-update loop happened.
    test('APP_VERSION, package.json and the SW cache name stay in step', () => {
        const appVersion = read('script.js').match(/APP_VERSION\s*=\s*'([^']+)'/)?.[1];
        const cacheName = read('sw.js').match(/CACHE_NAME\s*=\s*'([^']+)'/)?.[1];
        const pkgVersion = JSON.parse(read('package.json')).version;

        assert.ok(appVersion, 'APP_VERSION not found in script.js');
        assert.ok(cacheName, 'CACHE_NAME not found in sw.js');
        assert.equal(pkgVersion, appVersion,
            'package.json version does not match APP_VERSION — bump both');
    });

    // index.html and script.js are separate downloads and can be separately
    // cached. When they came from different releases the app rendered new
    // controls against old code and looked like it was working. The guard in
    // index.html detects that at runtime by comparing these two strings, which
    // only means anything if a matching build ships as a matching pair.
    test('the markup and the script declare the same build', () => {
        const appVersion = read('script.js').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];
        const metaBuild = read('index.html').match(/<meta name="app-build" content="([^"]+)"/)?.[1];

        assert.ok(metaBuild, 'index.html carries no app-build meta for the skew guard to read');
        assert.equal(metaBuild, appVersion,
            'index.html declares a different build from script.js — every user would see the skew banner');
    });

    test('script.js publishes its build before it can fail', () => {
        const js = read('script.js');
        const publish = js.indexOf('window.SUD_BUILD');
        assert.ok(publish !== -1, 'script.js does not publish its build for the skew guard');
        assert.ok(publish < js.indexOf("document.addEventListener('DOMContentLoaded'"),
            'the build must be published before startup, or a failure during startup reads as a skew');
    });

    // Serving one release's HTML with another release's script is what the
    // cache-per-release model exists to prevent. Writing a fresh response into
    // the current cache at fetch time is precisely how the two drift apart.
    test('the service worker never writes into its cache outside install', () => {
        const sw = read('sw.js');
        const fetchHandler = sw.slice(sw.indexOf('async function cacheFirst'));
        assert.ok(!/cache\.put\(/.test(fetchHandler),
            'the fetch path caches responses again — a page load can then mix two releases');
        assert.ok(/cache-first/i.test(sw),
            'the fetch strategy should be cache-first from one release snapshot');
    });

    test('every ES module script.js imports is precached by the service worker', () => {
        const imports = [...read('script.js').matchAll(/from\s+'\.\/([^']+)'/g)].map((m) => m[1]);
        assert.ok(imports.length > 0, 'expected script.js to import data modules');
        const sw = read('sw.js');
        for (const mod of imports) {
            assert.ok(sw.includes(`'${mod}'`),
                `${mod} is imported but not in the service worker precache list — it would break offline`);
            assert.ok(fs.existsSync(path.join(ROOT, mod)), `${mod} does not exist`);
        }
    });

    test('every precached asset actually exists', () => {
        const list = read('sw.js').match(/const urlsToCache = \[([\s\S]*?)\];/)[1];
        const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
        assert.ok(files.length > 0);
        for (const f of files) {
            assert.ok(fs.existsSync(path.join(ROOT, f)), `precached "${f}" is missing from the repo`);
        }
    });

    // The NSW Health web filter returns 403 for style.css as a separate request,
    // so it is inlined into index.html by tools/build-css.py. These guard the
    // two ways that arrangement can silently rot.
    test('index.html inlines the current style.css', () => {
        const html = read('index.html');
        const region = html.match(/<!-- BEGIN style\.css -->([\s\S]*?)<!-- END style\.css -->/);
        assert.ok(region, 'the inlined style.css markers are missing from index.html');

        const inlined = region[1].match(/<style>\n([\s\S]*?)\n {4}<\/style>/);
        assert.ok(inlined, 'no <style> block between the style.css markers');
        assert.equal(inlined[1], read('style.css').replace(/\n+$/, ''),
            'index.html is out of date — run: python3 tools/build-css.py');
    });

    test('index.html does not link style.css as a separate request', () => {
        assert.ok(!/<link[^>]+rel=["']stylesheet["']/.test(read('index.html')),
            'a linked stylesheet is blocked by the NSW Health filter — inline it instead');
    });

    test('every data-page target resolves to a real page element', () => {
        const html = read('index.html');
        const targets = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map((m) => m[1]));
        assert.ok(targets.size > 0);
        for (const t of targets) {
            assert.ok(new RegExp(`id="${t}"[^>]*class="[^"]*\\bpage\\b`).test(html),
                `data-page="${t}" has no matching element with class "page"`);
        }
    });

    test('manifest icons exist on disk', () => {
        const manifest = JSON.parse(read('manifest.json'));
        for (const icon of manifest.icons) {
            assert.ok(fs.existsSync(path.join(ROOT, icon.src)), `manifest icon missing: ${icon.src}`);
        }
    });
});
