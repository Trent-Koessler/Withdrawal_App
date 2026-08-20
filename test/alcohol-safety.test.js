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
    cell.name,
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

    test('the escalation block exists once as static markup, not duplicated per severity', () => {
        // Now lives on its own Monitoring, Escalation & Discharge tab rather than
        // stacked above #regimen-display within the Regimens tab, so it applies
        // regardless of the selected severity without being regenerated per cell.
        const matches = html.match(/class="escalation-box"/g);
        assert.ok(matches, 'no escalation block found');
        assert.equal(matches.length, 1,
            'the escalation block should exist once, not be repeated per severity');
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
            assert.ok(cell.bands && cell.bands.length === 3,
                `${benzo} symptom-triggered has no three-band dosing list`);
        }
    });

    // A list, not a table: this block is pasted into an EMR field, where a
    // table degrades into unreadable pipe-separated rows. The guard is that the
    // dosing data stays structured — one entry per band, not prose.
    test('the bands carry the NSWCG thresholds, doses and monitoring frequencies', () => {
        const { bands } = REGIMEN_CONFIG.Diazepam.symptom;
        assert.deepEqual(bands.map((b) => b.ciwa), ['&lt; 10', '10-20', '&gt; 20']);
        assert.deepEqual(bands.map((b) => b.aws), ['&lt; 4', '4-14', '&gt; 14']);
        assert.deepEqual(bands.map((b) => b.dose),
            ['0-5mg diazepam', '10mg diazepam', '20mg diazepam']);
        assert.deepEqual(bands.map((b) => b.monitoring),
            ['4-6 hourly', '2-4 hourly', 'hourly']);
    });

    test('no dosing block renders as a table any more', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const [severity, cell] of Object.entries(REGIMEN_CONFIG[benzo])) {
                if (!cell || typeof cell !== 'object') continue;
                assert.ok(!cell.table,
                    `${benzo}/${severity} carries a dose table again — it will not survive a paste into the EMR`);
            }
        }
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

