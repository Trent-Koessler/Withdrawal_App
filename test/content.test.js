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
import { HARM_REDUCTION } from '../data/harm-reduction.js';
import { BENZO_EQUIVALENCE, EQUIVALENCE_CAVEATS } from '../data/benzo-equivalence.js';
import { SCALES, SCALE_CAVEATS_UNIVERSAL } from '../data/scales.js';
import { CONTENT_META, formatReviewMonth } from '../data/content-meta.js';

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

    test('cannabis anxiety/agitation matches NSWCG Table 6.2, not the retired local preference', () => {
        const text = linesOf(SYMPTOMATIC.cannabis);
        assert.ok(/5-10mg oral BD or TDS PRN/.test(text), 'the Table 6.2 diazepam dose range is missing');
        assert.ok(/olanzapine 2\.5-5mg oral BD PRN/.test(text), 'the Table 6.2 olanzapine option is missing');
        assert.ok(!/quetiapine 25-50mg TDS/.test(text),
            'the retired local antipsychotic-first-line dose is still present, conflicting with the Table 6.2 figure');
    });

    test('the universal rules are stated once and apply everywhere', () => {
        const joined = SYMPTOMATIC_UNIVERSAL.join('\n');
        for (const rule of [/not continued beyond 7 days/, /1-2 days before discharge/,
            /Supervise access/, /caution with any psychoactive medication/]) {
            assert.ok(rule.test(joined), `universal rule missing: ${rule}`);
        }
        assert.ok(!/NRT/.test(joined),
            'the cannabis-specific NRT/tobacco line crept back into the rules rendered on every substance page');
    });

    test('NRT advice is scoped to cannabis, not rendered on unrelated substance pages', () => {
        assert.ok(/NRT/.test(linesOf(SYMPTOMATIC.cannabis)), 'NRT advice missing from cannabis');
        for (const key of ['opioid', 'gabapentinoid', 'psychostimulant']) {
            assert.ok(!/mixed cannabis with tobacco/.test(linesOf(SYMPTOMATIC[key])),
                `${key}: cannabis-specific NRT wording should not appear here`);
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

describe('P2-06 — shared harm reduction', () => {
    test('every placeholder resolves, and every set is used somewhere', () => {
        const used = [...read('index.html').matchAll(/data-harm-reduction="([^"]+)"/g)].map((m) => m[1]);
        for (const key of used) {
            assert.ok(HARM_REDUCTION[key], `index.html asks for harm reduction set "${key}", which does not exist`);
        }
        for (const key of Object.keys(HARM_REDUCTION)) {
            assert.ok(used.includes(key), `harm reduction set "${key}" is defined but rendered nowhere`);
        }
    });

    test('reduced tolerance appears on every substance', () => {
        for (const [key, blocks] of Object.entries(HARM_REDUCTION)) {
            const text = blocks.flatMap((b) => b.points).join('\n');
            assert.ok(/[Tt]olerance falls after/.test(text),
                `${key}: the reduced-tolerance warning is missing — it applies after every withdrawal episode`);
        }
    });

    test('take-home naloxone survived the refactor', () => {
        const opioid = HARM_REDUCTION.opioid.flatMap((b) => b.points).join('\n');
        assert.ok(/Nyxoid/.test(opioid) && /Prenoxad/.test(opioid),
            'the take-home naloxone content was lost when the bespoke section was replaced');
    });

    test('substance-specific advice is actually substance-specific', () => {
        const points = (key) => HARM_REDUCTION[key].flatMap((b) => b.points).join('\n');
        assert.ok(/soy sauce containers/.test(points('ghb')), 'GHB storage warning missing');
        assert.ok(/bucket bongs/.test(points('cannabis')), 'cannabis inhalation advice missing');
        assert.ok(/alternate/i.test(points('alcohol')), 'alcohol-specific advice missing');
        assert.ok(/Pyrex/.test(points('psychostimulant')), 'pipe hygiene missing from psychostimulants');
    });

    test('every block cites a source', () => {
        for (const [key, blocks] of Object.entries(HARM_REDUCTION)) {
            for (const block of blocks) {
                assert.ok(/src-tag/.test(block.source || ''),
                    `${key} / "${block.heading}" has no source tag`);
            }
        }
    });
});

describe('P2-01 — gabapentinoids', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="gabapentinoid-withdrawal-page"'),
        html.indexOf('<!-- GHB Withdrawal Page -->'));

    test('the page exists and is reachable from Other Substances', () => {
        assert.ok(page.length > 500, 'the gabapentinoid page is missing or empty');
        assert.ok(/data-page="gabapentinoid-withdrawal-page"/.test(html),
            'nothing navigates to the gabapentinoid page');
    });

    test('the counterintuitive risk — therapeutic doses, short duration — is prominent', () => {
        const flat = page.replace(/\s+/g, ' ');
        assert.ok(/as little as <strong>4 weeks<\/strong>/.test(flat), 'the 4-week onset risk is missing');
        assert.ok(/pregabalin ≤300mg/.test(flat) && /gabapentin ≤3600mg/.test(flat),
            'withdrawal at therapeutic doses is not stated');
    });

    test('the taper hand-over thresholds are given', () => {
        const flat = page.replace(/\s+/g, ' ');
        assert.ok(/pregabalin 600mg or gabapentin 3600mg/.test(flat), 'starting doses missing');
        assert.ok(/pregabalin 300mg\/day or gabapentin 1800mg\/day/.test(flat), 'hand-over threshold missing');
        assert.ok(/5-7 days/.test(flat) && /4-6 weeks/.test(flat), 'taper durations missing');
        assert.ok(/at least 24 hours/.test(flat), 'the 24-hour observation for overstated dose is missing');
    });

    test('renal function and the absence of a validated scale are both stated', () => {
        assert.ok(/[Rr]enal function is the key assessment/.test(page.replace(/\s+/g, ' ')),
            'renal assessment is missing');
        assert.ok(/No validated withdrawal scale exists/.test(page),
            'the app must not imply a gabapentinoid scale exists');
    });

    test('it uses the shared symptomatic and harm reduction blocks', () => {
        assert.ok(/data-symptomatic="gabapentinoid"/.test(page));
        assert.ok(/data-harm-reduction="gabapentinoid"/.test(page));
    });
});

describe('P2-02 — GHB', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="ghb-withdrawal-page"'),
        html.indexOf('<!-- Nicotine Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('all six predictors of severe withdrawal are listed', () => {
        for (const predictor of [/2-4 hours or less/, /15 mL\/day/, /within 2-3 hours/,
            /[Ww]aking overnight to dose/, /Previous severe withdrawal/,
            /No GHB-free days for 4-6 weeks/]) {
            assert.ok(predictor.test(flat), `predictor missing: ${predictor}`);
        }
    });

    test('the dosing ladder and its escalation points are given', () => {
        assert.ok(/[Dd]iazepam 10-20mg every 1-2 hours/.test(flat), 'primary dosing missing');
        assert.ok(/within 2 hours of the last dose/.test(flat), 'the early-commencement rule is missing');
        assert.ok(/before exceeding 120mg diazepam in the first 24 hours/.test(flat),
            'the 120 mg medical officer review point is missing');
        assert.ok(/150-200mg diazepam in 24 hours/.test(flat), 'the ICU referral threshold is missing');
        assert.ok(/approximately <strong>7 days<\/strong>/.test(flat), 'the wean duration is missing');
    });

    test('baclofen is present with its dispensing restriction', () => {
        assert.ok(/baclofen 10-25mg TDS/i.test(flat), 'baclofen dosing missing');
        assert.ok(/dispense weekly from a community pharmacy/i.test(flat),
            'the weekly dispensing restriction is what makes baclofen safe to continue');
    });

    test('creatine kinase is in the monitoring set', () => {
        assert.ok(/creatine kinase/i.test(flat), 'CK is missing from GHB monitoring');
    });

    test('the absence of a validated scale is stated', () => {
        assert.ok(/No validated withdrawal scale exists for GHB/.test(flat),
            'the app must say no GHB scale is validated, or the calculators invite misuse');
    });
});

