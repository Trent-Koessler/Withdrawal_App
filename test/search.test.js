// Search ranking. The DOM half of search.js (building the index, revealing a
// section) is exercised in the browser; this covers the part that decides what
// comes first, which is where a regression would quietly send a clinician to
// the wrong page.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { normalise, searchEntries, snippetFor } from '../search.js';

const ENTRIES = [
    { pageId: 'scales-page', pageTitle: 'Clinical Scales & Calculators', heading: 'Clinical Opiate Withdrawal Scale (COWS)', text: 'Resting pulse rate, sweating, restlessness', isPage: false },
    { pageId: 'opioid-withdrawal-page', pageTitle: 'Opioid Withdrawal', heading: 'Opioid Withdrawal', text: 'Score with COWS before the first dose of buprenorphine.', isPage: true },
    { pageId: 'inpatient-guidelines-page', pageTitle: 'Inpatient Alcohol Withdrawal Guidelines', heading: 'Thiamine', text: 'Give parenteral thiamine before glucose.', isPage: false },
    { pageId: 'ghb-withdrawal-page', pageTitle: 'GHB Withdrawal', heading: 'GHB Withdrawal', text: 'Benzodiazepines are the primary treatment.', isPage: true },
    { pageId: 'drug-screening-page', pageTitle: 'Drug Screening', heading: 'Drug Screening', text: 'Interpreting a urine drug screen.', isPage: true },
];

describe('search', () => {
    test('normalise folds case, accents and punctuation', () => {
        assert.equal(normalise('CIWA-Ar'), 'ciwa ar');
        assert.equal(normalise('  Café  (Test) '), 'cafe test');
    });

    test('an empty query returns nothing rather than everything', () => {
        assert.deepEqual(searchEntries(ENTRIES, '   '), []);
    });

    test('a heading match outranks a body-text mention', () => {
        const results = searchEntries(ENTRIES, 'cows');
        assert.equal(results[0].heading, 'Clinical Opiate Withdrawal Scale (COWS)');
        assert.equal(results[0].matchedIn, 'heading');
        assert.equal(results[1].pageId, 'opioid-withdrawal-page');
        assert.equal(results[1].matchedIn, 'text');
        assert.match(results[1].snippet, /COWS/);
    });

    test('every word must match, so more words narrow the results', () => {
        assert.equal(searchEntries(ENTRIES, 'withdrawal').length, 4);
        assert.deepEqual(searchEntries(ENTRIES, 'ghb withdrawal').map(r => r.pageId), ['ghb-withdrawal-page']);
        assert.deepEqual(searchEntries(ENTRIES, 'ghb thiamine'), []);
    });

    test('a common abbreviation finds the full name', () => {
        assert.equal(searchEntries(ENTRIES, 'bupe')[0].pageId, 'opioid-withdrawal-page');
        assert.equal(searchEntries(ENTRIES, 'gbl')[0].pageId, 'ghb-withdrawal-page');
        assert.equal(searchEntries(ENTRIES, 'uds')[0].pageId, 'drug-screening-page');
    });

    test('results are capped', () => {
        const many = Array.from({ length: 30 }, (_, i) => ({ heading: `Scale ${i}`, pageTitle: 'P', text: '' }));
        assert.equal(searchEntries(many, 'scale').length, 12);
        assert.equal(searchEntries(many, 'scale', 5).length, 5);
    });

    test('snippets are cut around the first match', () => {
        const text = 'a '.repeat(100) + 'thiamine' + ' b'.repeat(100);
        const snippet = snippetFor(text, ['thiamine'], 20);
        assert.match(snippet, /^….*thiamine.*…$/);
        assert.ok(snippet.length < 50);
    });
});
