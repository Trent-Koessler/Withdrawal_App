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
            /[Tt]wo consecutive CIWA-Ar scores/,
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