describe('P2-03 — benzodiazepine framework', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="benzo-withdrawal-page"'),
        html.indexOf('<!-- Cannabis Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('ODDE is introduced as the organising concept', () => {
        assert.ok(/[Oo]ral daily diazepam equivalent \(ODDE\)/.test(flat), 'ODDE is not defined');
        assert.ok(/≤ 10mg ODDE/.test(flat) && /&gt; 10mg ODDE/.test(flat),
            'the low-dose / high-dose split is not stated');
    });

    test('the equivalence table is rendered from shared data, not inlined', () => {
        assert.ok(/data-benzo-equivalence/.test(page),
            'the equivalence table should render from data/benzo-equivalence.js so HyperTaper can share it');
        assert.equal(BENZO_EQUIVALENCE.length, 9, 'the NSWCG Table 11.2 list is incomplete');
        const byDrug = Object.fromEntries(BENZO_EQUIVALENCE.map((e) => [e.drug, e.mg]));
        assert.deepEqual(byDrug, {
            Alprazolam: 0.5, Bromazepam: 3, Clobazam: 10, Clonazepam: 0.25, Flunitrazepam: 0.5,
            Lorazepam: 1, Nitrazepam: 5, Oxazepam: 15, Temazepam: 10,
        });
    });

    test('the caveats that make the table safe travel with it', () => {
        const caveats = EQUIVALENCE_CAVEATS.join('\n');
        assert.ok(/[Zz]-drug conversion is unclear/.test(caveats), 'z-drug exclusion missing');
        assert.ok(/from clonazepam/.test(caveats), 'the clonazepam warning is missing');
        assert.ok(/[Ll]orazepam may be relatively more potent/.test(caveats), 'the lorazepam warning is missing');
    });

    test('unplanned inpatient withdrawal is covered', () => {
        assert.ok(/BZRA history on admission/.test(flat), 'the admission history prompt is missing');
        assert.ok(/[Dd]o not abruptly discontinue, even low doses/.test(flat),
            'the do-not-stop-abruptly rule is missing');
        assert.ok(/40% of usual intake, or 40mg\/day, whichever is\s*<\/strong>?\s*lower|40% of usual intake, or 40mg\/day, whichever is lower/.test(flat),
            'the stabilisation formula for high-dose patients is missing');
    });

    test('the taper rate and its honesty about duration are stated', () => {
        assert.ok(/10% reduction every 10-14 days/.test(flat), 'taper rate missing');
        assert.ok(/3 months to a year or longer/.test(flat), 'the realistic duration is missing');
        assert.ok(/daily maximum of 40mg diazepam/.test(flat), 'the 40 mg/day protective ceiling is missing');
    });

    test('urine drug screen interpretation is explained', () => {
        assert.ok(/metabolites of diazepam/.test(flat), 'the temazepam/oxazepam metabolite trap is missing');
        assert.ok(/etizolam/.test(flat), 'the newer-BZRA reporting gap is missing');
        assert.ok(/not a basis for punitive measures/.test(flat), 'the framing of UDS as engagement is missing');
    });

    test('non-recommendations are stated as such', () => {
        assert.ok(/Not supported by evidence as taper adjuncts/.test(flat),
            'carbamazepine and pregabalin should be named as unsupported, not simply omitted');
    });
});

