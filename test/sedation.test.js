// One sedation rule for every benzodiazepine dose (0.5.7): RASS 0 or above
// to give a dose; RASS -1 is the target, so withhold there; RASS -2 or below,
// withhold and review. Every page that doses a
// benzodiazepine must say so, in its own words or via data/sedation.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RASS_RULE_HTML, RASS_RULE_PLAIN, RASS_LOADING_HTML, RASS_STEP_HTML } from '../data/sedation.js';
import { EMR_SAFETY_LINES, REGIMEN_CONFIG } from '../data/regimens.js';
import { SYMPTOMATIC_UNIVERSAL } from '../data/symptomatic.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const section = (startId, endId) => html.slice(html.indexOf(`id="${startId}"`), html.indexOf(`id="${endId}"`));
const saysRule = (text) => /RASS -2 or below/.test(text) && /RASS -1/.test(text) && !/RASS -1 or above/.test(text.replace(/\s+/g, ' '));

describe('RASS rule on every benzodiazepine dose', () => {
    test('shared wording carries both thresholds', () => {
        for (const t of [RASS_RULE_HTML, RASS_RULE_PLAIN, RASS_LOADING_HTML, RASS_STEP_HTML]) assert.ok(saysRule(t));
    });
    test('no page still gives a dose at RASS -1', () => {
        const all = [html, RASS_RULE_HTML, RASS_RULE_PLAIN, RASS_LOADING_HTML, RASS_STEP_HTML].join(' ');
        assert.ok(!/RASS -1 or above/.test(all.replace(/\s+/g, ' ')), 'a page still says "RASS -1 or above"');
    });
    test('every Loading step that gives doses carries the check', () => {
        const steps = REGIMEN_CONFIG.Diazepam.loading.steps;
        assert.ok(steps[1].items.includes(RASS_STEP_HTML), 'Step 2 (PRN) has no RASS check');
        assert.ok(steps[2].items.includes(RASS_STEP_HTML), 'Step 3 (Day 2+) has no RASS check');
    });
    test('the EMR paste uses the shared rule', () => {
        assert.equal(EMR_SAFETY_LINES.sedation, RASS_RULE_PLAIN);
    });
    test('loading Step 1 states the RASS endpoint', () => {
        assert.ok(REGIMEN_CONFIG.Diazepam.loading.steps[0].items.includes(RASS_LOADING_HTML));
    });
    test('symptomatic tables (opioid, cannabis, gabapentinoid, stimulant) carry it', () => {
        assert.ok(SYMPTOMATIC_UNIVERSAL.includes(RASS_RULE_HTML));
    });
    for (const [name, start, end] of [
        ['alcohol monitoring & escalation', 'monitoring-discharge', 'special-cases'],
        ['alcohol special cases (DT)', 'special-cases', 'alcohol-harm-reduction'],
        ['ambulatory medication', 'ambulatory-meds', 'ambulatory-escalation'],
        ['benzodiazepine withdrawal', 'benzo-withdrawal-page', 'cannabis-withdrawal-page'],
        ['GHB withdrawal', 'ghb-withdrawal-page', 'nicotine-withdrawal-page'],
    ]) {
        test(`${name} page carries it`, () => assert.ok(saysRule(section(start, end)), name));
    }
});
