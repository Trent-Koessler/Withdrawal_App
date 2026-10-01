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

    test('symptom-triggered AWS keeps NSWCG doses and explains why', () => {
        for (const benzo of ['Diazepam', 'Oxazepam']) {
            const cell = REGIMEN_CONFIG[benzo].symptom;
            assert.ok(cell.caveatAws && /same dose whichever scale/.test(cell.caveatAws),
                `${benzo}: no AWS dose explanation`);
        }
    });

    test('Benzo Choice steers elderly/frail away from a fixed schedule', () => {
        assert.ok(/Elderly or frail patients:<\/b> prefer symptom-triggered dosing/.test(read('index.html')));
    });
});