describe('P2-05 — continuing care and relapse prevention', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="continuing-care-page"'),
        html.indexOf('<!-- Helpful Contacts Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('AUD pharmacotherapy is named', () => {
        assert.ok(/naltrexone, acamprosate and\s*<\/strong>?\s*disulfiram|naltrexone, acamprosate and disulfiram/.test(flat),
            'the three AUD relapse-prevention agents are not named');
        assert.ok(/Australian\s*Guidelines for the Treatment of Alcohol Problems/.test(flat),
            'no pointer to the guideline that actually carries the dosing');
    });

    test('the opioid non-recommendations are explicit', () => {
        assert.ok(/[Oo]ral naltrexone is not supported/.test(flat), 'oral naltrexone non-recommendation missing');
        assert.ok(/implants are not approved in Australia/.test(flat), 'implant status missing');
        assert.ok(/cannot be recommended/.test(flat), 'rapid naltrexone-assisted withdrawal warning missing');
        assert.ok(/robust evidence base/.test(flat), 'OAT evidence base missing');
    });

    test('reduced-tolerance safety planning is part of completion', () => {
        assert.ok(/[Tt]olerance is lowest at the point of completion/.test(flat),
            'the completion-point overdose risk is not surfaced');
    });

    test('it is reachable from the home page', () => {
        assert.ok(/data-page="continuing-care-page"/.test(html), 'nothing navigates to continuing care');
    });
});

describe('P2-07 — BBV/STI results to actions', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="bbv-sti-page"'),
        html.indexOf('<!-- Continuing Care and Relapse Prevention -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('every result in NSWCG App 9 has an action', () => {
        for (const [result, action] of [
            ['Hepatitis C antibody', /HCV RNA/],
            ['HIV Ag/Ab', /Sexual\s*Health InfoLink|1800 451 624/],
            ['Gonorrhoea PCR', /culture and sensitivity/],
            ['Chlamydia PCR', /STI\s*management guidelines/],
            ['Syphilis', /urgent/],
        ]) {
            assert.ok(flat.includes(result), `result row missing: ${result}`);
            assert.ok(action.test(flat), `action missing for ${result}`);
        }
    });

    test('all five hepatitis B states are covered', () => {
        for (const state of ['susceptible', 'immune, prior infection', 'immune, vaccination',
            'chronic infection', 'indeterminate']) {
            assert.ok(flat.includes(state), `hepatitis B state missing: ${state}`);
        }
    });

    test('syphilis requires both a positive RPR and a treponemal test', () => {
        assert.ok(/positive RPR <strong>and<\/strong> positive TPPA/.test(flat),
            'the syphilis criterion must be both tests, not either');
    });

    test('the InfoLink number is in the contacts directory as well', () => {
        const contacts = html.slice(html.indexOf('id="contacts-page"'), html.indexOf('id="about-page"'));
        assert.ok(/tel:1800451624/.test(contacts), 'NSW Sexual Health InfoLink is not in the contacts directory');
    });
});

describe('P2-13 — screening', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="screening-page"'),
        html.indexOf('<!-- BBV / STI Results to Actions -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('universal screening is stated', () => {
        assert.ok(/admitted to hospital, or presenting to an emergency department, should be\s*<\/strong>?\s*screened|admitted to hospital, or presenting to an emergency department, should be screened/.test(flat),
            'the universal alcohol screening rule is missing');
    });

    test('the opening questions carry the NSWCG thresholds', () => {
        assert.ok(/4 or more days per week/.test(flat), 'the frequency threshold is missing');
        assert.ok(/6 or more standard drinks\s*<\/strong>?\s*on one occasion|6 or more standard drinks on one occasion/.test(flat),
            'the single-occasion threshold is missing');
        for (const q of ['tobacco', 'recreational drugs', 'pain, anxiety or sleep']) {
            assert.ok(flat.includes(q), `screening question missing: ${q}`);
        }
    });

    test('the named tools are listed', () => {
        for (const tool of ['AUDIT', 'ASSIST', 'SDS', 'IRIS', 'Substances and Choices Scale']) {
            assert.ok(flat.includes(tool), `screening tool missing: ${tool}`);
        }
    });

    test('the three practice points are present', () => {
        assert.ok(/document quantities/i.test(flat), 'documenting quantities is missing');
        assert.ok(/polysubstance use/i.test(flat), 'polysubstance prompt is missing');
        assert.ok(/avoid duplicating screening already done/i.test(flat), 'the duplication warning is missing');
    });
});

