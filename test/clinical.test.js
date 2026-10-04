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
import {
    TRIAGE_QUESTIONS, TRIAGE_OUTCOMES, RED_FLAG_STEP_UP, activeQuestions, nextQuestion, pruneAnswers,
    baseOutcome, triageOutcome, triageSummary
} from '../data/flowchart.js';
import {
    INPATIENT_CHECKLIST, THIAMINE_DOSES, newChecklistState, chooseBenzo, chooseBand, chooseRegimenType,
    prefillFromTriage, stepProgress, regimenCellKey, checklistSummary
} from '../data/checklist.js';
import { bandFor, restartDose, ORAL_OTP_AGENTS, MISSED_DOSE_BANDS } from '../data/otp-missed-doses.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const byId = (id) => {
    const s = SCALES.find((sc) => sc.id === id);
    assert.ok(s, `scale "${id}" not found`);
    return s;
};
const severityAt = (id, score) => byId(id).severityLogic(score);

describe('severity boundaries', () => {
    // AWS: <4 Sub-Mild, 4-7 Mild-Moderate, 8-14 Moderate-Severe, >=15 Severe
    // (NSWCG Table 5.6 with AGTAP's 7/8 split), matching the Regimens tab.
    test('AWS bands', () => {
        assert.match(severityAt('aws', 0), /^Sub-Mild/);
        assert.match(severityAt('aws', 3), /^Sub-Mild/);
        assert.match(severityAt('aws', 4), /^Mild-Moderate/);
        assert.match(severityAt('aws', 7), /^Mild-Moderate/);
        assert.match(severityAt('aws', 8), /^Moderate-Severe/);
        assert.match(severityAt('aws', 14), /^Moderate-Severe/);
        assert.match(severityAt('aws', 15), /^Severe/);
    });

    // CIWA-Ar: <10 Sub-Mild, 10-15 Mild-Moderate, 16-20 Moderate-Severe, >20
    // Severe - the Regimens tab's bands (v0.5.8; severe was >18 before).
    test('CIWA-Ar bands', () => {
        assert.match(severityAt('ciwa-ar', 9), /^Sub-Mild/);
        assert.match(severityAt('ciwa-ar', 10), /^Mild-Moderate/);
        assert.match(severityAt('ciwa-ar', 15), /^Mild-Moderate/);
        assert.match(severityAt('ciwa-ar', 16), /^Moderate-Severe/);
        assert.match(severityAt('ciwa-ar', 20), /^Moderate-Severe/);
        assert.match(severityAt('ciwa-ar', 21), /^Severe/);
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
    // Every cell in the config, not only the ones on the intensity axis: `loading`
    // and `unknown` are reached from the type axis and the Assessment tab, and
    // are exactly as capable of rendering nothing.
    const SEVERITIES = ['submild', 'mild', 'symptom', 'moderate', 'severe', 'loading', 'unknown'];

    // A cell renders either a schedule (or loading's steps) or a `routing` card. The routing shape
    // exists so a combination that must not produce doses (severe withdrawal on
    // oxazepam) can say so, instead of rendering an empty schedule — see P0-05.
    test('every benzo x severity combination resolves to a schedule or a routing card', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const severity of SEVERITIES) {
                const data = REGIMEN_CONFIG[benzo][severity];
                assert.ok(data, `${benzo}/${severity} missing`);
                assert.ok(data.name, `${benzo}/${severity} has no name`);
                // Loading is laid out as steps (load, PRN, handover) rather than
                // a schedule list, and renders through its own branch.
                const schedule = (Array.isArray(data.schedule) && data.schedule.length > 0)
                    || (Array.isArray(data.steps) && data.steps.length > 0);
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

    // The dose table used to be duplicated: once under Mild-Moderate and once in
    // the symptom-triggered cell. The duplicate went, and Mild-Moderate carried a
    // pointer to the survivor instead. That pointer went too once symptom-triggered
    // became a button on the type axis directly above the panel — a paragraph
    // telling the reader to press a button they can see is noise. What still has to
    // hold is that exactly one copy of the table exists.
    test('the symptom-triggered dose table exists in exactly one place', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            const config = REGIMEN_CONFIG[benzo];
            assert.ok(config.symptom.bands, `${benzo} has lost the symptom-triggered dose table`);
            for (const key of ['mild', 'moderate', 'submild', 'loading']) {
                assert.ok(!config[key]?.bands,
                    `${benzo}.${key} carries its own copy of the dose table — it will drift`);
                assert.ok(!config[key]?.symptom_triggered,
                    `${benzo}.${key} still points at the symptom-triggered regimen, which is now a button above it`);
            }
        }
    });
});

// Every way through the triage: each intake x history x support x red-flag
// combination, with support only where it is asked.
function* everyTriage() {
    yield { need: 'no' };
    const flags = TRIAGE_QUESTIONS.find((q) => q.id === 'flags').options.map((o) => o.value);
    const flagSets = [[], ...flags.map((f) => [f]), flags];
    for (const drinks of ['upto7', '8to14', '15plus']) {
        for (const history of ['no', 'yes']) {
            const supports = drinks === '8to14' && history === 'no' ? ['good', 'poor'] : [undefined];
            for (const support of supports) {
                for (const f of flagSets) {
                    const a = { need: 'yes', drinks, history, flags: f };
                    if (support) a.support = support;
                    yield a;
                }
            }
        }
    }
}

describe('alcohol withdrawal triage', () => {
    test('every complete set of answers reaches an outcome that exists and has text', () => {
        for (const answers of everyTriage()) {
            const result = triageOutcome(answers);
            assert.ok(result, `no outcome for ${JSON.stringify(answers)}`);
            const outcome = TRIAGE_OUTCOMES[result.key];
            assert.ok(outcome?.title && outcome.text && outcome.plan, `outcome ${result.key} incomplete`);
            assert.ok(triageSummary(answers).includes(outcome.plan), `EMR summary for ${result.key} lacks the plan`);
        }
    });

    test('every outcome is reachable', () => {
        const seen = new Set([...everyTriage()].map((a) => triageOutcome(a).key));
        assert.deepEqual(Object.keys(TRIAGE_OUTCOMES).filter((k) => !seen.has(k)), []);
    });

    // The tree this replaced, node for node. Red flags aside, nothing moved.
    test('without red flags the outcomes match the previous decision tree', () => {
        const expected = [
            [{ drinks: 'upto7', history: 'no' }, 'supportive'],
            [{ drinks: 'upto7', history: 'yes' }, 'consider_district'],
            [{ drinks: '8to14', history: 'no', support: 'good' }, 'ambulatory'],
            [{ drinks: '8to14', history: 'no', support: 'poor' }, 'district'],
            [{ drinks: '8to14', history: 'yes' }, 'consider_general'],
            [{ drinks: '15plus', history: 'no' }, 'consider_general'],
            [{ drinks: '15plus', history: 'yes' }, 'general_only'],
        ];
        for (const [a, key] of expected) {
            assert.equal(baseOutcome(a), key, JSON.stringify(a));
            assert.equal(triageOutcome({ need: 'yes', ...a, flags: [] }).key, key, JSON.stringify(a));
        }
    });

    test('a red flag moves up exactly one level and never to care at home', () => {
        const order = ['supportive', 'ambulatory', 'consider_district', 'district', 'consider_general', 'general_only'];
        const level = { supportive: 0, ambulatory: 1, consider_district: 2, district: 2, consider_general: 3, general_only: 4 };
        for (const answers of everyTriage()) {
            if (!answers.flags?.length) continue;
            const { key, base } = triageOutcome(answers);
            assert.ok(!['supportive', 'ambulatory'].includes(key), `${JSON.stringify(answers)} -> ${key}`);
            assert.ok(level[key] >= level[base], `${base} stepped down to ${key}`);
            if (base !== 'supportive' && base !== 'general_only') {
                assert.equal(level[key], level[base] + 1, `${base} -> ${key} is not one level`);
            }
        }
        assert.deepEqual(Object.keys(RED_FLAG_STEP_UP).sort(), order.slice().sort());
    });

    test('an untouched red-flag list is not an answer', () => {
        const a = { need: 'yes', drinks: '8to14', history: 'no', support: 'good' };
        assert.equal(triageOutcome(a), null);
        assert.equal(nextQuestion(a).id, 'flags');
        assert.equal(triageOutcome({ ...a, flags: [] }).key, 'ambulatory');
    });

    test('home support is asked only for 8-14 drinks without a complication history', () => {
        const asked = (a) => activeQuestions(a).some((q) => q.id === 'support');
        assert.ok(asked({ need: 'yes', drinks: '8to14', history: 'no' }));
        assert.ok(!asked({ need: 'yes', drinks: '8to14', history: 'yes' }));
        assert.ok(!asked({ need: 'yes', drinks: '15plus', history: 'no' }));
    });

    test('an answer that stops applying is dropped, not left to steer the result', () => {
        const a = pruneAnswers({ need: 'yes', drinks: '15plus', history: 'no', support: 'good', flags: [] });
        assert.equal(a.support, undefined);
        assert.deepEqual(pruneAnswers({ need: 'no', drinks: '8to14' }), { need: 'no' });
    });

    test('the hospital is called General Hospital everywhere', () => {
        for (const file of ['index.html', 'data/flowchart.js', 'data/checklist.js']) {
            assert.ok(!/Base Hospital/i.test(read(file)), `${file} still says Base Hospital`);
        }
    });

    // 15 drinks is a hospital patient in triage, so ambulatory detox cannot
    // also accept it.
    test('the intake split agrees between triage and the ambulatory criteria', () => {
        assert.ok(TRIAGE_QUESTIONS.find((q) => q.id === 'drinks').options.some((o) => o.label === '≥ 15'));
        assert.ok(/average alcohol intake is ≤14 standard drinks per day/.test(read('index.html')));
        assert.ok(!/≤15 standard drinks/.test(read('index.html')));
    });

    test('guideline links point at pages that exist', () => {
        const html = read('index.html');
        for (const [id, o] of Object.entries(TRIAGE_OUTCOMES)) {
            for (const key of ['guideline_link', 'ambulatory_guideline_link']) {
                if (!o[key]) continue;
                assert.ok(html.includes(`id="${o[key]}"`), `${id}.${key} -> "${o[key]}" is not a page in index.html`);
            }
        }
    });
});

describe('inpatient checklist', () => {
    test('every step links to a tab that exists on the Inpatient Guidelines page', () => {
        const html = read('index.html');
        for (const step of INPATIENT_CHECKLIST) {
            assert.ok(html.includes(`class="tab-button" data-tab="${step.tab}"`)
                || html.includes(`class="tab-button active" data-tab="${step.tab}"`),
                `${step.id} -> tab "${step.tab}" does not exist`);
        }
    });

    test('benzodiazepine choice follows the Benzo Choice tab', () => {
        assert.equal(chooseBenzo([]), 'Diazepam');
        for (const f of ['liver', 'resp', 'elderly', 'cerebral']) assert.equal(chooseBenzo([f]), 'Oxazepam');
    });

    test('band follows the intake split, moved up one band for any risk factor', () => {
        assert.equal(chooseBand(null, []), null);
        assert.equal(chooseBand('low', []), 'mild');
        assert.equal(chooseBand('high', []), 'moderate');
        assert.equal(chooseBand('low', ['bal']), 'moderate');
        assert.equal(chooseBand('low', ['bal', 'cns', 'medical']), 'moderate');
        assert.equal(chooseBand('high', ['previous']), 'severe');
    });

    test('band keys are the Regimens tab severities', () => {
        const html = read('index.html');
        for (const band of ['mild', 'moderate', 'severe']) {
            assert.ok(html.includes(`data-severity="${band}"`), `no Regimens button for ${band}`);
        }
    });

    test('regimen type: severe or a loading criterion loads; a fixed criterion fixes; otherwise the clinician picks', () => {
        assert.equal(chooseRegimenType({ band: 'severe', loading: [], fixed: [], picked: 'symptom' }), 'loading');
        assert.equal(chooseRegimenType({ band: 'mild', loading: ['seizure_history'], fixed: ['poly'], picked: null }), 'loading');
        assert.equal(chooseRegimenType({ band: 'mild', loading: [], fixed: ['poly'], picked: 'symptom' }), 'fixed');
        assert.equal(chooseRegimenType({ band: 'mild', loading: [], fixed: [], picked: null }), null);
        assert.equal(chooseRegimenType({ band: 'mild', loading: [], fixed: [], picked: 'symptom' }), 'symptom');
    });

    test('triage answers carry over without inventing risk factors', () => {
        const s = prefillFromTriage({ need: 'yes', drinks: '15plus', history: 'yes', flags: ['in_withdrawal', 'comorbid', 'pregnant'] });
        assert.equal(s.intake, 'high');
        assert.deepEqual(s.risks.sort(), ['bal', 'previous']);
        assert.equal(prefillFromTriage({ need: 'yes', drinks: '8to14', history: 'no', flags: [] }).intake, 'low');
    });

    test('the EMR summary carries the decisions and the unticked items, without source chips', () => {
        const s = newChecklistState();
        s.intake = 'low';
        s.ticks['prereq.bal'] = true;
        const text = checklistSummary(s);
        assert.ok(/Benzodiazepine: Diazepam/.test(text));
        assert.ok(/Band: Mild-Mod/.test(text));
        assert.ok(/Regimen type: not yet chosen/.test(text));
        assert.ok(/Wernicke screen not yet answered/.test(text));
        assert.ok(/Regimen doses: choose the band and regimen type/.test(text));
        assert.ok(!/BAL checked/.test(text), 'a ticked item is listed as open');
        assert.ok(!/<|NSWCG §/.test(text), 'markup or a source chip leaked into the EMR text');
    });

    // The two thiamine doses are alternatives decided by the Wernicke screen;
    // only the one that applies reaches the EMR.
    test('thiamine: the Wernicke answer picks one dose, and the screen counts toward the step', () => {
        const step = INPATIENT_CHECKLIST.find((x) => x.id === 'thiamine');
        const s = newChecklistState();
        assert.equal(stepProgress(step, s).total, step.items.length + 1);
        assert.equal(stepProgress(step, s).ticked, 0);
        s.wernicke = 'no';
        assert.equal(stepProgress(step, s).ticked, 1);
        let text = checklistSummary(s);
        assert.ok(text.includes(THIAMINE_DOSES.no.emr) && !text.includes(THIAMINE_DOSES.yes.emr));
        assert.ok(/300mg IV/.test(THIAMINE_DOSES.no.emr));
        s.wernicke = 'yes';
        text = checklistSummary(s);
        assert.ok(text.includes(THIAMINE_DOSES.yes.emr) && !text.includes(THIAMINE_DOSES.no.emr));
        assert.ok(/500mg IV TDS for at least 5 days/.test(THIAMINE_DOSES.yes.emr));
        for (const d of Object.values(THIAMINE_DOSES)) assert.ok(/before any glucose/.test(d.emr));
    });

    test('the thiamine doses match the Thiamine tab', () => {
        const html = read('index.html');
        assert.ok(/thiamine 300mg daily IV \(preferred\) or IM for 3 days, then 300mg oral daily\s+for 2-3 weeks/.test(html));
        assert.ok(/500mg IV TDS for a minimum of 5 days/.test(html));
    });

    test('the regimen block is placed as given, after the open items', () => {
        const s = newChecklistState();
        s.intake = 'high';
        s.picked = 'fixed';
        s.scale = 'ciwa';
        const text = checklistSummary(s, 'ALCOHOL WITHDRAWAL - test block');
        assert.ok(text.endsWith('ALCOHOL WITHDRAWAL - test block'));
        assert.ok(text.indexOf('Not yet ticked:') < text.indexOf('ALCOHOL WITHDRAWAL'));
        assert.ok(/scored on CIWA-Ar/.test(text));
    });

    test('checklist choices land on a Regimens tab cell that exists', () => {
        assert.equal(regimenCellKey('mild', 'fixed'), 'mild');
        assert.equal(regimenCellKey('moderate', 'fixed'), 'moderate');
        assert.equal(regimenCellKey('mild', 'symptom'), 'symptom');
        assert.equal(regimenCellKey('severe', 'loading'), 'loading');
        assert.equal(regimenCellKey('mild', null), null);
        for (const benzo of ['Diazepam', 'Oxazepam']) {
            for (const key of ['mild', 'moderate', 'symptom', 'loading']) {
                assert.ok(REGIMEN_CONFIG[benzo][key], `${benzo}.${key} missing`);
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

    // Every input in index.html declares enough in its own label to be checked:
    // a single serve states its volume in mL, a cask or flagon states it in
    // litres, and a multipack states a count of a serve size named elsewhere in
    // the same fieldset. Casks and cartons are where drift hides - they are the
    // large numbers, and nothing else recomputes them - so they are checked too.
    const parseRows = (html) => [...html.matchAll(
        /<label for="(\w+)">([^<]*?)<\/label><input\s+type="number"\s+id="\1"\s+data-sd="([\d.]+)"/g)]
        .map(([, id, label, sd]) => ({ id, label: label.replace(/\s+/g, ' ').trim(), sd: Number(sd) }));

    // A multipack states a count, a cask states litres, and a single serve states
    // mL. Multipacks are tested first: "4 x 375ml" contains a serve volume that
    // would otherwise be read as the volume of the whole pack.
    const CAN_ML = 375;   // the can/stubby every multipack row is counted in
    function volumeMl(label) {
        const perPack = label.match(/\((\d+)\s*(?:x|\u00d7)\s*(\d+)\s*ml/i);
        if (perPack) return Number(perPack[1]) * Number(perPack[2]);
        const cans = label.match(/\((\d+)\s*(?:cans?|stubbies)/i);
        if (cans) return Number(cans[1]) * CAN_ML;
        const litres = label.match(/(?:\(|-\s*)([\d.]+)\s*L\b/);
        if (litres) return Number(litres[1]) * 1000;
        const ml = label.match(/(\d+)\s*ml\b/i);
        return ml ? Number(ml[1]) : null;
    }

    test('per-drink data-sd constants agree with the formula', () => {
        const rows = parseRows(read('index.html'));
        assert.ok(rows.length > 10, `only parsed ${rows.length} drink rows`);

        let checked = 0;
        const problems = [];
        for (const { id, label, sd } of rows) {
            const abv = label.match(/\(([\d.]+)%\)/);
            const ml = volumeMl(label);
            if (!abv || !ml) continue;
            checked++;
            const expected = stdDrinks(ml, Number(abv[1]));
            // Serves round to 0.1 SD; casks and cartons are large enough that a
            // flat tolerance would let a whole drink of drift through.
            const tolerance = Math.max(0.15, expected * 0.02);
            if (Math.abs(expected - sd) > tolerance) {
                problems.push(`${id} "${label}": listed ${sd}, formula ${expected.toFixed(2)}`);
            }
        }
        assert.ok(checked >= 40, `only checked ${checked} parseable rows`);
        assert.deepEqual(problems, [], `\n  ${problems.join('\n  ')}`);
    });

    // Every row has to be reachable by the label a patient or clinician would
    // use, and every row has to be checkable - an unparseable label is a row the
    // test above silently skips.
    test('no drink row escapes the formula check', () => {
        const skipped = parseRows(read('index.html'))
            .filter((r) => !(/\(([\d.]+)%\)/.test(r.label) && volumeMl(r.label)))
            .map((r) => `${r.id} "${r.label}"`);
        assert.deepEqual(skipped, [], `\n  unparseable labels:\n  ${skipped.join('\n  ')}`);
    });

    // A row nobody can find is a row nobody uses. These are the cases where the
    // arithmetic was already right and only the word was missing: "carton" is
    // not what gets said, and a generic "Spirit" row does not answer someone
    // scanning the list for what the patient actually named.
    test('drinks are findable by the word people use for them', () => {
        const html = read('index.html');
        assert.ok(/Carton \/ Slab/.test(html), 'no row labelled as a slab');
        assert.ok(/Six-pack/.test(html), 'no six-pack row');
        for (const spirit of ['Gin', 'Vodka', 'Whisky', 'Rum']) {
            assert.ok(new RegExp(spirit).test(html), `the spirits rows never name ${spirit}`);
        }
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

describe('OTP missed doses', () => {
    // The band boundaries are the whole point of the section: 3 and 4 are one
    // dose apart and mean "normal dose" versus "reduced dose plus a phone call
    // to the prescriber", and 5 and 6 separate a reduced dose from no dose at
    // all. A change that shifts either of these is not a refactor.
    test('the bands break at 3/4 and 5/6', () => {
        assert.equal(bandFor(1).key, 'resume');
        assert.equal(bandFor(3).key, 'resume');
        assert.equal(bandFor(4).key, 'reduced');
        assert.equal(bandFor(5).key, 'reduced');
        assert.equal(bandFor(6).key, 'review');
        assert.equal(bandFor(30).key, 'review');
    });

    test('a count below one is not a band', () => {
        for (const n of [0, -1, NaN, undefined]) {
            assert.equal(bandFor(n), null, `${n} produced a band`);
        }
    });

    test('every band is reachable, and no band is unreachable', () => {
        const reached = new Set([...Array(20).keys()].map((i) => bandFor(i + 1).key));
        assert.equal(reached.size, MISSED_DOSE_BANDS.length,
            'a band in the table can never be selected by a dose count');
    });

    // "Half the usual dose, or the floor, whichever is higher" is the rule most
    // easily got backwards, and getting it backwards after a tolerance-losing
    // gap is an overdose. Asserted on both sides of each agent's floor.
    test('the restart dose is the higher of half-dose and floor', () => {
        assert.equal(restartDose('methadone', 100).doseMg, 50);
        assert.equal(restartDose('methadone', 80).doseMg, 40);
        assert.equal(restartDose('methadone', 60).doseMg, 40, 'half of 60 is below the 40mg floor');
        assert.equal(restartDose('buprenorphine', 24).doseMg, 12);
        assert.equal(restartDose('buprenorphine', 16).doseMg, 8);
        assert.equal(restartDose('buprenorphine', 12).doseMg, 8, 'half of 12 is below the 8mg floor');
    });

    // The documented departure from the source. Read literally, the floor hands
    // a patient on 30mg of methadone 40mg — more than they normally take — on
    // the day they return from a gap. The cap is what stops that, and the flag
    // is what makes the app say so rather than quietly disagree.
    test('the restart dose never exceeds the usual dose, and says when it capped', () => {
        const low = restartDose('methadone', 30);
        assert.equal(low.doseMg, 30);
        assert.equal(low.cappedAtUsual, true);

        const lowBupe = restartDose('buprenorphine', 6);
        assert.equal(lowBupe.doseMg, 6);
        assert.equal(lowBupe.cappedAtUsual, true);

        const normal = restartDose('methadone', 100);
        assert.equal(normal.cappedAtUsual, false);
    });

    test('a missing or nonsensical dose returns nothing rather than a number', () => {
        for (const dose of [0, -10, NaN, undefined]) {
            assert.equal(restartDose('methadone', dose), null, `${dose} produced a dose`);
        }
        assert.equal(restartDose('oxycodone', 80), null, 'an agent with no missed-dose rule produced one');
    });

    test('both agents carry the figures the section quotes', () => {
        assert.equal(ORAL_OTP_AGENTS.methadone.floorMg, 40);
        assert.equal(ORAL_OTP_AGENTS.methadone.stepMg, 20);
        assert.equal(ORAL_OTP_AGENTS.buprenorphine.floorMg, 8);
        assert.equal(ORAL_OTP_AGENTS.buprenorphine.stepMg, 8);
    });
});

describe('0.5.7 decisions', () => {
    test('RASS: 0 or above allows the next dose, -1 (target) and below withhold it', () => {
        assert.match(severityAt('rass', 0), /next dose may be given/);
        assert.match(severityAt('rass', 1), /next dose may be given/);
        assert.match(severityAt('rass', -1), /target reached: withhold/i);
        assert.doesNotMatch(severityAt('rass', -1), /medical review/);
        assert.match(severityAt('rass', -2), /withhold.*medical review/i);
        assert.match(severityAt('rass', -5), /withhold/i);
        assert.match(severityAt('rass', 2), /look for a cause/);
    });

    test('RASS opens at 0, not at +4', () => {
        const item = byId('rass').items[0];
        assert.equal(item.options[item.defaultIndex].value, 0);
    });
});
