// One sedation rule for every benzodiazepine dose (0.5.7): RASS 0 or above
// to give a dose; RASS -1 is the target, so withhold there; RASS -2 or below,
// withhold and review. Every page that doses a
// benzodiazepine must say so, in its own words or via data/sedation.js.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    RASS_RULE_HTML, RASS_RULE_PLAIN, RASS_LOADING_HTML, RASS_STEP_HTML, SEDATION_STEPS_HTML
} from '../data/sedation.js';
import { EMR_SAFETY_LINES, REGIMEN_CONFIG } from '../data/regimens.js';
import { SYMPTOMATIC_UNIVERSAL, SYMPTOMATIC_SEDATION } from '../data/symptomatic.js';

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
        assert.equal(SYMPTOMATIC_SEDATION, RASS_RULE_HTML);
        assert.ok(!SYMPTOMATIC_UNIVERSAL.includes(RASS_RULE_HTML), 'the rule is shown first, not repeated in the list');
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

// The over-sedation safeguard is stated in plain words - monitor sedation, do
// not give a dose to a sedated patient - before RASS is named, and it is the
// first thing in every section that gives a benzodiazepine (0.5.9).
const plainBeforeRass = (text) => {
    const flat = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
    const plain = flat.search(/Do not give/);
    return plain >= 0 && /sedated/.test(flat.slice(plain, plain + 80)) && plain < flat.indexOf('RASS');
};

describe('sedation caution comes first, in plain words', () => {
    // Concise by request: one warning line, then the three RASS levels.
    test('the shared statements stay short', () => {
        const words = (h) => h.replace(/<span class="src-tag[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ' ')
            .split(/\s+/).filter(Boolean).length;
        assert.ok(words(RASS_RULE_HTML) <= 40, `RASS_RULE_HTML is ${words(RASS_RULE_HTML)} words`);
        assert.ok(words(RASS_STEP_HTML) <= 25, `RASS_STEP_HTML is ${words(RASS_STEP_HTML)} words`);
        assert.ok(/class="rass-levels"/.test(RASS_RULE_HTML), 'the RASS levels are not a list');
    });

    test('every shared statement says "do not give if sedated" before naming RASS', () => {
        for (const t of [RASS_RULE_HTML, RASS_RULE_PLAIN, RASS_LOADING_HTML, SEDATION_STEPS_HTML]) {
            assert.ok(plainBeforeRass(t), t.slice(0, 80));
        }
        assert.ok(/^Do not give if sedated/.test(RASS_STEP_HTML.replace(/<[^>]+>/g, '')));
    });

    test('the EMR paste states it straight after the doses, before scoring and review lines', () => {
        const js = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
        const fn = js.slice(js.indexOf('function buildRegimenSummary'), js.indexOf('// Condensed, citation-free version'));
        const sedation = fn.indexOf('EMR_SAFETY_LINES.sedation');
        assert.ok(sedation > fn.indexOf('prnHeading(data.prn)'), 'sedation line comes before the PRN doses');
        for (const later of ['INITIAL_SCORING_INTERVAL', 'EMR_SAFETY_LINES.dosingInterval', 'EMR_SAFETY_LINES.review']) {
            assert.ok(sedation < fn.indexOf(later), `sedation line comes after ${later}`);
        }
        assert.equal((fn.match(/EMR_SAFETY_LINES\.sedation/g) || []).length, 1, 'sedation line pasted twice');
    });

    test('regimen cards and symptomatic tables open with the caution box', () => {
        const js = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
        const card = js.slice(js.indexOf('function renderCell'));
        assert.ok(card.indexOf('sedation-caution') < card.indexOf('data.setting'), 'caution is not above the setting');
        assert.ok(card.indexOf('sedation-caution') < card.indexOf('renderCaveats'), 'caution is not above the caveats');
        assert.ok(/<h4>\$\{set\.title\}<\/h4>`\s*\+ `<div class="warning-box sedation-caution">/.test(js),
            'symptomatic tables do not open with the caution');
    });

    for (const [name, heading] of [
        ['Monitoring tab', '<h3>4. Monitoring, Escalation &amp; Discharge</h3>'],
        ['Special Cases tab', '<h3>Special Cases</h3>'],
        ['Ambulatory medication tab', '<h3>Medication Regimen</h3>'],
        ['Benzodiazepine tapering', '<h4>Tapering Schedules</h4>'],
        ['GHB benzodiazepine treatment', '<h5>Benzodiazepines - primary treatment</h5>'],
    ]) {
        test(`${name} opens with the caution box, plain words first`, () => {
            const after = html.slice(html.indexOf(heading) + heading.length);
            const first = after.replace(/^\s*(<!--[\s\S]*?-->\s*)?/, '');
            assert.ok(first.startsWith('<div class="warning-box sedation-caution">'), `${name}: first element is not the caution`);
            assert.ok(plainBeforeRass(first.slice(0, first.indexOf('</div>'))), `${name}: RASS named before the plain instruction`);
        });
    }
});