// P2-04 (assessment, risk and care planning) was removed: the section was
// judged too dependent on clinical judgement for a POC reference tool. Its
// two contact numbers with no other listing in the app (Child Protection
// Helpline, NSW Health Child Wellbeing Unit) were relocated to the Contacts
// page rather than lost; see the "child protection contacts" test below.
// The Screening page it used to be the only route to now has its own
// home-page button.
describe('child protection contacts survive the removal of Before You Prescribe', () => {
    const contacts = read('index.html').split('id="contacts-page"')[1].split('id="about-page"')[0];

    test('the Child Protection Helpline and Child Wellbeing Unit are in the contacts directory', () => {
        assert.ok(/13 21 11/.test(contacts), 'Child Protection Helpline missing from contacts');
        assert.ok(/1300 480 420/.test(contacts), 'NSW Health Child Wellbeing Unit missing from contacts');
    });

    test('Screening has its own home-page entry point', () => {
        const home = read('index.html').split('id="home-page"')[1].split('</nav>')[0];
        assert.ok(/data-page="screening-page"/.test(home),
            'Screening was only reachable from the removed Before You Prescribe section');
    });
});

describe('P2-09 — opioid pathway depth', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="opioid-withdrawal-page"'),
        html.indexOf('<!-- Benzo Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('methadone is offered as an option', () => {
        assert.ok(/already on methadone/.test(flat),
            'the pragmatic methadone-for-methadone-patients approach is missing');
        assert.ok(/[Bb]uprenorphine is preferred<\/strong>? for withdrawal from other opioids|Buprenorphine is preferred for withdrawal from other opioids/.test(flat),
            'the preference order is not stated');
    });

    test('the buprenorphine test-dose protocol is complete', () => {
        assert.ok(/2mg SL test dose/.test(flat), 'test dose missing');
        assert.ok(/[Rr]eview at 1 hour/.test(flat), 'the 1-hour review is missing');
        assert.ok(/further <strong>6mg<\/strong>/.test(flat), 'the second increment is missing');
        assert.ok(/8-12mg outpatient/.test(flat) && /8-16mg inpatient/.test(flat), 'Day 1 totals missing');
    });

    test('the buprenorphine first-dose threshold is the NSWCG figure, not the old local one', () => {
        assert.ok(/COWS &(?:ge|gt);\s*8|COWS\s*8/.test(flat), 'the NSWCG threshold is missing');
        assert.ok(!/COWS &gt; 12/.test(flat), 'the retired local threshold (COWS > 12) is still present');
    });

    test('precipitated withdrawal is distinguished from under-dosing', () => {
        assert.ok(/within 1 hour/.test(flat) && /more than 6 hours/.test(flat),
            'the timing that separates precipitation from under-dosing is missing');
        assert.ok(/COWS increase &gt; 6/.test(flat) && /SOWS\s*increase &gt; 8/.test(flat),
            'the score changes that define precipitated withdrawal are missing');
    });

    test('taper tables exist for both settings', () => {
        assert.ok(/Titrate to comfort, typically 8-16mg daily/.test(flat), 'outpatient taper missing');
        assert.ok(/Day 6: cease/.test(flat), 'inpatient taper missing');
        assert.ok(/[Cc]ease 1-2 days before discharge/.test(flat), 'the rebound assessment is missing');
    });

    test('withdrawal profiles cover the four opioid types', () => {
        for (const profile of [/6-24 hours/, /36-48 hours/, /3-5 days after last dose/, /skin reservoirs/]) {
            assert.ok(profile.test(flat), `withdrawal profile missing: ${profile}`);
        }
    });

    test('NSW regulatory requirements are stated', () => {
        assert.ok(/limited to 14 days by policy directive/.test(flat), 'the 14-day hospital limit is missing');
        assert.ok(/9424 5921/.test(flat), 'the Ministry of Health confirmation line is missing');
        assert.ok(/SafeScript NSW/.test(flat), 'SafeScript is missing');
    });

    test('pain management on buprenorphine is addressed', () => {
        assert.ok(/[Ff]ull agonists remain effective for analgesia/.test(flat),
            'the point that buprenorphine need not be ceased to treat pain is missing');
    });
});

