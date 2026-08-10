// Guards for the shared content modules introduced in P2.
//
// The point of extracting symptomatic medication and harm reduction into data
// modules was that four copies of the same list had already drifted apart. So
// these assert the properties that make one copy worth having: every page that
// shows a block gets it from the module, every dose has a daily maximum where
// the guideline gives one, and no placeholder points at a set that is missing.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SYMPTOMATIC, SYMPTOMATIC_UNIVERSAL } from '../data/symptomatic.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const linesOf = (set) => set.items.flatMap((i) => i.lines).join('\n');

describe('P2-08 — shared symptomatic medications', () => {
    test('every placeholder in index.html resolves to a defined set', () => {
        const used = [...read('index.html').matchAll(/data-symptomatic="([^"]+)"/g)].map((m) => m[1]);
        assert.ok(used.length >= 4, `only ${used.length} pages use the shared block`);
        for (const key of used) {
            assert.ok(SYMPTOMATIC[key], `index.html asks for symptomatic set "${key}", which does not exist`);
        }
    });

    test('the four pages no longer carry their own copies', () => {
        const html = read('index.html');
        // The old lists all named metoclopramide inline. Now it appears only in
        // the data module, so any inline occurrence is a copy creeping back.
        assert.ok(!/Metoclopramide/i.test(html),
            'a symptomatic list has been inlined into index.html again — it will drift from the module');
    });

    test('psychostimulant doses all carry a daily maximum', () => {
        const text = linesOf(SYMPTOMATIC.psychostimulant);
        assert.ok(/maximum 40mg\/day over 3 days/.test(text), 'diazepam daily maximum missing');
        assert.ok(/maximum 20mg\/24 hours/.test(text), 'olanzapine daily maximum missing');
        assert.ok(/maximum 150mg\/24 hours/.test(text), 'quetiapine daily maximum missing');
    });

    test('the clonidine test-dose protocol is complete', () => {
        const text = linesOf(SYMPTOMATIC.opioid);
        assert.ok(/75-150 microgram every 6-8 hours/.test(text),
            'clonidine dosing does not match NSWCG Table 8.6');
        for (const part of [/75 microgram/, /lying and standing/, /30 minutes/,
            /systolic &lt; 90/, /diastolic &lt; 50/, /heart rate &lt; 50/,
            /impaired circulation/, /rebound hypertension/]) {
            assert.ok(part.test(text), `clonidine test-dose protocol missing: ${part}`);
        }
    });

    test('octreotide is present, second line, and hospital-only', () => {
        const text = linesOf(SYMPTOMATIC.opioid);
        assert.ok(/Octreotide 0\.05-0\.1mg subcutaneously every 8-12 hours PRN/.test(text),
            'octreotide is missing or misdosed');
        assert.ok(/Hospital setting only/i.test(text), 'octreotide is not restricted to hospital');
    });

    test('z-drugs are offered for sleep in cannabis and gabapentinoid withdrawal', () => {
        for (const key of ['cannabis', 'gabapentinoid']) {
            const text = linesOf(SYMPTOMATIC[key]);
            assert.ok(/zolpidem 10-20mg nocte/i.test(text), `${key}: zolpidem missing`);
            assert.ok(/zopiclone 7\.5-15mg nocte/i.test(text), `${key}: zopiclone missing`);
        }
    });

    test('the local antipsychotic-first-line preference keeps its rationale', () => {
        const text = linesOf(SYMPTOMATIC.cannabis);
        assert.ok(/Local preference/.test(text) && /src-local/.test(text),
            'the cannabis antipsychotic preference lost its LOCAL tag');
        assert.ok(/substituting\s+dependence/.test(text.replace(/\s+/g, ' ')),
            'the rationale for preferring an antipsychotic was dropped');
    });

    test('the universal rules are stated once and apply everywhere', () => {
        const joined = SYMPTOMATIC_UNIVERSAL.join('\n');
        for (const rule of [/not continued beyond 7 days/, /1-2 days before discharge/,
            /Supervise access/, /caution with any psychoactive medication/, /NRT/]) {
            assert.ok(rule.test(joined), `universal rule missing: ${rule}`);
        }
    });

    test('every set names a source or declares itself local', () => {
        for (const [key, set] of Object.entries(SYMPTOMATIC)) {
            for (const item of set.items) {
                for (const line of item.lines) {
                    // A line may be pure instruction with no dose; only dosing
                    // lines need provenance.
                    if (!/\d\s?(mg|microgram|g\b)/i.test(line)) continue;
                    assert.ok(/src-tag/.test(line),
                        `${key} / ${item.symptom}: a dosing line carries no source tag:\n  ${line.slice(0, 90)}`);
                }
            }
        }
    });
});
