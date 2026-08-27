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
import { PHARMACOTHERAPY, CASE_FLAGGING, PRESCRIBER_CAPS, SL_TO_BUVIDAL, buvidalDoseFor,
    DIRECT_INITIATION } from '../data/otp-treatment.js';
import {
    TRANSFER_ROUTES, MICRODOSING_SCHEDULE, MICRODOSING_MISSED, BRIDGING_SCHEDULE, BRIDGING_DAY3,
    BRIDGING_ELIGIBILITY, TRANSFER_STOPS, BRIDGING_REVIEWS_RULE, microdosingPlan,
    MICRODOSING_VERDICTS, MICRODOSING_EXTENDED_SOURCE, MICRODOSING_EXTENDED_NOTES
} from '../data/otp-transfers.js';
import { EMR_SAFETY_LINES } from '../data/regimens.js';

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
        // The page names AGTAP in short form and links it; the full citation
        // lives once on Sources & Attribution. What has to survive here is a
        // working pointer to the document that carries the dosing, not the
        // particular wording of the reference.
        assert.ok(/alcoholtreatmentguidelines\.com\.au/.test(flat),
            'no link to the guideline that actually carries the dosing');
        assert.ok(/AGTAP Chapter 10|Guidelines for the Treatment of Alcohol Problems/.test(flat),
            'the guideline carrying the dosing is not named');
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
        html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'));
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
        assert.ok(/further <strong>2-6mg<\/strong>/.test(flat), 'the second increment is missing');
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
        assert.ok(/Community prescribing requires authorisation/.test(flat),
            'the community authorisation requirement is missing');
        // The confirmation route itself is shared with the OTP page and lives in
        // data/otp-missed-doses.js; the page only has to still render it.
        assert.ok(/data-confirm-otp/.test(flat),
            'the withdrawal page no longer renders the confirm-current-treatment block');
    });

    // Moved to the OTP page: this is a patient already in treatment. Asserted
    // here as an absence so the two pages cannot both end up carrying it.
    test('pain on buprenorphine is not duplicated back onto this page', () => {
        assert.ok(!/[Ff]ull agonists remain effective for analgesia/.test(flat),
            'the pain section has been copied back onto the withdrawal page');
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

// AUTH-06 originally exported the whole tab — regimen, band selection, score
// interpretation, monitoring, escalation, discharge and thiamine, with source
// tags bracketed inline. In use that was unpasteable: hundreds of lines of
// context around the twenty a prescriber needs at the drug chart. The export is
// now a prescribing block, and these guards pin what must not fall out of it.
describe('AUTH-06 — the EMR copy function exports a prescribing block', () => {
    const html = read('index.html');
    const js = read('script.js');
    const summary = js.slice(js.indexOf('function buildRegimenSummary'),
        js.indexOf('// Condensed, citation-free version'));

    test('the regimens tab offers the export', () => {
        assert.ok(/id="plan-summary"/.test(html), 'no summary textarea');
        assert.ok(/id="copy-plan-btn"/.test(html), 'no copy button');
    });

    test('it is built from the regimen data, not scraped from the whole tab', () => {
        assert.ok(summary.length > 200, 'buildRegimenSummary is missing');
        assert.ok(/REGIMEN_CONFIG\[selectedBenzo\]/.test(summary),
            'the export should read the selected regimen directly');
        for (const id of ['block-band-selection', 'block-monitoring', 'block-escalation',
            'block-discharge', 'thiamine']) {
            assert.ok(!summary.includes(id),
                `the export pulls in #${id} again — that context belongs on the page, not in the paste`);
        }
    });

    test('the three things that stop a schedule being followed off a cliff travel with it', () => {
        assert.ok(/EMR_SAFETY_LINES\.dosingInterval/.test(summary), 'the 2-hourly dosing floor is missing');
        assert.ok(/EMR_SAFETY_LINES\.sedation/.test(summary), 'the withhold-if-sedated caution is missing');
        assert.ok(/EMR_SAFETY_LINES\.review/.test(summary), 'the 24-hour medical review total is missing');
    });

    test('the paste says how often to score, in the scale the ward charts', () => {
        assert.ok(/INITIAL_SCORING_INTERVAL/.test(summary),
            'a fixed schedule must paste with a scoring interval, not doses alone');
        assert.ok(/SCALE_LABEL\[selectedScale\]/.test(summary),
            'the paste must name the scale the clinician selected');
    });

    // The counterpart of dropping citations: the safety sentences in the paste
    // are the plain-text twins of statements on the page, so if one is reworded
    // and the other is not, the two disagree in a clinician's note.
    test('the safety lines match what the page says', () => {
        assert.ok(/sedated/.test(EMR_SAFETY_LINES.sedation) && /withhold the dose/.test(EMR_SAFETY_LINES.sedation),
            'the sedation line no longer says to withhold the dose');
        assert.ok(/withhold if sedated/i.test(html),
            'the escalation block no longer carries the withhold-if-sedated rule the paste mirrors');
        assert.ok(/delirium tremens/i.test(EMR_SAFETY_LINES.dosingInterval),
            'the dosing-interval line no longer states the DT exception the page allows');
        assert.ok(/exceeds 80mg in 24 hours/.test(EMR_SAFETY_LINES.review('diazepam', '80mg')),
            'the review line no longer states a 24-hour total');
    });

    // Citations are stripped from the paste, so the one line that says where a
    // regimen came from is the only provenance a pasted note carries. It also
    // has to be honest: "NSW Health-derived" alone is true of the severe cells
    // and of nothing else here — the test-dose protocol is local outright.
    test('the paste says which release produced it, and how far it is guideline-derived', () => {
        assert.ok(/Generated from SUD Toolkit v\$\{APP_VERSION\}/.test(summary),
            'the paste must name the release that produced the doses, not a hardcoded version');
        assert.ok(/NSW Health-derived/.test(summary), 'the paste claims no source at all');
        assert.ok(/cellHasLocalContent\(data\)/.test(summary),
            'the source claim must be qualified per regimen, not asserted for all of them');
    });

    test('the local-content test reads the source tags rather than a hand-kept list', () => {
        const js2 = read('script.js');
        const helper = js2.slice(js2.indexOf('const cellHasLocalContent'), js2.indexOf('// Under AWS'));
        assert.ok(/src-local\|src-nswcg-adapted/.test(helper),
            'a list of which regimens are local would drift from the tags on the content');
    });

    test('citations are dropped from every EMR copy, not bracketed', () => {
        assert.ok(/querySelectorAll\('\.src-tag'\)\.forEach\(tag => tag\.remove\(\)\)/.test(js),
            'source chips must be removed from pasted text — the app is the source of record');
        assert.ok(!/\[\$\{tag\.textContent\.trim\(\)\}\]/.test(js),
            'tags are being bracketed into the paste again');
        assert.ok(/src-tag[\s\S]{0,40}replace/.test(js),
            'the data-driven export must strip source spans from clinical strings too');
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

describe('the OTP page', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'),
        html.indexOf('<!-- Benzo Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    // The page is only reachable from the opioid page. A page with no route to
    // it is a page nobody reads, and the missed-dose bands are the part of this
    // app most likely to be opened under time pressure.
    test('the opioid page links to it', () => {
        const opioid = html.slice(html.indexOf('id="opioid-withdrawal-page"'),
            html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'));
        assert.ok(/data-page="otp-page"/.test(opioid),
            'nothing on the opioid page navigates to the OTP page');
    });

    test('it links back to the opioid page', () => {
        assert.ok(/data-page="opioid-withdrawal-page"/.test(flat),
            'the OTP page is a dead end - nothing navigates back');
    });

    // The bands and the Buvidal windows render from the data module, so the
    // markup carries only the host. If the host is renamed or dropped the page
    // renders as a heading with nothing under it, which no test would otherwise
    // notice.
    test('the missed-dose host is present for the renderer', () => {
        assert.ok(/data-otp-missed-doses/.test(flat), 'the missed-doses block has no host element');
    });

    test('the calculator controls are all present', () => {
        for (const id of ['otp-agent', 'otp-usual-dose', 'otp-missed-count',
            'otp-missed-result', 'reset-otp-missed-btn']) {
            assert.ok(new RegExp(`id="${id}"`).test(flat), `calculator element "${id}" is missing`);
        }
    });

    test('the withdrawal page no longer carries a copy of the missed-dose content', () => {
        const opioid = html.slice(html.indexOf('id="opioid-withdrawal-page"'),
            html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'));
        assert.ok(!/data-otp-missed-doses|id="otp-agent"/.test(opioid),
            'the missed-dose block has been left on, or inlined back into, the opioid page');
    });

    test('pain on buprenorphine moved here', () => {
        assert.ok(/[Ff]ull agonists remain effective for analgesia/.test(flat),
            'the pain section did not arrive on the OTP page');
        assert.ok(/1800023687/.test(flat), 'the DASAS number did not come with it');
    });

    // Loss of tolerance after missed doses is the overdose scenario naloxone
    // exists for, so the shared opioid harm-reduction block renders here too.
    test('the opioid harm-reduction block renders here', () => {
        assert.ok(/data-harm-reduction="opioid"/.test(flat),
            'naloxone and overdose prevention are not on the page that warns about lost tolerance');
    });

    // The page ships with known holes in it. The banner is what makes that the
    // reader's information rather than only the author's, so it is asserted to
    // be above the first clinical statement on the page.
    test('the under-construction banner is the first thing on the page', () => {
        assert.ok(/[Uu]nder construction/.test(flat), 'the under-construction banner is missing');
        assert.ok(flat.indexOf('Under construction') < flat.indexOf('data-confirm-otp'),
            'the banner sits below clinical content instead of above it');
    });

    test('confirming current treatment leads the page', () => {
        assert.ok(/data-confirm-otp/.test(flat), 'the confirm-current-treatment block is missing');
        assert.ok(flat.indexOf('data-confirm-otp') < flat.indexOf('data-otp-missed-doses'),
            'the missed-dose bands come before the step that produces the numbers they need');
    });
});

describe('OTP framework, assessment and pharmacotherapy', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'),
        html.indexOf('<!-- Benzo Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');
    const cell = (med, key) => PHARMACOTHERAPY.find((m) => m.medication.includes(med))[key];

    test('all three hosts are on the page', () => {
        for (const host of ['data-otp-pharmacotherapy', 'data-otp-assessment', 'data-otp-framework']) {
            assert.ok(new RegExp(host).test(flat), `${host} is missing from the OTP page`);
        }
    });

    // The figures the table exists for. Asserted against the module rather than
    // the markup because the markup is only a host.
    test('the methadone figures match the guideline table', () => {
        assert.ok(/20-30mg daily/.test(cell('methadone', 'initiation')), 'methadone starting dose');
        assert.ok(/5-10mg every 3-5 days/.test(cell('methadone', 'initiation')), 'methadone titration');
        assert.ok(/60-100mg\/day/.test(cell('methadone', 'maintenance')), 'methadone maintenance range');
        assert.ok(/150mg/.test(cell('methadone', 'maintenance'))
            && /200mg/.test(cell('methadone', 'maintenance')), 'the two methadone approval ceilings');
    });

    test('the Buvidal figures match the LAIB guidance', () => {
        const init = cell('Buvidal', 'initiation');
        assert.ok(/16mg Weekly/.test(init) && /24mg Weekly/.test(init), 'Buvidal direct-initiation doses');
        assert.ok(/licensed starting dose/.test(init),
            '16mg is the licensed starting dose and 24mg is clinical experience - the cell no longer says '
            + 'which is which');
        assert.ok(/32mg in week 1/.test(init), 'the week-1 supplemental ceiling');
        assert.ok(/Weekly: 16-32mg/.test(cell('Buvidal', 'maintenance')), 'Buvidal Weekly maintenance');
        assert.ok(/Monthly: 64-160mg/.test(cell('Buvidal', 'maintenance')), 'Buvidal Monthly maintenance');
    });

    // The two pages state the same first-dose rule. They are written
    // independently, so a change to one that is not made to the other puts two
    // buprenorphine protocols back into the app - which is what this guards.
    test('the buprenorphine row states the same first-dose rule as the induction protocol', () => {
        const init = cell('Sublingual buprenorphine', 'initiation');
        assert.ok(/Do not initiate below <strong>COWS 8/.test(init), 'the threshold is missing');
        assert.ok(/split as 4mg with a further 4mg after 1-2 hours/.test(init),
            'the split-dose option for the 8mg first dose is missing');
        assert.ok(/16mg on Day 2/.test(init) && /24mg on Day 3/.test(init),
            'the Day 2 and Day 3 ceilings are missing');
    });

    test('the induction protocol carries every limb of that rule', () => {
        const opioid = html.slice(html.indexOf('id="opioid-withdrawal-page"'),
            html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->')).replace(/\s+/g, ' ');
        assert.ok(/objective withdrawal \(COWS &ge; 8\)/.test(opioid), 'the threshold to initiate is missing');
        assert.ok(/split as 4mg with a further 4mg after 1-2 hours/.test(opioid),
            'the split-dose option is missing');
        assert.ok(/2mg SL test dose/.test(opioid), 'the test-dose alternative is missing');
        // The conflation that made three compatible figures look like three
        // rival protocols: 8-12mg is what the day adds up to, not a first dose.
        assert.ok(/Day 1 total: 8-12mg outpatient, 8-16mg inpatient/.test(opioid),
            'the Day 1 figures no longer say they are totals rather than first doses');
    });

    // The threshold to initiate is COWS >= 8 and nothing in the app may imply a
    // lower one. The 4mg + 4mg split survives as a technique for giving the 8mg
    // first dose, so a "COWS 4-8" band label reappearing means the guideline's
    // framing has been pasted back in over this decision.
    test('no page offers a dosing band below the COWS >= 8 threshold', () => {
        const pages = html.slice(html.indexOf('id="opioid-withdrawal-page"'),
            html.indexOf('<!-- Benzo Withdrawal Page -->')).replace(/\s+/g, ' ');
        const clinical = pages.replace(/<span class="src-tag[^]*?<\/span>/g, '');
        assert.ok(!/COWS 4-8/.test(clinical),
            'a COWS 4-8 dosing band is back - the app does not initiate below COWS 8');
        assert.ok(!/COWS &ge; 4\b/.test(clinical), 'a COWS >= 4 threshold is back');
    });

    // Direct initiation is the one cell a reader can carry to the wrong drug.
    test('the LAIB direct-initiation caveat is present', () => {
        assert.ok(/does not relax the precipitated-withdrawal precautions/
            .test(read('data/otp-treatment.js')),
            'nothing stops direct initiation being read as applying to sublingual buprenorphine');
    });

    // The four paragraphs of LAIB 5.2.1 that a dose column cannot hold. The
    // wearing-off point is the one that changes what the patient is told, so it
    // is asserted rather than left to survive on its own.
    test('the first week of Buvidal is described, not just the dose', () => {
        const points = DIRECT_INITIATION.points.join(' ');
        assert.ok(/wear off/.test(points) && /day 5 or 6/.test(points),
            'the patient is no longer told the first dose may wear off, or that they can come in early');
        assert.ok(/steady state after three to four/.test(points),
            'the reason week 1 feels lighter than later weeks is not stated');
        assert.ok(/Child-Pugh B or C/.test(points),
            'the hepatic-disease reason for a sublingual run-in has gone');
        assert.ok(/point-of-care urine drug test/.test(points),
            'nothing prompts a UDS where recent methadone is in doubt before an irretrievable depot dose');
        assert.ok(/data-otp-pharmacotherapy/.test(read('index.html')),
            'the host that renders it is gone from the OTP page');
    });

    test('the case-flagging tiers are decidable and ordered', () => {
        assert.equal(CASE_FLAGGING.length, 3);
        assert.deepEqual(CASE_FLAGGING.map((t) => t.tier),
            ['High need', 'Moderate need', 'Low need'], 'the tiers are not in descending order of need');
        // Clinical review is more frequent than medical review in every tier.
        const months = (s) => (s === 'Monthly' ? 1 : parseInt(s, 10));
        for (const t of CASE_FLAGGING) {
            assert.ok(months(t.clinical) <= months(t.medical),
                `${t.tier}: medical review is more frequent than clinical review`);
        }
    });

    test('the any-one-flags-up rule is stated, and tagged as the local decision it is', () => {
        const module = read('data/otp-treatment.js');
        assert.ok(/[Aa]ny single feature is enough to flag a patient up/.test(module),
            'the combination rule is missing, leaving the tiers undecidable');
        assert.ok(/src-local[^]*?Any-one-flags-up is a local decision/.test(module),
            'the combination rule is presented as guideline text rather than a local decision');
    });

    test('the caseload limits are collapsed, not deleted', () => {
        assert.equal(PRESCRIBER_CAPS.rows.length, 2);
        assert.ok(/<details class="warning-box"><summary>/.test(read('script.js')),
            'the caseload limits no longer render inside a collapsed block');
    });
});

describe('the methadone to buprenorphine transfers page', () => {
    const html = read('index.html');
    const page = html.slice(html.indexOf('<!-- Methadone to Buprenorphine Transfers Page -->'),
        html.indexOf('<!-- Benzo Withdrawal Page -->'));
    const flat = page.replace(/\s+/g, ' ');

    test('the OTP page links to it, and it links back', () => {
        const otp = html.slice(html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'),
            html.indexOf('<!-- Methadone to Buprenorphine Transfers Page -->'));
        assert.ok(/data-page="otp-transfers-page"/.test(otp),
            'nothing on the OTP page navigates to the transfers page');
        assert.ok(/data-page="otp-page"/.test(flat), 'the transfers page is a dead end');
    });

    test('every host the renderer looks for is on the page', () => {
        for (const host of ['data-transfer-stops', 'data-microdosing', 'data-microdosing-missed',
            'data-bridging', 'data-transfer-evidence']) {
            assert.ok(new RegExp(host).test(flat), `${host} is missing - its section would render empty`);
        }
    });

    // Methadone runs at the usual dose to day 5, halves on day 6 and quarters
    // on day 7. The failure this guards is the schedule being "tidied" into a
    // cessation on day 7, which is a day of uncovered withdrawal.
    test('the micro-dosing schedule matches the guidance, and methadone is never stopped', () => {
        assert.deepEqual(MICRODOSING_SCHEDULE.map((d) => d.day),
            ['0', '1', '2', '3', '4', '5', '6', '7']);
        assert.deepEqual(MICRODOSING_SCHEDULE.map((d) => d.bup),
            ['Nil', '0.2mg BD <em>or</em> 0.4mg mane', '0.4mg BD', '2mg', '4mg', '8mg', '16mg', '16-32mg']);
        for (const day of MICRODOSING_SCHEDULE.slice(0, 6)) {
            assert.equal(day.methadone, 'X', `day ${day.day}: methadone should be the unchanged usual dose`);
        }
        assert.equal(MICRODOSING_SCHEDULE[6].methadone, '&frac12;X', 'day 6 halves the methadone dose');
        assert.equal(MICRODOSING_SCHEDULE[7].methadone, '&frac14;X', 'day 7 quarters it - it does not stop');
        assert.ok(/not stopped on day 7/.test(read('data/otp-transfers.js')),
            'the note that day 7 is not a cessation has gone');
    });

    test('the missed-dose bands are decided by COWS, at the published thresholds', () => {
        assert.equal(MICRODOSING_MISSED.length, 4);
        assert.ok(/&gt;24/.test(MICRODOSING_MISSED[1].action), 'the 2-3 day threshold is not COWS 24');
        assert.ok(/&gt;13/.test(MICRODOSING_MISSED[2].action), 'the 4-5 day threshold is not COWS 13');
        assert.ok(/day 6/.test(MICRODOSING_MISSED[2].action),
            'below COWS 13 the procedure restarts at day 6');
    });

    // The catastrophic misreading: oxycodone is the weaker drug here, so the
    // daily dose is a multiple of the methadone dose, not a fraction of it.
    // Both the ratio and a worked example have to survive on every row.
    test('the oxycodone conversion states its direction and carries a worked example', () => {
        assert.deepEqual(BRIDGING_SCHEDULE.map((d) => d.day), ['1', '2', '3']);
        assert.ok(/3 &times; the methadone dose/.test(BRIDGING_SCHEDULE[0].conversion),
            'day 1 no longer says which way the 3:1 ratio runs');
        for (const day of BRIDGING_SCHEDULE) {
            assert.ok(/50mg methadone/.test(day.example),
                `day ${day.day} has lost its worked example, leaving a bare ratio to be read either way`);
        }
        assert.ok(/150mg daily = 75mg BD/.test(BRIDGING_SCHEDULE[0].example),
            'the day 1 example no longer converts 50mg of methadone to 150mg of oxycodone');
        assert.ok(/multiplies/.test(read('script.js')),
            'the heading that states the direction of the conversion has gone');
    });

    test('the day 3 Buvidal dose splits at 40mg, and the week 1 ceiling is stated', () => {
        const points = BRIDGING_DAY3.points.join(' ');
        assert.ok(/&gt;40mg methadone: Buvidal Weekly 24mg/.test(points), 'the 24mg dose above 40mg');
        assert.ok(/&lt;40mg: Buvidal Weekly 16mg/.test(points), 'the 16mg dose below 40mg');
        assert.ok(/32mg in the first week/.test(points), 'the week 1 supplemental ceiling');
    });

    test('bridging is marked as a Buvidal protocol, not a Sublocade one', () => {
        assert.ok(/Do not use it to transfer onto Sublocade/.test(read('data/otp-transfers.js')),
            'nothing stops the bridging protocol being used to start Sublocade');
    });

    test('the eligibility limits that keep takeaway oxycodone off the wrong patient survive', () => {
        const rules = BRIDGING_ELIGIBILITY.join(' ');
        assert.ok(/40-150mg daily/.test(rules), 'the methadone dose range');
        assert.ok(/4 standard drinks/.test(rules), 'the alcohol limit');
        assert.ok(/10mg diazepam equivalent/.test(rules), 'the benzodiazepine limit');
        assert.ok(/intravenous/.test(rules), 'the injecting exclusion');
    });

    // Both methods are off-label and need an authority covering two drugs at
    // once. A page that lost either would read as though this were routine
    // prescribing.
    test('the page says the methods are off-label and names the authority sections', () => {
        const stops = TRANSFER_STOPS.join(' ');
        assert.ok(/off-label/.test(stops), 'the off-label status is not stated');
        assert.ok(/Section D/.test(stops) && /Section E/.test(stops),
            'the two sections of the PRU application that a transfer needs are not named');
    });

    // COWS >= 6 is a property of the depot's absorption. Nothing about it
    // relaxes the sublingual threshold, and the two figures appear within a
    // table of each other.
    test('the COWS 6 figure is bound to Buvidal and the sublingual threshold restated', () => {
        const module = read('data/otp-transfers.js');
        assert.ok(/COWS &gt;6/.test(TRANSFER_ROUTES[0].route), 'the Buvidal threshold has gone');
        assert.ok(/COWS &ge; 8/.test(TRANSFER_ROUTES[0].route),
            'the sublingual threshold is no longer stated alongside it');
        assert.ok(/belongs to Buvidal, not to sublingual buprenorphine/.test(module),
            'nothing stops COWS 6 being read as a sublingual threshold');
    });

    // Deferring a first Buvidal dose to moderate withdrawal reads as the
    // careful choice and is the opposite: it buys eight to 12 hours of
    // unrelieved withdrawal while the depot comes up.
    test('the page says that waiting for moderate withdrawal is not the cautious option', () => {
        const module = read('data/otp-transfers.js');
        assert.ok(/not the cautious option/.test(module),
            'the warning against deferring the first Buvidal dose to COWS 12 has gone');
        assert.ok(/eight to 12 hours/.test(module),
            'the cost of deferring it - the time the depot takes to reach effective levels - is not stated');
    });

    test('the routes are ordered by methadone dose, the number the prescriber has', () => {
        assert.deepEqual(TRANSFER_ROUTES.map((r) => r.dose),
            ['&le;30mg methadone', '&gt;40mg to 150mg', '&gt;150mg']);
    });

    test('there is a named person to ring, and intoxication is the example', () => {
        assert.ok(/addiction medicine specialist or the on-call AOD medical officer/
            .test(BRIDGING_REVIEWS_RULE), 'the escalation route has gone from the review schedule');
        assert.ok(/[Ii]ntoxication/.test(BRIDGING_REVIEWS_RULE),
            'intoxication is the source table\'s named trigger for that call, and is no longer stated');
    });

    // The calculator's only job is the methadone column. Everything it prints
    // has to be a row of the published table with the arithmetic done, which is
    // what these assert - starting with the day count.
    test('the one-week plan is the published schedule, with the milligrams worked out', () => {
        const plan = microdosingPlan(60, 1);
        assert.equal(plan.lastDay, 7, 'a one-week schedule that does not end on day 7');
        assert.deepEqual(plan.rows.map((r) => r.dayLabel),
            ['Day 0', 'Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7']);
        assert.deepEqual(plan.rows.map((r) => r.methadoneMg), [60, 60, 60, 60, 60, 60, 30, 15]);
        assert.deepEqual(plan.rows.map((r) => r.bup), MICRODOSING_SCHEDULE.map((d) => d.bup),
            'the calculator and the printed table disagree about the buprenorphine doses');
    });

    // Two weeks is the same rungs held twice as long. Every dose on it must
    // still be a dose the guidance publishes - a schedule with a new dose level
    // on it would be an invented protocol rather than a lengthened one.
    test('the two-week plan holds each rung for two days and invents no new dose', () => {
        const plan = microdosingPlan(90, 2);
        assert.equal(plan.lastDay, 14, 'a two-week schedule that does not end on day 14');
        assert.deepEqual(plan.rows.map((r) => r.dayLabel),
            ['Day 0', 'Days 1-2', 'Days 3-4', 'Days 5-6', 'Days 7-8', 'Days 9-10', 'Days 11-12',
                'Days 13-14']);
        assert.deepEqual(plan.rows.map((r) => r.bup), MICRODOSING_SCHEDULE.map((d) => d.bup),
            'the two-week schedule carries a buprenorphine dose the guidance does not publish');
        assert.deepEqual(plan.rows.map((r) => r.fraction),
            MICRODOSING_SCHEDULE.map((_, i) => microdosingPlan(90, 1).rows[i].fraction),
            'the methadone reductions land on different rungs than the published schedule');
    });

    // Doubling day 0 would be two days of no buprenorphine at the start, which
    // is a delay rather than a gentler ramp.
    test('the baseline day is never doubled', () => {
        assert.equal(microdosingPlan(60, 2).rows[0].dayLabel, 'Day 0');
    });

    test('methadone is never taken to zero by the calculator', () => {
        for (const weeks of [1, 2]) {
            for (const dose of [45, 60, 90, 120, 150]) {
                const last = microdosingPlan(dose, weeks).rows.at(-1);
                assert.equal(last.methadoneMg, dose / 4,
                    `${dose}mg over ${weeks} week(s): the last day is not a quarter of the usual dose`);
                assert.ok(last.methadoneMg > 0, 'the calculator has stopped methadone on the last day');
            }
        }
    });

    // The dose bands the method itself is bounded by. The 30-40mg one is the
    // band the guidance does not answer, and saying so is the answer.
    test('the dose decides the verdict, and the unstated band is named as unstated', () => {
        assert.equal(microdosingPlan(25, 1).verdict, 'direct');
        assert.equal(microdosingPlan(35, 1).verdict, 'gap');
        assert.equal(microdosingPlan(60, 1).verdict, 'standard');
        assert.equal(microdosingPlan(180, 1).verdict, 'specialist');
        assert.ok(/NSW states neither/.test(MICRODOSING_VERDICTS.gap.body),
            'the 30-40mg gap is being answered rather than named');
    });

    test('a blank or impossible dose produces no schedule at all', () => {
        for (const bad of [NaN, 0, -10, undefined]) {
            assert.equal(microdosingPlan(bad, 1), null, `${bad} produced a schedule`);
        }
    });

    // A local extension of a published schedule is exactly what the provenance
    // system exists to mark, and the page must not present it as guidance.
    test('the two-week option is tagged as a local extension', () => {
        assert.ok(/src-local/.test(MICRODOSING_EXTENDED_SOURCE),
            'the two-week schedule is presented as though NSW published it');
        assert.ok(/This is not the NSW schedule/.test(MICRODOSING_EXTENDED_NOTES.join(' ')),
            'the two-week schedule no longer says on the page that it is not the published one');
    });

    test('the calculator controls are on the page', () => {
        for (const id of ['microdosing-dose', 'microdosing-weeks', 'microdosing-result',
            'reset-microdosing-btn']) {
            assert.ok(new RegExp(`id="${id}"`).test(flat), `calculator element "${id}" is missing`);
        }
    });

    test('the offline precache carries the module', () => {
        assert.ok(/data\/otp-transfers\.js/.test(read('sw.js')),
            'the transfers module is not precached - the page would be blank offline');
    });
});

describe('SL buprenorphine to Buvidal conversion (LAIB Table 4)', () => {
    test('every band converts to the published depot doses', () => {
        assert.deepEqual(
            SL_TO_BUVIDAL.map((r) => [r.label, r.weeklyMg, r.monthlyMg]),
            [
                ['2-6mg', 8, null],
                ['8-10mg', 16, 64],
                ['12-16mg', 24, 96],
                ['18-24mg', 32, 128],
                ['26-32mg', null, 160]
            ]);
    });

    // The relationship that holds across the whole table. A transcription slip
    // in any Weekly or Monthly figure breaks it, which makes this a better
    // guard than re-typing the numbers a second time.
    test('the Monthly dose is four times the Weekly dose wherever both exist', () => {
        for (const row of SL_TO_BUVIDAL) {
            if (row.weeklyMg === null || row.monthlyMg === null) continue;
            assert.equal(row.monthlyMg, row.weeklyMg * 4,
                `${row.label}: ${row.monthlyMg}mg Monthly is not 4x ${row.weeklyMg}mg Weekly`);
        }
    });

    // Both gaps are gaps in the manufactured range, and the arithmetic above is
    // why: the missing product in each case is the 4x partner of a dose that
    // does exist. If a future edit fills either cell in, that is a change to
    // what can be prescribed, not a tidy-up.
    test('the two "no equivalent" cells are where the 4x partner is not manufactured', () => {
        const weeklyDoses = SL_TO_BUVIDAL.map((r) => r.weeklyMg).filter(Boolean);
        const monthlyDoses = SL_TO_BUVIDAL.map((r) => r.monthlyMg).filter(Boolean);
        const lowest = SL_TO_BUVIDAL[0];
        assert.equal(lowest.monthlyMg, null, 'the 2-6mg band has gained a Monthly equivalent');
        assert.ok(!monthlyDoses.includes(lowest.weeklyMg * 4),
            'a 32mg Monthly now exists, so the 2-6mg band should no longer be blank');
        const highest = SL_TO_BUVIDAL[SL_TO_BUVIDAL.length - 1];
        assert.equal(highest.weeklyMg, null, 'the 26-32mg band has gained a Weekly equivalent');
        assert.ok(!weeklyDoses.includes(highest.monthlyMg / 4),
            'a 40mg Weekly now exists, so the 26-32mg band should no longer be blank');
    });

    // Sublingual buprenorphine is dispensed in 2mg steps, so the bands have to
    // cover every even dose up to the 32mg licensed maximum exactly once. A
    // band boundary typed wrong shows up here as a gap or an overlap.
    test('the bands cover every dispensable dose from 2 to 32mg, once each', () => {
        for (let mg = 2; mg <= 32; mg += 2) {
            const matches = SL_TO_BUVIDAL.filter((r) => mg >= r.minMg && mg <= r.maxMg);
            assert.equal(matches.length, 1,
                `${mg}mg daily falls in ${matches.length} bands - the table must cover it exactly once`);
        }
        assert.equal(SL_TO_BUVIDAL[SL_TO_BUVIDAL.length - 1].maxMg, 32,
            'the table no longer ends at the 32mg licensed maximum stated in the pharmacotherapy row');
    });

    test('the lookup returns the right row, and nothing outside the table', () => {
        assert.equal(buvidalDoseFor(6).weeklyMg, 8);
        assert.equal(buvidalDoseFor(10).monthlyMg, 64);
        assert.equal(buvidalDoseFor(24).weeklyMg, 32);
        assert.equal(buvidalDoseFor(32).monthlyMg, 160);
        assert.equal(buvidalDoseFor(32).weeklyMg, null, 'a Weekly dose was invented for the top band');
        for (const bad of [0, 1, 33, 40, NaN, undefined]) {
            assert.equal(buvidalDoseFor(bad), null, `${bad}mg produced a conversion`);
        }
    });

    test('the conversion renders on the OTP page', () => {
        const html = read('index.html');
        const page = html.slice(html.indexOf('<!-- Opioid Treatment Program (OTP) Page -->'),
            html.indexOf('<!-- Benzo Withdrawal Page -->'));
        assert.ok(/data-buvidal-conversion/.test(page), 'the conversion table has no host on the page');
    });
});