describe('P2-10 — psychostimulant pathway depth', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="stimulant-withdrawal-page"'),
        html.indexOf('<!-- Gabapentinoid Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('the three-phase model is given with time courses for both drugs', () => {
        for (const phase of ['Crash', 'Withdrawal', 'Extinction']) {
            assert.ok(flat.includes(phase), `phase missing: ${phase}`);
        }
        assert.ok(/Methamphetamine/.test(flat) && /Cocaine/.test(flat),
            'the time courses do not distinguish methamphetamine from cocaine');
    });

    test('the complications table covers all three systems', () => {
        for (const c of ['Seizures', 'cardiomyopathy', 'rhabdomyolysis', 'Hyperpyrexia', 'psychosis']) {
            assert.ok(flat.includes(c), `complication missing: ${c}`);
        }
    });

    test('physical assessment and consumption units are stated', () => {
        assert.ok(/nutrition, hydration, weight loss, skin integrity and dental health/.test(flat),
            'the physical assessment set is missing');
        assert.ok(/'points' \(approximately 0\.1g\)/.test(flat), 'consumption units missing');
        assert.ok(/days used in the past 28/.test(flat), 'the 28-day frame is missing');
    });

    test('driving advice carries the Austroads periods and the disclosure obligation', () => {
        assert.ok(/unfit for an unconditional licence/.test(flat), 'the licence status is missing');
        assert.ok(/3 months<\/strong>/.test(flat) && /1 month<\/strong>/.test(flat),
            'the commercial and private conditional-licence periods are missing');
        assert.ok(/legal obligation to disclose/.test(flat), 'the disclosure obligation is missing');
        assert.ok(/Document the advice you gave/.test(flat), 'the prompt to document is missing');
    });

    // Introduced here as a note; AUTH-05 moved it into the shared caveat
    // structure so the other monitoring-only scales carry it too.
    test('the AWQ calculator states it cannot drive a medication decision', () => {
        const awq = SCALES.find((s) => s.id === 'awq');
        const shown = [awq.note, ...(awq.caveats || [])].join('\n');
        assert.ok(/not validated for linking a score to a medication decision/i.test(shown),
            'the AWQ calculator still invites the inference that a score selects a dose');
    });
});

describe('P2-11 — cannabis pathway additions', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="cannabis-withdrawal-page"'),
        html.indexOf('<!-- Psychostimulants Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('prevalence and the strongest predictor are stated', () => {
        assert.ok(/50% of regular or dependent users/.test(flat), 'the prevalence figure is missing');
        assert.ok(/80-90% in inpatient settings/.test(flat), 'the inpatient figure is missing');
        assert.ok(/[Dd]aily use is\s*<\/strong>?\s*the strongest predictor|Daily use is the strongest predictor/.test(flat),
            'the strongest predictor is not named');
    });

    test('both reduction strategies are described with who suits each', () => {
        assert.ok(/[Aa]brupt cessation<\/strong> suits/.test(flat), 'abrupt cessation guidance missing');
        assert.ok(/[Gg]radual reduction<\/strong> suits/.test(flat), 'gradual reduction guidance missing');
    });

    test('supportive care is specific', () => {
        assert.ok(/2-3 L\/day/.test(flat), 'hydration target missing');
        assert.ok(/[Aa]void caffeine/.test(flat), 'the caffeine advice is missing');
        assert.ok(/[Ee]xercise may help/.test(flat), 'exercise is missing');
    });

    test('medicinal cannabis tapering includes planning for the underlying condition', () => {
        assert.ok(/THC-based medicines over several weeks/.test(flat), 'the taper duration is missing');
        assert.ok(/alternative management for\s*the underlying condition|alternative management for the underlying condition/.test(flat),
            'stopping the medicine without replacing its purpose is the failure mode here');
    });

    test('synthetic cannabinoids are distinguished', () => {
        assert.ok(/higher receptor\s*<\/strong>?\s*affinity|higher receptor affinity/.test(flat),
            'the pharmacological difference is missing');
        for (const sx of ['palpitations', 'dyspnoea', 'chest pain']) {
            assert.ok(flat.includes(sx), `synthetic cannabinoid feature missing: ${sx}`);
        }
        assert.ok(/within an hour/.test(flat), 'the faster onset is missing');
    });
});

describe('P2-12 — specific population groups', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="populations-page"'), html.indexOf('<!-- Screening -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('the page exists and is reachable', () => {
        assert.ok(page.length > 500, 'the populations page is missing');
        assert.ok(/data-page="populations-page"/.test(html), 'nothing navigates to it');
    });

    test('every population group named in the spec has a card', () => {
        for (const group of ['Pregnancy', 'Co-occurring mental health', 'Aboriginal and Torres Strait Islander',
            'Older people', 'Adolescents and young adults', 'Culturally and linguistically diverse',
            'Gender and sexuality diverse']) {
            assert.ok(flat.includes(group), `population card missing: ${group}`);
        }
    });

    test('co-occurring mental health carries the three practical points', () => {
        assert.ok(/[Mm]ore than a third<\/strong>/.test(flat), 'the prevalence figure is missing');
        assert.ok(/precipitate or exacerbate psychiatric symptoms/.test(flat),
            'the warning that deterioration is not automatically a new diagnosis is missing');
        assert.ok(/not managed on a mental health\s*<\/strong>?\s*unit|not managed on a mental health unit/.test(flat),
            'the setting point is missing');
    });

    test('interpreter guidance is unambiguous', () => {
        assert.ok(/Use a professional interpreter/.test(flat), 'interpreter guidance missing');
        assert.ok(/only in an\s*emergency|only in an emergency/.test(flat),
            'the limit on family interpreting is missing');
    });
});

