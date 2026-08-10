// Safety invariants for the alcohol inpatient regimens.
//
// Unlike test/clinical.test.js — which characterises what the app currently
// does — these assert what it must never do. Each one corresponds to a defect
// found in the August 2022 NSW Clinical Guidance review and must keep failing
// if that defect is reintroduced.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { REGIMEN_CONFIG } from '../data/regimens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Flatten every string a severity renders, so a rule can be asserted against
// the whole cell regardless of which field the text sits in.
const textOf = (cell) => [
    cell.title,
    ...(cell.schedule || []),
    ...(cell.prn || []),
    ...(cell.routing || []),
    ...(cell.setting || []),
].filter((s) => typeof s === 'string').join('\n');

// Loading is a diazepam concept in NSWCG. The oxazepam severe cell is not
// asserted here because P0-05 removes it entirely rather than correcting it;
// the guard that no oxazepam loading regimen exists lives with that task.
describe('P0-01 — a loading day is not followed by a second full day', () => {
    const LOADING_BENZOS = ['Diazepam'];

    test('the severe cell never hands over to the Mod-Sev schedule at Day 1', () => {
        for (const benzo of LOADING_BENZOS) {
            const text = textOf(REGIMEN_CONFIG[benzo].severe);
            assert.ok(!/Then commence Moderate-Severe schedule/i.test(text),
                `${benzo}: severe still hands over to the Mod-Sev schedule without naming a start day, which stacks a second 80mg day behind the load`);
        }
    });

    test('any handover to a fixed schedule names Day 2 as its start', () => {
        for (const benzo of LOADING_BENZOS) {
            const text = textOf(REGIMEN_CONFIG[benzo].severe);
            if (!/Moderate-Severe schedule/i.test(text)) continue; // e.g. a routing card
            assert.ok(/Day 2 row/i.test(text),
                `${benzo}: severe offers the Mod-Sev schedule but does not start it at the Day 2 row`);
        }
    });

    test('the severe cell states that the loading day is Day 1', () => {
        for (const benzo of LOADING_BENZOS) {
            const cell = REGIMEN_CONFIG[benzo].severe;
            if (cell.routing) continue; // no regimen is offered at all
            assert.ok(/loading day is Day 1/i.test(textOf(cell)),
                `${benzo}: severe does not make clear that the loading day IS Day 1`);
        }
    });
});