// The Regimens tab now renders one scale at a time, so the guard moves from
// the rendered title to the data: a band must carry BOTH thresholds even
// though only one is ever shown. The toggle picks a view; it must never be the
// reason a ward's scale has no threshold to show.
describe('P1-02 — no band is expressed in one scale only', () => {
    test('every band carries a CIWA-Ar and an AWS threshold', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const [severity, cell] of Object.entries(REGIMEN_CONFIG[benzo])) {
                if (!cell || typeof cell !== 'object') continue;
                for (const b of [...(cell.band ? [cell.band] : []), ...(cell.bands || [])]) {
                    assert.ok(b.ciwa, `${benzo}/${severity} has a band with no CIWA-Ar threshold`);
                    assert.ok(b.aws, `${benzo}/${severity} has a band with no AWS threshold`);
                }
            }
        }
    });

    // A band stores thresholds only ('10-15'); the renderer supplies the scale
    // name. A name baked into the data would survive a toggle it does not match.
    test('bands store thresholds, not scale names', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const [severity, cell] of Object.entries(REGIMEN_CONFIG[benzo])) {
                if (!cell || typeof cell !== 'object') continue;
                for (const b of [...(cell.band ? [cell.band] : []), ...(cell.bands || [])]) {
                    assert.ok(!/CIWA|AWS/i.test(`${b.ciwa} ${b.aws}`),
                        `${benzo}/${severity} bakes a scale name into a band threshold`);
                }
            }
        }
    });

    test('every severity that has a band names the band it applies to', () => {
        for (const benzo of Object.keys(REGIMEN_CONFIG)) {
            for (const severity of ['submild', 'mild', 'moderate', 'severe']) {
                assert.ok(REGIMEN_CONFIG[benzo][severity].band,
                    `${benzo}/${severity} renders a schedule with no band attached`);
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
        assert.ok(/AWS 4-7/.test(regimens) && /AWS 8-14/.test(regimens)
            && /AWS &gt; 14/.test(regimens),
            'the severity buttons do not carry AWS equivalents');
    });

    // The two fixed schedules used to share one AWS band (NSWCG's 4-14), so an
    // AWS score could not choose between them. They are now split at 7/8, per
    // AGTAP Table 8.4 and p111. The split has to stay a partition of NSWCG's
    // range: a gap would leave a score with no schedule, an overlap would put
    // it back where it started, and running past 4-14 would contradict NSWCG
    // rather than subdivide it.
    test('the two fixed schedules partition NSWCG\'s AWS 4-14 exactly', () => {
        for (const [benzo, config] of Object.entries(REGIMEN_CONFIG)) {
            const parse = (b) => b.split('-').map(Number);
            const [mildLo, mildHi] = parse(config.mild.band.aws);
            const [modLo, modHi] = parse(config.moderate.band.aws);
            assert.equal(mildLo, 4, `${benzo}: Mild-Moderate does not start at NSWCG's 4`);
            assert.equal(modHi, 14, `${benzo}: Moderate-Severe does not end at NSWCG's 14`);
            assert.equal(modLo, mildHi + 1,
                `${benzo}: AWS ${config.mild.band.aws} and ${config.moderate.band.aws} `
                + 'leave a gap or overlap — every score in 4-14 must select exactly one schedule');
        }
    });

    // Each schedule's own band is the lower PRN trigger, and the band above it
    // is the higher one. If the bands move and the triggers do not, a patient
    // scoring into the next band up gets the wrong rescue dose.
    test('PRN triggers carry the same AWS bands as the schedules', () => {
        for (const [benzo, config] of Object.entries(REGIMEN_CONFIG)) {
            const expected = { '10-15': config.mild.band.aws, '15-20': config.moderate.band.aws };
            for (const severity of ['mild', 'moderate']) {
                for (const entry of config[severity].prn) {
                    if (typeof entry !== 'object' || !entry.range) continue;
                    assert.equal(entry.aws, expected[entry.range],
                        `${benzo}/${severity}: PRN at CIWA ${entry.range} is labelled AWS `
                        + `${entry.aws}, but that CIWA band is AWS ${expected[entry.range]}`);
                }
            }
        }
    });

    // The band boundaries are AGTAP's; the observation frequency stays NSWCG's.
    // Adopting one without saying so about the other is the failure mode here:
    // AGTAP rescores 1-2 hourly above AWS 7, and a reader who takes the bands
    // from AGTAP is entitled to know the app did not take the monitoring too.
    test('the caveat cites AGTAP for the split and states its monitoring position', () => {
        const caveats = REGIMEN_CONFIG.Diazepam.mild.caveat.join('\n');
        assert.ok(/Table 8\.4/.test(caveats) && /p111/.test(caveats),
            'the AWS split is AGTAP-derived but the caveat cites neither Table 8.4 nor p111');
        assert.ok(/1-2 hourly/.test(caveats) && /2-4 hourly/.test(caveats),
            'the caveat does not state that AGTAP monitors more frequently than the app does');
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

describe('P1-05 — band selection carries risk modifiers, not intake alone', () => {
    const html = read('index.html');
    // Band selection lives on its own Assessment & Banding tab, ahead of Regimens.
    const regimens = html.slice(html.indexOf('<div id="assessment-banding"'),
        html.indexOf('<div id="regimens"'));

    test('the standard-drink split is tagged as local practice', () => {
        assert.ok(/standard drinks per\s+day split is not from NSWCG/.test(regimens),
            'the drink-count entry point is not disclosed as local');
    });

    test('all five NSWCG risk factors are listed as band modifiers', () => {
        for (const factor of [
            /[Pp]revious severe withdrawal/,
            /BAL on arrival/,
            /[Cc]oexisting medical conditions/,
            /[Ss]eizures early in withdrawal/,
            /other CNS depressants/,
        ]) {
            assert.ok(factor.test(regimens), `risk factor missing: ${factor}`);
        }
    });
});

describe('P1-06 — loading rate', () => {
    const severe = textOf(REGIMEN_CONFIG.Diazepam.severe);

    test('the default loading rate is the NSWCG 2-hourly rate', () => {
        assert.ok(/20mg <b>2-hourly<\/b>/.test(severe),
            'the default loading rate is not 2-hourly; NSWCG Table 5.4 specifies 2-hourly');
    });

    test('hourly loading survives only as a delirium-tremens, monitored-setting option', () => {
        const hourly = severe.match(/[^`]*20mg hourly[^`]*/);
        assert.ok(hourly, 'the hourly option was removed rather than restricted');
        assert.ok(/delirium/i.test(hourly[0]),
            'hourly loading is offered outside the delirium tremens indication it is scoped to');
        assert.ok(/monitored setting|HDU/i.test(hourly[0]),
            'hourly loading is offered without restricting it to a monitored setting');
        assert.ok(/src-nswcg/.test(hourly[0]),
            'the DT hourly rate matches NSWCG §5.6.2 and should not be tagged LOCAL');
        assert.ok(/peaks at around one hour/i.test(severe),
            'the reason hourly dosing stacks doses outside DT is not explained');
    });
});

describe('P1-07 — setting is decided before the drug chart', () => {
    test('the severe cell carries a setting block', () => {
        const cell = REGIMEN_CONFIG.Diazepam.severe;
        assert.ok(cell.setting, 'severe withdrawal has no setting guidance');
        const text = cell.setting.join('\n');
        assert.ok(/HDU/.test(text) && /ICU/.test(text), 'HDU and ICU are not both addressed');
    });

    test('HDU is no longer buried in the PRN list', () => {
        const prn = (REGIMEN_CONFIG.Diazepam.severe.prn || [])
            .filter((p) => typeof p === 'string').join('\n');
        assert.ok(!/Manage in HDU/.test(prn),
            'setting guidance is still filed under PRN dosing');
    });

    test('the NSWCG indications for specialist inpatient care are listed', () => {
        const text = REGIMEN_CONFIG.Diazepam.severe.setting.join('\n');
        for (const indication of [
            /predicted moderate-severe withdrawal/i,
            /delirium or seizures/i,
            /multiple drug dependencies/i,
            /significant other medical problems/i,
            /repeated inability to complete community withdrawal/i,
        ]) {
            assert.ok(indication.test(text), `indication missing: ${indication}`);
        }
    });
});

describe('P1-08 — severe / delirium content', () => {
    const html = read('index.html');
    const special = html.slice(html.indexOf('<div id="special-cases"'),
        html.indexOf('id="ambulatory-guidelines-page"'));

    test('DT is presented as a diagnosis of exclusion with the differential listed', () => {
        assert.ok(/diagnosis of exclusion/i.test(special), 'DT is not framed as a diagnosis of exclusion');
        // Flattened: the markup wraps, so a differential can straddle a newline.
        const flat = special.replace(/\s+/g, ' ');
        for (const cause of ['subdural haematoma', "Wernicke's encephalopathy", 'hepatic encephalopathy',
            'hypoxia', 'sepsis', 'metabolic disturbance', 'head injury']) {
            assert.ok(flat.includes(cause), `differential missing: ${cause}`);
        }
    });

    test('the counterintuitive dose-reduction advice is present and prominent', () => {
        assert.ok(/dose reduction rather\s+than escalation/i.test(special),
            'the advice to consider reducing benzodiazepines in persistent delirium is missing');
        assert.ok(/high-dose benzodiazepines can themselves produce delirium/i.test(special),
            'the reason for it is not given, which is what makes it actionable');
    });

    test('non-oral escalation options are given', () => {
        assert.ok(/IV\s+midazolam infusion/i.test(special.replace(/\s+/g, ' ')), 'IV midazolam option missing');
        assert.ok(/IM lorazepam/i.test(special), 'IM lorazepam fallback missing');
        assert.ok(/light sleep, readily rousable/i.test(special), 'the sedation target is missing');
    });

    test('prophylactic anticonvulsants are explicitly stated to have no benefit', () => {
        assert.ok(/no benefit/i.test(special) && /phenytoin/i.test(special)
            && /carbamazepine/i.test(special) && /sodium valproate/i.test(special),
            'the anticonvulsant non-recommendation is missing or incomplete');
    });

    test('severe chronic airflow limitation excludes loading', () => {
        const cal = special.slice(special.indexOf('chronic airflow limitation'));
        assert.ok(/Do not use loading regimens/i.test(cal), 'loading is not excluded for severe CAL');
        assert.ok(/temazepam or oxazepam/i.test(cal), 'the short-acting alternatives are missing');
    });

    test('DT patients are stated to be unable to self-discharge', () => {
        assert.ok(/[Ss]elf-discharge is not acceptable/.test(special),
            'the statement that DT patients are mentally disordered is missing');
    });
});

describe('P1-09 — the test-dose protocol declares itself as local', () => {
    for (const benzo of ['Diazepam', 'Oxazepam']) {
        const cell = REGIMEN_CONFIG[benzo].unknown;

        test(`${benzo}: the protocol is tagged LOCAL with a rationale`, () => {
            const caveats = cell.caveat.join('\n');
            assert.ok(/src-local/.test(caveats),
                'a protocol absent from NSWCG must not read as guideline content');
            assert.ok(/rationale:/i.test(caveats), 'no rationale given for preferring it');
        });

        test(`${benzo}: NSWCG's own answer to uncertain tolerance is stated`, () => {
            assert.ok(/symptom-triggered/i.test(cell.caveat.join('\n')),
                'the guideline alternative (symptom-triggered dosing, smaller first dose) is not offered');
        });

        test(`${benzo}: the test dose matches the current local figure`, () => {
            const text = textOf(cell);
            const expectedDose = benzo === 'Diazepam' ? '10mg' : '30mg';
            assert.ok(text.includes(`${benzo} ${expectedDose} orally`),
                `expected a single ${expectedDose} test dose, no separate reduced tier`);
            assert.ok(!/[Rr]educed test dose/.test(text),
                'the reduced-dose tier was retired; this benzo still offers one');
        });

        test(`${benzo}: assessment is not left at 1 hour alone`, () => {
            const text = textOf(cell);
            assert.ok(/again at 2 hours/i.test(text), 'no 2-hour reassessment');
            assert.ok(/weak evidence of tolerance/i.test(text),
                'the limits of a 1-hour reading are not stated');
        });

        test(`${benzo}: sedation is assessed with a charted scale`, () => {
            assert.ok(/charted scale/i.test(textOf(cell)),
                'sedation is still defined by a descriptive list, which is not reproducible');
        });
    }
});

describe('P1-10 — incomplete taper at discharge', () => {
    const html = read('index.html');

    test('both pathways specify 24-hourly staged supply', () => {
        for (const [name, section] of [
            ['inpatient', html.slice(html.indexOf('<div id="regimens"'), html.indexOf('<div id="special-cases"'))],
            ['ambulatory', html.slice(html.indexOf('<div id="ambulatory-meds"'), html.indexOf('<div id="ambulatory-escalation"'))],
        ]) {
            const flat = section.replace(/\s+/g, ' ');
            assert.ok(/24 hours of medication at a time|24 hours of medication<\/strong> at a time/.test(flat),
                `${name}: staged supply is not specified as 24 hours at a time`);
            assert.ok(/[Ll]imit benzodiazepine use to 5-7 days/.test(flat),
                `${name}: the 5-7 day limit is missing`);
        }
    });

    test('the risks of unsupervised self-medication are spelled out', () => {
        const flat = html.replace(/\s+/g, ' ');
        assert.ok(/overdose, undiagnosed complications, and failure to complete/.test(flat),
            'the three risks a patient should be told about are not enumerated');
    });
});