describe('P2-12 / P2-14 — the standard drinks calculator asks the right questions first', () => {
    const html = read('index.html');
    const calc = html.slice(html.indexOf('<div id="std-by-type"'), html.indexOf('id="std-by-volume"'));
    const flat = calc.replace(/\s+/g, ' ');

    test('the shared-versus-individual prompt is on the calculator itself', () => {
        assert.ok(/for the patient, or shared/.test(flat),
            'the prompt belongs where the counting happens, not only on the populations page');
    });

    test('the container prompt is on the calculator itself', () => {
        assert.ok(/250mL kitchen tumbler/.test(flat) && /600mL water bottle/.test(flat),
            'the container prompt is missing from the calculator');
        assert.ok(/Custom\s*Volume/.test(flat),
            'the prompt should route the user to the custom volume tab, or it is only a warning');
    });
});

describe('P2-14 — consumption history method', () => {
    const html = read('index.html');
    const panel = html.slice(html.indexOf('<div id="consumption-history"'),
        html.indexOf('<section id="aws"'));
    const flat = panel.replace(/\s+/g, ' ');

    test('it sits with the standard drinks calculator, not on a page of its own', () => {
        const stdDrinks = html.slice(html.indexOf('<section id="std-drinks"'), html.indexOf('<section id="aws"'));
        assert.ok(/data-tab="consumption-history"/.test(stdDrinks),
            'the method should be a tab beside the calculator it makes useful');
    });

    test('the retrospective week method is given as steps', () => {
        assert.ok(/[Ss]tart from the most recent use/.test(flat), 'the starting point is missing');
        assert.ok(/[Ll]ink consumption to activities/.test(flat), 'the activity-linking step is missing');
        assert.ok(/[Cc]over each day of the past week/.test(flat), 'the day-by-day step is missing');
        assert.ok(/whether that week was typical/.test(flat), 'the typicality check is missing');
    });

    test('the per-drug record set is complete', () => {
        for (const field of [/Quantity, frequency, duration of use, and pattern/, /Time and amount of last use/,
            /Route of administration/, /Average daily consumption/, /prescribed dose and the/]) {
            assert.ok(field.test(flat), `record field missing: ${field}`);
        }
    });

    test('the alcohol plus benzodiazepine combination is flagged', () => {
        assert.ok(/[Cc]ross-tolerance/.test(flat), 'the cross-tolerance mechanism is missing');
        assert.ok(/more severe and more protracted/.test(flat), 'the consequence is not stated');
    });

    test('ATOP is linked', () => {
        assert.ok(/ATOP/.test(flat) && /health\.nsw\.gov\.au/.test(flat), 'ATOP is not linked');
    });
});

describe('AUTH-05 — scale caveats live inside the calculators', () => {
    test('the universal caveat states what a scale is not', () => {
        const text = SCALE_CAVEATS_UNIVERSAL.join('\n');
        assert.ok(/do not diagnose withdrawal/i.test(text), 'the non-diagnostic statement is missing');
        assert.ok(/do not override clinical judgement/i.test(text), 'the judgement statement is missing');
        assert.ok(/already been diagnosed/i.test(text),
            'the scale must be framed as measuring severity of a diagnosed syndrome');
    });

    test('CIWA-Ar and AWS carry the three alcohol-specific caveats', () => {
        for (const id of ['ciwa-ar', 'aws']) {
            const text = (SCALES.find((s) => s.id === id).caveats || []).join('\n');
            assert.ok(/multiple pathologies/i.test(text), `${id}: the multiple-pathology caveat is missing`);
            assert.ok(/head injury or CVA/i.test(text), `${id}: the consciousness caveat is missing`);
            assert.ok(/[Rr]e-evaluate regularly/.test(text), `${id}: the re-evaluation caveat is missing`);
        }
    });

    test('the monitoring-only scales say they cannot drive a dose', () => {
        for (const id of ['ciwa-b', 'nsw-cws', 'cwas', 'awq']) {
            const text = (SCALES.find((s) => s.id === id).caveats || []).join('\n');
            assert.ok(/not validated for linking a score to a medication decision/i.test(text),
                `${id}: the UI invites the score-to-dose inference and nothing rules it out`);
        }
    });

    test('COWS states why it is preferred and how often to score it', () => {
        const text = (SCALES.find((s) => s.id === 'cows').caveats || []).join('\n');
        assert.ok(/preferred over SOWS/i.test(text), 'the SOWS comparison is missing');
        assert.ok(/6-hourly/.test(text), 'the inpatient scoring frequency is missing');
    });

    test('the caveats render in the calculator, above the score', () => {
        const js = read('script.js');
        assert.ok(/scale-caveats/.test(js), 'no caveat node is built');
        assert.ok(/insertBefore\(caveatNode, calculatorNode\.querySelector\('\.results-grid'\)\)/.test(js),
            'caveats must sit above the results grid, not after it');
    });
});