describe('P0-02 — no fixed time gate on the inpatient pathway', () => {
    const html = read('index.html');
    // Everything from the inpatient guidelines page up to the ambulatory one.
    const inpatient = html.slice(
        html.indexOf('id="inpatient-guidelines-page"'),
        html.indexOf('id="ambulatory-guidelines-page"'));

    test('nothing tells the user to withhold scoring or treatment for N hours', () => {
        const gate = /(do not|don't|never)[^.]{0,80}(until|before)[^.]{0,40}\d+\+?\s*hours?/i;
        assert.ok(!gate.test(inpatient.replace(/\s+/g, ' ')),
            'the inpatient pathway still gates scoring or dosing on time since the last drink; NSWCG §5.1 notes withdrawal may begin before the BAL reaches zero');
    });

    test('the rising-score/falling-BAL rule is stated instead', () => {
        assert.ok(/rising score with a falling BAL/i.test(inpatient),
            'the interpretation caveat that replaced the time gate is missing');
    });

    test('the Severe band stays reachable — CIWA-Ar is never blocked from starting', () => {
        assert.ok(!/Do not start CIWA-Ar/i.test(html),
            'the Severe band is defined by CIWA > 20 and is unreachable if CIWA-Ar cannot be commenced');
    });
});

describe('P0-03 — the ambulatory rule is stricter and self-consistent', () => {
    const html = read('index.html');
    const ambulatory = html.slice(
        html.indexOf('id="ambulatory-guidelines-page"'),
        html.indexOf('id="scales-page"'));

    test('initiation states the 8-hour contraindication', () => {
        assert.ok(/past 8 hours/.test(ambulatory) && /contraindication to commencing/i.test(ambulatory),
            'the NSWCG App 6 initiation rule is missing from the ambulatory pathway');
    });

    test('no stray 6-hour window survives on the ambulatory pathway', () => {
        assert.ok(!/6\+?\s*hours/i.test(ambulatory),
            'a 6-hour window is left on the ambulatory pathway — it belongs to neither pathway now');
    });

    test('the two pathways state different rules on purpose', () => {
        assert.ok(/stricter than the inpatient pathway/i.test(ambulatory),
            'the ambulatory/inpatient divergence should be explicit, or it reads as an inconsistency');
    });
});

describe('P0-04 — escalation and de-escalation criteria exist', () => {
    const html = read('index.html');
    const regimens = html.slice(html.indexOf('<div id="regimens"'),
        html.indexOf('<div id="special-cases"'));

    test('the escalation block sits above the rendered regimen, not inside one severity', () => {
        const box = regimens.indexOf('class="escalation-box"');
        const display = regimens.indexOf('id="regimen-display"');
        assert.ok(box !== -1, 'no escalation block on the regimens tab');
        assert.ok(box < display,
            'the escalation block must precede #regimen-display so it renders under every severity');
    });

    test('all four escalation triggers are present', () => {
        for (const trigger of [
            /[Bb]oth daily PRN doses/,          // the gap the spec called out
            /[Tt]wo consecutive CIWA-Ar \(or AWS\) scores/,
            /rising on days 3-4/,
            /80mg in 24 hours/,
        ]) {
            assert.ok(trigger.test(regimens), `escalation trigger missing: ${trigger}`);
        }
    });

    test('the sedation withhold rule is retained, not replaced', () => {
        const flat = regimens.replace(/\s+/g, ' ');
        assert.ok(/do not give regular or PRN doses if the patient is sedated/i.test(flat),
            'the pre-existing sedation caveat was dropped');
        assert.ok(/multiple doses are withheld, the schedule is too high/i.test(flat),
            'the converse of the sedation rule is missing');
    });
});

describe('P0-05 — oxazepam is never loaded and never routed by conversion alone', () => {
    // A routing card may (and does) explain why loading is not used, so the rule
    // is about what is presented as a dose to give, i.e. the schedule and PRN.
    test('no oxazepam dosing instruction anywhere describes loading', () => {
        for (const [severity, cell] of Object.entries(REGIMEN_CONFIG.Oxazepam)) {
            if (!cell || typeof cell !== 'object') continue;
            const dosing = [...(cell.schedule || []), ...(cell.prn || [])]
                .filter((s) => typeof s === 'string').join('\n');
            assert.ok(!/loading|load\b/i.test(dosing),
                `Oxazepam/${severity} gives a loading instruction; loading is a diazepam concept in NSWCG §5.4.4 and the oxazepam population is the one §5.6.3 excludes from it`);
        }
    });

    test('severe + oxazepam routes to specialist advice instead of a schedule', () => {
        const cell = REGIMEN_CONFIG.Oxazepam.severe;
        assert.ok(cell.routing, 'severe + oxazepam still renders a dose schedule');
        assert.ok(!cell.schedule, 'severe + oxazepam must not carry a schedule at all');
        const text = textOf(cell);
        assert.ok(/15-30mg/.test(text), 'the titration range NSWCG §5.6.3 gives is missing');
        assert.ok(/HDU/.test(text), 'the HDU / escalation options are missing');
        assert.ok(/DASAS|addiction/i.test(text), 'no specialist contact is offered');
    });

    const CONVERSION = /approximate/i;

    test('every oxazepam cell that renders doses carries the conversion caveat', () => {
        for (const [severity, cell] of Object.entries(REGIMEN_CONFIG.Oxazepam)) {
            if (!cell || typeof cell !== 'object' || !cell.schedule) continue;
            const caveats = (cell.caveat || []).join('\n');
            assert.ok(CONVERSION.test(caveats),
                `Oxazepam/${severity} shows doses with no conversion caveat`);
            assert.ok(/slower step-down/i.test(caveats) && /titrated against response/i.test(caveats),
                `Oxazepam/${severity} caveat does not state that dosing is more frequent with a slower taper and must be titrated`);
        }
    });

    test('diazepam cells never carry a conversion caveat they do not need', () => {
        for (const [severity, cell] of Object.entries(REGIMEN_CONFIG.Diazepam)) {
            if (!cell || typeof cell !== 'object') continue;
            assert.ok(!CONVERSION.test((cell.caveat || []).join('\n')),
                `Diazepam/${severity} carries a conversion caveat; it is not a converted schedule`);
        }
    });
});

describe('P0-06 — DASAS is reachable from Sydney metro too', () => {
    const sources = ['index.html', 'data/regimens.js'];

    test('every mention of the regional DASAS number offers the metro number', () => {
        for (const file of sources) {
            const text = read(file).replace(/\s+/g, ' ');
            // Count blocks mentioning the 1800 number and check each has the metro
            // number nearby, so a new inline mention cannot ship with only one.
            const mentions = [...text.matchAll(/1800\s?023\s?687/g)];
            for (const m of mentions) {
                const window = text.slice(Math.max(0, m.index - 400), m.index + 400);
                assert.ok(/\(?02\)?\s?8382\s?1006|0283821006/.test(window),
                    `${file}: a DASAS mention near offset ${m.index} gives only the regional number`);
            }
        }
    });

    test('both numbers are tel: links wherever they appear', () => {
        for (const file of sources) {
            const text = read(file);
            if (!/1800\s?023\s?687/.test(text)) continue;
            assert.ok(text.includes('tel:1800023687'), `${file}: regional DASAS number is not a tel: link`);
            assert.ok(text.includes('tel:0283821006'), `${file}: metro DASAS number is not a tel: link`);
        }
    });

    test('the contacts directory distinguishes the two catchments', () => {
        const html = read('index.html').replace(/\s+/g, ' ');
        assert.ok(/1800 023 687<\/a> — regional, rural and remote NSW/.test(html)
            || /regional, rural and remote NSW/.test(html), 'catchments not labelled');
        assert.ok(/Sydney metropolitan/.test(html), 'the metro catchment is not named');
    });
});

describe('P0-07 — thiamine route', () => {
    const html = read('index.html');
    const thiamine = html.slice(html.indexOf('<div id="thiamine"'),
        html.indexOf('<div id="benzo-choice"'));

    test('IM is no longer offered as freely interchangeable with IV', () => {
        assert.ok(!/IV\/IM|IM\/IV/.test(thiamine),
            'thiamine still lists IV/IM as one interchangeable route');
    });

    test('the coagulopathy caveat is stated', () => {
        assert.ok(/thrombocytopenia/i.test(thiamine) && /coagulopathy/i.test(thiamine),
            'the reason IM may be unsafe is not given');
        assert.ok(/prefer(?:s|ring)? the IV route|prefer IV/i.test(thiamine),
            'no preference for the IV route is stated');
    });
});

describe('P0-08 — the 80 mg statement is a ladder, not a ceiling', () => {
    test('both thresholds are surfaced in the Severe cell itself', () => {
        const text = textOf(REGIMEN_CONFIG.Diazepam.severe);
        assert.ok(/80mg in 24 hours/.test(text), 'the 80 mg review threshold is not in the Severe cell');
        assert.ok(/120mg in 24 hours/.test(text),
            'the 120 mg maximum is not in the Severe cell — it must not live only in general notes');
    });

    test('80 mg is presented as a review threshold rather than a ceiling', () => {
        const text = textOf(REGIMEN_CONFIG.Diazepam.severe);
        assert.ok(/review threshold, not a ceiling/i.test(text),
            'the Severe cell does not say 80 mg is a review point rather than a limit');
        assert.ok(/10-20mg 2-hourly PRN/.test(text),
            'the second rung of the ladder (10-20 mg 2-hourly PRN) is missing');
    });

    test('the general notes carry the same ladder, not the old ceiling wording', () => {
        const html = read('index.html');
        const special = html.slice(html.indexOf('<div id="special-cases"'),
            html.indexOf('id="ambulatory-guidelines-page"'));
        assert.ok(!/exceeds 80mg, contact specialist/i.test(special.replace(/\s+/g, ' ')),
            'the general notes still read as a hard ceiling at 80 mg');
        assert.ok(/maximum of 120mg in 24 hours/.test(special.replace(/\s+/g, ' ')),
            'the general notes do not reach the 120 mg rung');
    });
});

describe('P1-01 — symptom-triggered dosing is offered as its own regimen', () => {
    test('both benzodiazepines have a symptom-triggered cell', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            const cell = REGIMEN_CONFIG[benzo].symptom;
            assert.ok(cell, `${benzo} has no symptom-triggered regimen`);
            assert.ok(cell.table, `${benzo} symptom-triggered has no dose table`);
        }
    });

    test('the table carries the NSWCG bands, doses and monitoring frequencies', () => {
        const { table } = REGIMEN_CONFIG.Diazepam.symptom;
        assert.deepEqual(table.headers, ['CIWA-Ar', 'AWS', 'Dose', 'Monitoring']);
        assert.deepEqual(table.rows.map((r) => r[2]),
            ['0-5mg diazepam', '10mg diazepam', '20mg diazepam']);
        assert.deepEqual(table.rows.map((r) => r[3]),
            ['4-6 hourly', '2-4 hourly', 'hourly']);
    });

    test('the 80 mg medical review threshold is stated', () => {
        assert.ok(/exceeds 80mg in 24 hours/.test(textOf(REGIMEN_CONFIG.Diazepam.symptom)),
            'symptom-triggered dosing must state the 80 mg medical review point');
    });

    test('NSWCG framing and the hybrid alternative are both given', () => {
        const cell = REGIMEN_CONFIG.Diazepam.symptom;
        assert.ok(/uncomplicated withdrawal/i.test(cell.caveat), 'the framing for when to use it is missing');
        assert.ok(/hybrid/i.test(cell.caveat), 'the hybrid option for complex inpatients is missing');
    });

    test('the regimens tab exposes it as a selectable severity', () => {
        assert.ok(/data-severity="symptom"/.test(read('index.html')),
            'no button selects the symptom-triggered regimen');
    });
});

