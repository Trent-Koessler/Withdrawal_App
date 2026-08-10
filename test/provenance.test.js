// Provenance guards for the source-tag system (AUTH-01).
//
// The site's authority comes from its deviations from published guidance being
// visible rather than hidden. That only holds if the tags stay honest, so these
// assert the rules of the tagging convention itself:
//
//   - a chip always declares which of the four kinds it is;
//   - anything claiming NSWCG cites a section;
//   - anything NOT traceable to a guideline (LOCAL, NSWCG-adapted) states why.
//
// They check the markup rather than the rendered DOM, which is the whole
// surface: every clinical statement in this app is either literal HTML in
// index.html or a string in data/*.js.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

const SOURCES = ['index.html', 'data/regimens.js', 'data/scales.js',
    'data/symptomatic.js', 'data/harm-reduction.js', 'data/content-meta.js'];

const KINDS = ['src-nswcg-adapted', 'src-nswcg', 'src-local', 'src-other'];

// <span class="src-tag src-local">…</span>, in HTML or inside a JS template
// string. Non-greedy so adjacent chips do not merge into one match.
const CHIP = /<span class="src-tag ([^"]*)">([\s\S]*?)<\/span>/g;

function chips() {
    const all = [];
    for (const file of SOURCES.filter((f) => fs.existsSync(path.join(ROOT, f)))) {
        const text = read(file);
        for (const [, classes, body] of text.matchAll(CHIP)) {
            all.push({ file, classes, body: body.replace(/\s+/g, ' ').trim() });
        }
    }
    return all;
}

describe('source tags', () => {
    // A floor, not a target. Raised as the retrofit progressed so that deleting
    // the tagging wholesale cannot pass silently.
    test('the app actually carries provenance tags', () => {
        assert.ok(chips().length >= 8,
            `only ${chips().length} source tags found — the retrofit is incomplete`);
    });

    test('every chip declares exactly one kind', () => {
        for (const chip of chips()) {
            const kinds = KINDS.filter((k) => chip.classes.split(/\s+/).includes(k));
            assert.equal(kinds.length, 1,
                `${chip.file}: chip "${chip.body}" has classes "${chip.classes}" — expected exactly one of ${KINDS.join(', ')}`);
        }
    });

    // A bare "NSWCG" chip is unfalsifiable: a reader cannot check it. Every one
    // must name the section or appendix it came from.
    test('NSWCG chips cite a section or appendix', () => {
        for (const chip of chips()) {
            if (!chip.classes.includes('src-nswcg')) continue;
            assert.ok(/§|App\s|Table\s/.test(chip.body),
                `${chip.file}: "${chip.body}" claims NSWCG but cites no section`);
        }
    });

    // The core requirement of the revision: content that is not traceable to a
    // published guideline has to say why it departs from one.
    test('LOCAL and NSWCG-adapted chips state a rationale', () => {
        for (const chip of chips()) {
            const needsWhy = chip.classes.includes('src-local')
                || chip.classes.includes('src-nswcg-adapted');
            if (!needsWhy) continue;
            assert.ok(/rationale:/i.test(chip.body),
                `${chip.file}: "${chip.body}" is local/adapted content with no "rationale:"`);
            const rationale = chip.body.split(/rationale:/i)[1] || '';
            assert.ok(rationale.trim().length > 15,
                `${chip.file}: "${chip.body}" has a rationale too short to be one`);
        }
    });

    test('OTHER chips name their source', () => {
        for (const chip of chips()) {
            if (!chip.classes.split(/\s+/).includes('src-other')) continue;
            assert.ok(chip.body.replace(/^OTHER\s*[—-]?\s*/i, '').trim().length > 2,
                `${chip.file}: "${chip.body}" is tagged OTHER but names no guideline`);
        }
    });

    test('every tag kind used in markup has a style rule', () => {
        const css = read('style.css');
        for (const kind of KINDS) {
            assert.ok(css.includes(`.${kind}`), `no CSS rule for .${kind}`);
        }
        assert.ok(css.includes('@media print'),
            'tags must remain visible in print output, not only on screen');
    });
});

describe('clinical TODO markers', () => {
    // Markers are HTML/JS comments so clinicians never see them; the tool is
    // the only thing that makes them visible, so it has to keep working.
    test('check-todos finds the markers that exist in the source', () => {
        const marked = SOURCES
            .filter((f) => fs.existsSync(path.join(ROOT, f)))
            .flatMap((f) => [...read(f).matchAll(/TODO\((clinical|review)\):/g)]);
        assert.ok(marked.length > 0,
            'no TODO markers anywhere — open clinical decisions should be recorded, not guessed');
    });

    test('every marker asks an answerable question', () => {
        for (const file of SOURCES) {
            if (!fs.existsSync(path.join(ROOT, file))) continue;
            for (const line of read(file).split('\n')) {
                const m = line.match(/TODO\((?:clinical|review)\):\s*(.*)/);
                if (!m) continue;
                const question = m[1].replace(/(-->|\*\/)\s*$/, '').trim();
                assert.ok(question.length > 20,
                    `${file}: marker "${question}" is too vague to action`);
            }
        }
    });

    test('markers never render to a clinician', () => {
        // In index.html a marker outside an HTML comment would be visible text
        // on the page. Check each marker sits inside <!-- ... -->.
        const html = read('index.html');
        const comments = [...html.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0]).join('\n');
        const inHtml = [...html.matchAll(/TODO\((?:clinical|review)\):/g)].length;
        const inComments = [...comments.matchAll(/TODO\((?:clinical|review)\):/g)].length;
        assert.equal(inHtml, inComments,
            'a TODO marker in index.html is outside an HTML comment and would render to users');
    });
});