describe('AUTH-06 — the EMR copy function exports a plan', () => {
    const html = read('index.html');
    const js = read('script.js');

    test('the regimens tab offers a plan export', () => {
        assert.ok(/id="plan-summary"/.test(html), 'no plan textarea');
        assert.ok(/id="copy-plan-btn"/.test(html), 'no copy button');
    });

    test('the plan covers every section the spec names', () => {
        const summary = js.slice(js.indexOf('function buildPlanSummary'), js.indexOf('// Shared by the regimen panel'));
        for (const section of ['REGIMEN', 'MONITORING', 'ESCALATION', 'DISCHARGE', 'THIAMINE']) {
            assert.ok(summary.includes(section), `plan section missing: ${section}`);
        }
    });

    test('sections are selected by id, not by position', () => {
        const summary = js.slice(js.indexOf('function buildPlanSummary'), js.indexOf('// Shared by the regimen panel'));
        assert.ok(!/querySelectorAll\([^)]*\)\[\d\]/.test(summary),
            'positional selection breaks silently when a block is reordered');
        for (const id of ['block-band-selection', 'block-monitoring', 'block-escalation', 'block-discharge']) {
            assert.ok(html.includes(`id="${id}"`), `index.html has no #${id} for the plan export to find`);
            assert.ok(summary.includes(id), `buildPlanSummary does not read #${id}`);
        }
    });

    test('source tags survive into the copied text', () => {
        assert.ok(/querySelectorAll\('\.src-tag'\)/.test(js),
            'the exporter must convert source chips, not drop them — provenance has to survive the paste');
        assert.ok(/\[\$\{tag\.textContent\.trim\(\)\}\]/.test(js), 'tags should render as [NSWCG §x.y]');
    });

    test('the exported plan carries its own disclaimer', () => {
        assert.ok(/decision support, not a prescription/.test(js),
            'a block of text pasted into an EMR outlives its context and needs to say what it is');
        assert.ok(/Adult patients only/.test(js), 'the adults-only limit must travel with the plan');
    });
});

describe('AUTH-07 — capacity and consent scaffold', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="capacity-page"'),
        html.indexOf('<!-- Specific Population Groups -->'));

    test('the page exists and is reachable', () => {
        assert.ok(page.length > 500, 'the capacity scaffold is missing');
        assert.ok(/data-page="capacity-page"/.test(html), 'nothing navigates to it');
    });

    test('all five topics are scaffolded', () => {
        for (const topic of ['Capacity assessment in intoxication and withdrawal',
            'Consent and cognitive impairment', 'When the Mental Health Act applies',
            'The IDAT pathway', 'Guardianship and substitute decision-making']) {
            assert.ok(page.includes(topic), `scaffold heading missing: ${topic}`);
        }
    });

    test('it says plainly that it is empty', () => {
        assert.ok(/This section is a scaffold. No content has been written yet/.test(page),
            'an empty section that does not say it is empty reads as coverage');
        assert.ok(/contact your Local Health District/.test(page.replace(/\s+/g, ' ')),
            'a clinician landing here with a live question needs somewhere to go');
    });

    test('no clinical or legal content has been drafted', () => {
        // Each topic must be a heading followed by "To be written", not prose.
        const placeholders = [...page.matchAll(/<em>To be written\.<\/em>/g)];
        assert.equal(placeholders.length, 5,
            'every scaffolded topic should be an explicit placeholder — the spec forbids drafting this content');
    });

    test('each topic carries a TODO(clinical) inside an HTML comment', () => {
        const comments = [...page.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0]).join('\n');
        assert.equal([...comments.matchAll(/TODO\(clinical\):/g)].length, 5,
            'each of the five topics needs its own recorded question');
        assert.ok(/TODO\(review\):/.test(comments),
            'this section needs medico-legal review, not only clinical review');
    });
});

describe('AUTH-04 — attribution and reuse', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="sources-page"'), html.indexOf('<!-- About Page -->'));
    const about = html.slice(html.indexOf('id="about-page"'), html.indexOf('</main>'));

    test('the all-rights-reserved notice no longer covers derived clinical content', () => {
        assert.ok(!/All rights reserved\. No part of this publication may be reproduced/.test(about),
            'the blanket reservation sat awkwardly against guideline-derived content');
        assert.ok(/not over clinical material derived from those guidelines/.test(about.replace(/\s+/g, ' ')),
            'the About page does not scope the copyright claim');
    });

    test('the NSWCG reuse terms are stated', () => {
        const flat = page.replace(/\s+/g, ' ');
        assert.ok(/study or training/.test(flat), 'the permitted purpose is missing');
        assert.ok(/acknowledgement of the source/.test(flat), 'the acknowledgement condition is missing');
        assert.ok(/not for commercial\s*<\/strong>?\s*use|not for commercial use/.test(flat),
            'the commercial-use exclusion is missing');
    });

    test('every source document is listed', () => {
        for (const source of ['NSW Health', 'Turning Point', 'Queensland Health', 'SA Health', 'WA Health',
            'New Zealand Ministry of Health', 'Therapeutic Guidelines', 'ANZCA Faculty of Pain Medicine', 'RACGP']) {
            assert.ok(page.includes(source), `source missing from attribution page: ${source}`);
        }
    });

    test('the page explains the tagging system to a reader, not only to a developer', () => {
        assert.ok(/src-nswcg-adapted/.test(page) && /src-local/.test(page) && /src-other/.test(page),
            'the four tag kinds should be shown as examples, since they appear throughout the site');
        assert.ok(/the source document is authoritative/.test(page.replace(/\s+/g, ' ')),
            'the precedence rule between this site and its sources is not stated');
    });

    test('non-endorsement is explicit', () => {
        assert.ok(/has reviewed, approved or endorsed it/.test(page.replace(/\s+/g, ' ')),
            'listing organisations without disclaiming endorsement implies it');
    });
});