describe('P1-02 — no band is expressed in CIWA-Ar only', () => {
    test('every severity title gives both scales', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const [severity, cell] of Object.entries(REGIMEN_CONFIG[benzo])) {
                if (!cell || typeof cell !== 'object' || !cell.title) continue;
                if (!/CIWA/i.test(cell.title)) continue;
                assert.ok(/AWS/.test(cell.title),
                    `${benzo}/${severity} title "${cell.title}" gives a CIWA-Ar band with no AWS equivalent`);
            }
        }
    });

    test('every PRN trigger gives both scales', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const [severity, cell] of Object.entries(REGIMEN_CONFIG[benzo])) {
                for (const entry of (cell && cell.prn) || []) {
                    if (typeof entry === 'string') continue;
                    assert.ok(entry.aws,
                        `${benzo}/${severity} PRN trigger at CIWA ${entry.range} has no AWS band`);
                }
            }
        }
    });

    test('the severity selector and escalation triggers name both scales', () => {
        const html = read('index.html');
        const regimens = html.slice(html.indexOf('<div id="regimens"'),
            html.indexOf('<div id="special-cases"'));
        const ciwaOnly = [...regimens.matchAll(/CIWA-Ar?[^<]{0,30}/g)]
            .map((m) => m[0])
            .filter((s) => /\d/.test(s));
        assert.ok(ciwaOnly.length > 0, 'no CIWA bands found at all — the selector is broken');
        assert.ok(/AWS 4-14/.test(regimens) && /AWS &gt; 14/.test(regimens),
            'the severity buttons do not carry AWS equivalents');
    });

    test('the AWS/CIWA band overlap is stated rather than papered over', () => {
        const caveats = REGIMEN_CONFIG.Diazepam.mild.caveat.join('\n');
        assert.ok(/AWS 4-14<\/b> spans both|AWS 4-14 spans both/.test(caveats),
            'AWS 4-14 covers both fixed schedules; presenting a clean mapping would be an invented equivalence');
    });
});

