// Guards for the 0.5.7 clinical decisions, so they cannot quietly revert.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { REGIMEN_CONFIG } from '../data/regimens.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

describe('0.5.7 clinical decisions', () => {
    test('promethazine is gone from symptomatic medications', () => {
        assert.ok(!/promethazine/i.test(read('data/symptomatic.js').replace(/^\s*\/\/.*$/gm, '')));
    });

    // 0.5.8 replaced the 0.5.7 decision: symptom-triggered AWS bands now follow
    // AGTAP Table 8.4, and the regimen must say so and why.
    test('symptom-triggered AWS follows AGTAP Table 8.4 and explains why', () => {
        for (const benzo of ['Diazepam', 'Oxazepam']) {
            const cell = REGIMEN_CONFIG[benzo].symptom;
            assert.ok(cell.caveatAws && /AGTAP Table 8\.4/.test(cell.caveatAws)
                && /no validated CIWA-Ar\/AWS equivalence/.test(cell.caveatAws),
                `${benzo}: no AWS source explanation`);
            assert.deepEqual(cell.bands.map((b) => b.aws), ['&lt; 4', '4-7', '&gt; 7']);
        }
    });

    test('Benzo Choice steers elderly/frail away from a fixed schedule', () => {
        assert.ok(/Elderly or frail patients:<\/b> prefer symptom-triggered dosing/.test(read('index.html')));
    });
});

describe('0.5.8 AWS monitoring', () => {
    test('Moderate-Severe rescoring is 1-2 hourly on AWS, 2-4 hourly on CIWA-Ar', () => {
        for (const benzo of ['Diazepam', 'Oxazepam']) {
            const cell = REGIMEN_CONFIG[benzo].moderate;
            assert.equal(cell.monitoringAws, '1-2 hourly', benzo);
            assert.equal(cell.monitoring, '2-4 hourly', benzo);
        }
    });
});

describe('0.5.8 CIWA-Ar bands', () => {
    test('fixed schedules no longer overlap at 15', () => {
        for (const benzo of ['Diazepam', 'Oxazepam']) {
            assert.equal(REGIMEN_CONFIG[benzo].mild.band.ciwa, '10-15');
            assert.equal(REGIMEN_CONFIG[benzo].moderate.band.ciwa, '16-20');
            const ranges = REGIMEN_CONFIG[benzo].mild.prn.filter((e) => typeof e === 'object').map((e) => e.range);
            assert.deepEqual(ranges, ['10-15', '16-20']);
            assert.ok(/Day E, Daly C/.test(REGIMEN_CONFIG[benzo].mild.caveatCiwa) && /Foy A/.test(REGIMEN_CONFIG[benzo].mild.caveatCiwa));
        }
    });
});

import { SCALES } from '../data/scales.js';
describe('0.5.8 CIWA-Ar matches the published scale (Sullivan 1989)', () => {
    const ciwa = SCALES.find((s) => s.id === 'ciwa-ar');
    test('items 1-9 offer every value 0-7, orientation 0-4; max 67', () => {
        const counts = ciwa.items.map((i) => i.options.length);
        assert.deepEqual(counts, [8, 8, 8, 8, 8, 8, 8, 8, 8, 5]);
        const max = ciwa.items.reduce((t, i) => t + Math.max(...i.options.map((o) => o.value)), 0);
        assert.equal(max, 67);
    });
    test('agitation 7 is the published descriptor, not the anxiety one', () => {
        const ag = ciwa.items.find((i) => i.radioName === 'ciwa-agitation');
        assert.match(ag.options[7].label, /Paces back and forth during most of the interview, or constantly thrashes about/);
    });
});

describe('0.5.8 PAWSS', () => {
    test('PAWSS is gone from the visible page; ambulatory checks prior complications instead', () => {
        // Clinical pages only: the changelog legitimately mentions the removal.
        const full = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
        const html = full.slice(0, full.indexOf('id="changelog'));
        assert.ok(!/PAWSS|Prediction of Alcohol Withdrawal Severity/.test(html));
        assert.ok(/No history of severe withdrawal complications<\/strong> - withdrawal\s+seizures or delirium tremens/.test(html));
    });
});