describe('AUTH-02 — versioning and review metadata', () => {
    const html = read('index.html');

    test('the three version strings and the cache name move together', () => {
        const appVersion = read('script.js').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];
        assert.equal(JSON.parse(read('package.json')).version, appVersion);
        assert.notEqual(appVersion, '0.3.2',
            'a content release that does not bump the version leaves installed users on the old shell');
    });

    test('every page with metadata exists, and every clinical page has metadata', () => {
        const pageIds = [...html.matchAll(/id="([a-z0-9-]+-page)"[^>]*class="[^"]*\bpage\b/g)].map((m) => m[1]);
        for (const id of Object.keys(CONTENT_META)) {
            assert.ok(pageIds.includes(id), `metadata for "${id}", which is not a page`);
        }
        // Pages that carry clinical statements must declare when they were reviewed.
        const exempt = new Set(['home-page', 'about-page', 'other-syndromes-page', 'sources-page',
            'contributors-page', 'changelog-page', 'bbv-sti-page', 'screening-page',
            'populations-page', 'continuing-care-page', 'capacity-page', 'contacts-page', 'scales-page',
            'alcohol-withdrawal-page']);
        for (const id of pageIds) {
            if (exempt.has(id) || CONTENT_META[id]) continue;
            assert.fail(`page "${id}" carries clinical content but declares no review metadata`);
        }
    });

    test('the review date displays as Month Year, not the exact day', () => {
        assert.equal(formatReviewMonth('2026-08-10'), 'August 2026');
        assert.equal(formatReviewMonth(null), null,
            'an unauthored section must not be given a review date it never had');
    });

    test('no next-review-due cadence is computed or shown', () => {
        // That cadence has not been agreed with the service — showing one
        // would present a negotiation as though it were already settled.
        assert.ok(!/next review due/i.test(read('script.js')),
            'a next-review-due date is being rendered again');
        assert.ok(!/reviewIntervalMonths/.test(read('data/content-meta.js')),
            'a review interval is being computed again with nothing to base it on');
    });

    test('the unwritten scaffold is not dated as though it were reviewed', () => {
        assert.equal(CONTENT_META['capacity-page'].lastReviewed, null,
            'dating an empty scaffold as reviewed is the misleading part');
    });

    test('a changelog exists in both machine and user-facing form', () => {
        assert.ok(fs.existsSync(path.join(ROOT, 'CHANGELOG.md')), 'no CHANGELOG.md');
        assert.ok(/id="changelog-page"/.test(html), 'no user-facing changelog page');
        assert.ok(/data-page="changelog-page"/.test(html), 'nothing navigates to the changelog');
    });

    test('the changelog leads with the changes that alter clinical meaning', () => {
        const changelog = read('CHANGELOG.md');
        const safety = changelog.indexOf('### Safety');
        const infra = changelog.indexOf('### Infrastructure');
        assert.ok(safety !== -1 && safety < infra,
            'safety changes must come before housekeeping, or the reader stops before reaching them');
    });
});
describe('AUTH-03 — contributors and clinical review', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('id="contributors-page"'),
        html.indexOf('<!-- Sources and Attribution -->'));

    test('the review register exists and is honest about its current state', () => {
        assert.ok(page.length > 500, 'the contributors page is missing');
        assert.ok(/No section of this site has yet completed external clinical review/.test(page),
            'an empty register that does not say it is empty implies review has happened');
    });

    test('the register has a row per content area, with reviewer, capacity and date', () => {
        for (const col of ['Reviewer', 'Capacity', 'Date']) {
            assert.ok(page.includes(`>${col}<`), `register column missing: ${col}`);
        }
        const rows = [...page.matchAll(/<tr><td>/g)].length;
        assert.ok(rows >= 12, `only ${rows} sections in the review register`);
    });

    test('the author and clinical owner is named', () => {
        assert.ok(/Dr Trent Koessler/.test(page), 'the clinical owner is not named');
        assert.ok(/every departure from published guidance, are his/.test(page.replace(/\s+/g, ' ')),
            'ownership of the departures should be explicit, since they are the point of the tagging');
    });

    test('what review means is defined, and does not imply endorsement', () => {
        const flat = page.replace(/\s+/g, ' ');
        assert.ok(/not<\/strong> endorsement by the reviewer's employer/.test(flat),
            'named reviewers imply institutional endorsement unless that is disclaimed');
    });

    test('reviewers are still to be identified', () => {
        const comments = [...page.matchAll(/<!--[\s\S]*?-->/g)].map((m) => m[0]).join('\n');
        assert.ok(/TODO\(review\):/.test(comments), 'no record of the reviewers still to be approached');
    });
});