describe('P1-03 — monitoring is specified, not left to "q2hrly at least initially"', () => {
    const html = read('index.html');
    const regimens = html.slice(html.indexOf('<div id="regimens"'),
        html.indexOf('<div id="special-cases"'));

    test('the severity-linked observation frequency table is present', () => {
        for (const freq of ['4-6 hourly', '2-4 hourly', 'hourly']) {
            assert.ok(regimens.includes(freq), `monitoring frequency "${freq}" missing`);
        }
    });

    test('the observation set is enumerated', () => {
        for (const obs of ['temperature', 'pulse rate and rhythm', 'blood pressure', 'hydration']) {
            assert.ok(new RegExp(obs, 'i').test(regimens), `observation "${obs}" missing`);
        }
    });

    test('minimum investigations are named', () => {
        assert.ok(/FBC, magnesium, UEC, LFT/.test(regimens),
            'the minimum investigation set is missing');
    });
});

describe('P1-04 — something exists below the Mild-Moderate band', () => {
    test('a sub-mild cell exists for both benzodiazepines', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            assert.ok(REGIMEN_CONFIG[benzo].submild, `${benzo} has nothing below Mild-Moderate`);
        }
    });

    test('both options are offered and neither is presented as settled', () => {
        const text = textOf(REGIMEN_CONFIG.Diazepam.submild);
        assert.ok(/supportive care and symptom-triggered dosing only/i.test(text),
            'the supportive-care-only option is missing');
        assert.ok(/half<\/b> the ambulatory regimen doses|half the ambulatory regimen doses/i.test(text),
            'the NSWCG Table 5.5 half-dose option is missing');
    });

    test('the halved schedule is tagged as derived, not as guideline dosing', () => {
        const caveats = [...REGIMEN_CONFIG.Diazepam.submild.schedule].join('\n');
        assert.ok(/src-nswcg-adapted/.test(caveats),
            'the halved figures are derived from a local ambulatory regimen and must not be tagged as NSWCG dosing');
    });

    test('it is reachable from the severity selector', () => {
        assert.ok(/data-severity="submild"/.test(read('index.html')),
            'no button selects the sub-mild option');
    });
});
