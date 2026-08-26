import { FLOWCHART_LOGIC } from './data/flowchart.js';
import { REGIMEN_CONFIG, EMR_SAFETY_LINES, INITIAL_SCORING_INTERVAL } from './data/regimens.js';
import { SCALES, SCALE_CAVEATS_UNIVERSAL } from './data/scales.js';
import { SYMPTOMATIC, SYMPTOMATIC_UNIVERSAL } from './data/symptomatic.js';
import { HARM_REDUCTION } from './data/harm-reduction.js';
import { BENZO_EQUIVALENCE, EQUIVALENCE_CAVEATS, DIAZEPAM_REFERENCE_MG } from './data/benzo-equivalence.js';
import {
    MISSED_DOSE_REVIEW, MISSED_DOSE_STOPS, MISSED_DOSE_RATIONALE, MISSED_DOSE_BANDS, ORAL_OTP_AGENTS,
    BUVIDAL_WINDOWS, BUVIDAL_NOTES, MISSED_DOSE_SOURCE, BUVIDAL_SOURCE, RESTART_CAP_SOURCE,
    CONFIRM_CURRENT_TREATMENT, CONFIRM_CURRENT_TREATMENT_SOURCE, bandFor, restartDose
} from './data/otp-missed-doses.js';
import {
    PRESCRIBER_FRAMEWORK, PRESCRIBER_CAPS, OTP_ASSESSMENT, CASE_FLAGGING, CASE_FLAGGING_RULE,
    CASE_FLAGGING_SOURCE, PHARMACOTHERAPY, PHARMACOTHERAPY_WARNING
} from './data/otp-treatment.js';
import { CONTENT_META, formatReviewMonth } from './data/content-meta.js';

// Published before anything else runs, and outside the DOMContentLoaded
// handler, so the build-skew guard in index.html can read it even if this file
// throws while starting up. That guard compares it against the release the
// markup belongs to; see the comment above it.
const APP_VERSION = '0.4.8';
window.SUD_BUILD = APP_VERSION;

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.app-version').forEach(el => el.textContent = APP_VERSION);

    // --- PREVENT TRANSITION FLASH --- //
    window.addEventListener('load', () => {
        document.body.classList.remove('preload');
    });

    // --- DISCLAIMER MODAL --- //
    // The body carries `modal-open` from the markup so the app behind the
    // disclaimer is blurred and inert from first paint, not just once JS runs.
    const disclaimerModal = document.getElementById('disclaimer-modal');
    const acceptDisclaimerBtn = document.getElementById('accept-disclaimer-btn');

    // Deferred: focus set during DOMContentLoaded is discarded when the browser
    // finishes loading the document and resets focus to <body>.
    requestAnimationFrame(() => {
        if (disclaimerModal.style.display !== 'none') {
            acceptDisclaimerBtn.focus();
        }
    });

    acceptDisclaimerBtn.addEventListener('click', () => {
        disclaimerModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    });

    // Answering "I am not a health professional" swaps the gate for the
    // referral panel and leaves it there. The modal is never dismissed and
    // `modal-open` stays on the body, so the app behind it stays inert: the
    // point of asking is that one of the answers does not get in.
    const declineDisclaimerBtn = document.getElementById('decline-disclaimer-btn');
    if (declineDisclaimerBtn) {
        declineDisclaimerBtn.addEventListener('click', () => {
            document.getElementById('disclaimer-gate').hidden = true;
            const declined = document.getElementById('disclaimer-declined');
            declined.hidden = false;
            // The heading is the first thing a screen reader should reach, and
            // focus is still on a button that no longer exists on screen.
            declined.querySelector('h3').setAttribute('tabindex', '-1');
            declined.querySelector('h3').focus();
        });
    }



    // --- TAB STRIP SCROLL AFFORDANCE --- //
    // A tab strip wider than the screen just clips its last label, which reads
    // as broken text rather than as "scroll for more". These classes drive an
    // edge mask (see .can-scroll-left / .can-scroll-right in style.css) on
    // whichever side actually has tabs past it.
    //
    // ResizeObserver rather than a resize listener: a strip inside a hidden
    // page has no width to measure, so the first honest measurement is the one
    // taken when its page is shown.
    document.querySelectorAll('.tab-buttons').forEach(strip => {
        const sync = () => {
            const max = strip.scrollWidth - strip.clientWidth;
            strip.classList.toggle('can-scroll-left', strip.scrollLeft > 2);
            strip.classList.toggle('can-scroll-right', strip.scrollLeft < max - 2);
        };
        strip.addEventListener('scroll', sync, { passive: true });
        new ResizeObserver(sync).observe(strip);
        sync();
    });

    // --- FOOTER DISCLAIMER --- //
    // Collapsed on a phone, where four lines of disclaimer took a seventh of
    // the screen on every page; open on anything wide enough to hold it, since
    // a disclaimer nobody has to tap for is a better disclaimer. `open` cannot
    // be set from CSS and a closed <details> is not laid out at all, so the
    // width test lives here. Reacting to the change event covers rotation and
    // desktop window resizing, not just first load.
    const footerDisclaimer = document.querySelector('.footer-disclaimer');
    if (footerDisclaimer) {
        const wideEnough = window.matchMedia('(min-width: 768px)');
        const syncDisclaimer = (e) => { footerDisclaimer.open = e.matches; };
        syncDisclaimer(wideEnough);
        wideEnough.addEventListener('change', syncDisclaimer);
    }

    // --- HAMBURGER MENU --- //
    const hamburger = document.getElementById('hamburger-menu');
    const headerControls = document.getElementById('header-controls');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        headerControls.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburger.contains(e.target) && !headerControls.contains(e.target)) {
            hamburger.classList.remove('active');
            headerControls.classList.remove('active');
        }
    });

    // Close menu when a navigation button is clicked
    headerControls.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            hamburger.classList.remove('active');
            headerControls.classList.remove('active');
        });
    });

    // --- THEME TOGGLE --- //
    const themeToggle = document.getElementById('theme-toggle');
    const rootEl = document.documentElement; // Target <html> element for consistency
    themeToggle.addEventListener('click', () => {
        const isDarkMode = rootEl.hasAttribute('data-theme');
        if (isDarkMode) {
            rootEl.removeAttribute('data-theme');
            localStorage.removeItem('theme'); // Remove from storage
            themeToggle.textContent = '🌙 Dark Mode';
        } else {
            rootEl.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark'); // Save to storage
            themeToggle.textContent = '☀️ Light Mode';
        }
    });

    // --- PAGE NAVIGATION --- //
    const pageTitle = document.getElementById('page-title');
    const mainContent = document.getElementById('main-content');
    const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('[data-page]');
    const homeButton = document.getElementById('home-button');
    const aboutButton = document.getElementById('about-button');
    const feedbackButton = document.getElementById('feedback-button');
    const globalBackBtn = document.getElementById('global-back-btn');

    // How many in-app forward navigations are behind us this tab session.
    // An installed PWA often has no browser chrome at all, so the global
    // back button cannot lean on "does history.length look long enough" —
    // that's unreliable across browsers and meaningless after a fresh deep
    // link. This counts only navigations *this app* pushed, so the button
    // can tell "go back within the app" from "there is nothing to go back
    // to" and fall back to Home instead of leaving the app.
    let inAppNavCount = 0;

    // Selects a scale tab on the scales page, used for deep links and for the
    // "Go to X Scale" buttons on the syndrome pages.
    function selectScaleTab(tabId) {
        const targetTabButton = document.querySelector(`#scales-page .tab-button[data-tab="${tabId}"]`);
        if (targetTabButton) {
            targetTabButton.click();
            return true;
        }
        return false;
    }

    // `push` adds a history entry so the device Back button steps through the
    // app instead of leaving it. Route reads (hash on load, popstate) pass false.
    function showPage(pageId, { push = true, tabId = null } = {}) {
        const newPage = document.getElementById(pageId);
        if (!newPage || !newPage.classList.contains('page')) return false;

        pages.forEach(page => {
            page.classList.remove('active-page');
        });
        newPage.classList.add('active-page');

        const button = document.querySelector(`[data-page='${pageId}']`);
        let title = 'Substance Use Disorder (SUD) Toolkit'; // Default title
        if (button) {
            title = button.textContent.replace(/\n/g, ' ');
        } else if (pageId !== 'home-page') {
            title = newPage.dataset.title || 'Withdrawal Assistant';
        }
        pageTitle.textContent = title;
        document.title = title + ' - SUD Toolkit';

        if (pageId === 'alcohol-withdrawal-page') {
            startFlowchart();
        }

        if (tabId) {
            selectScaleTab(tabId);
        }

        const hash = '#' + pageId + (tabId ? '/' + tabId : '');
        if (push) {
            if (location.hash !== hash) {
                window.history.pushState({ pageId, tabId }, '', hash);
                inAppNavCount++;
            }
        } else {
            window.history.replaceState({ pageId, tabId }, '', hash);
        }

        if (globalBackBtn) {
            globalBackBtn.classList.toggle('visible', pageId !== 'home-page');
        }

        // Long pages otherwise keep the previous page's scroll position.
        mainContent.scrollTop = 0;
        return true;
    }

    // Resolves `#page-id` / `#page-id/tab-id` into a view. Falls back to home
    // for an unknown or empty hash, so a stale bookmark cannot leave a blank app.
    function applyRouteFromHash() {
        const [pageId, tabId] = location.hash.replace(/^#\/?/, '').split('/');
        if (!pageId || !showPage(pageId, { push: false, tabId: tabId || null })) {
            showPage('home-page', { push: false });
        }
    }

    window.addEventListener('popstate', applyRouteFromHash);

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.dataset.page;
            showPage(pageId);
        });
    });

    homeButton.addEventListener('click', () => showPage('home-page'));
    aboutButton.addEventListener('click', () => showPage('about-page'));

    if (globalBackBtn) {
        globalBackBtn.addEventListener('click', () => {
            // Real history.back() when we know it stays inside the app, so
            // it lands on the actual previous page rather than a fixed
            // destination — the .back-to-selection-btn buttons already
            // cover "take me to the substance list regardless of how I got
            // here"; this button means "undo my last navigation".
            if (inAppNavCount > 0) {
                inAppNavCount--;
                window.history.back();
            } else {
                showPage('home-page');
            }
        });
    }

    if (feedbackButton) {
        feedbackButton.addEventListener('click', () => {
            const feedbackUrl = 'mailto:trentkoessler@gmail.com?subject=SUD Toolkit Feedback';
            window.open(feedbackUrl, '_blank');
        });
    }

    // --- CRITERIA MODAL LOGIC ---
    const criteriaModal = document.getElementById('criteria-modal');
    const openCriteriaBtn = document.getElementById('open-criteria-modal-btn');
    if (criteriaModal) {
        const closeCriteriaBtn = criteriaModal.querySelector('.close-button');

        function openModal() {
            document.body.classList.add('modal-open');
            criteriaModal.style.display = 'block';
        }

        function closeModal() {
            document.body.classList.remove('modal-open');
            criteriaModal.style.display = 'none';
        }

        if (openCriteriaBtn) {
            openCriteriaBtn.addEventListener('click', openModal);
        }
        if (closeCriteriaBtn) {
            closeCriteriaBtn.addEventListener('click', closeModal);
        }
        window.addEventListener('click', (event) => {
            if (event.target == criteriaModal) closeModal();
        });
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && criteriaModal.style.display === 'block') {
                closeModal();
                if (openCriteriaBtn) openCriteriaBtn.focus();
            }
        });
    }

    // --- LINK TO SCALE BUTTONS ---
    // Handles buttons on the "Other Syndromes" page that link to specific calculator tabs.
    document.querySelectorAll('[data-link-to-scale]').forEach(button => {
        button.addEventListener('click', () => {
            // Navigate to the scales page and open the requested tab as a single
            // history entry, so one Back press returns to the syndrome page.
            showPage('scales-page', { tabId: button.dataset.linkToScale });
        });
    });
    // =================================================================
    // ALCOHOL WITHDRAWAL FLOWCHART LOGIC
    // =================================================================


    const flowchartPage = document.getElementById('alcohol-withdrawal-page');
    let flowchartHistory = [];

    function startFlowchart() {
        flowchartHistory = ['intake_assessment'];
        renderFlowchartStep('intake_assessment');
    }

    function renderFlowchartStep(stepId) {
        const stepData = FLOWCHART_LOGIC[stepId];
        if (!stepData) return;
        flowchartPage.innerHTML = '';
        const breadcrumbs = document.createElement('div');
        breadcrumbs.className = 'breadcrumbs';
        flowchartHistory.forEach((histStepId, index) => {
            const crumb = document.createElement('button');
            crumb.className = 'breadcrumb-button';
            crumb.textContent = FLOWCHART_LOGIC[histStepId].title;
            crumb.addEventListener('click', () => jumpToStep(index));
            breadcrumbs.appendChild(crumb);
            if (index < flowchartHistory.length - 1) {
                const separator = document.createElement('span');
                separator.textContent = ' > ';
                breadcrumbs.appendChild(separator);
            }
        });
        flowchartPage.appendChild(breadcrumbs);
        const textElement = document.createElement('p');
        textElement.className = 'flowchart-text';
        textElement.innerText = stepData.text;
        flowchartPage.appendChild(textElement);
        if (stepData.warning) {
            const warningElement = document.createElement('div');
            warningElement.className = 'warning-box';
            warningElement.innerHTML = stepData.warning;
            flowchartPage.appendChild(warningElement);
        }
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'flowchart-options';
        if (stepData.type === 'question') {
            stepData.options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'big-button';
                button.innerText = option.label;
                button.addEventListener('click', () => {
                    flowchartHistory.push(option.next_step);
                    renderFlowchartStep(option.next_step);
                });
                optionsContainer.appendChild(button);
            });
        } else if (stepData.type === 'outcome') {
            if (stepData.emr_summary) {
                const emrTitle = document.createElement('h3');
                emrTitle.textContent = 'EMR Summary';
                const emrOutput = document.createElement('textarea');
                emrOutput.readOnly = true;
                emrOutput.value = stepData.emr_summary;
                const copyButton = document.createElement('button');
                copyButton.textContent = 'Copy to Clipboard';
                copyButton.addEventListener('click', () => {
                    emrOutput.select();
                    navigator.clipboard.writeText(emrOutput.value);
                });
                optionsContainer.appendChild(emrTitle);
                optionsContainer.appendChild(emrOutput);
                optionsContainer.appendChild(copyButton);
            }
            if (stepData.guideline_link) {
                const guidelineBtn = document.createElement('button');
                guidelineBtn.className = 'big-button';
                guidelineBtn.textContent = 'View Inpatient Guidelines';
                guidelineBtn.addEventListener('click', () => showPage(stepData.guideline_link));
                optionsContainer.appendChild(guidelineBtn);
            }
            if (stepData.ambulatory_guideline_link) {
                const ambulatoryBtn = document.createElement('button');
                ambulatoryBtn.className = 'big-button';
                ambulatoryBtn.textContent = 'View Ambulatory Detox Guidelines';
                ambulatoryBtn.addEventListener('click', () => showPage(stepData.ambulatory_guideline_link));
                optionsContainer.appendChild(ambulatoryBtn);
            }
        }
        flowchartPage.appendChild(optionsContainer);
        const navContainer = document.createElement('div');
        navContainer.className = 'flowchart-nav';
        const backButton = document.createElement('button');
        backButton.textContent = 'Back';
        backButton.disabled = flowchartHistory.length <= 1;
        backButton.addEventListener('click', goBack);
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart';
        restartButton.addEventListener('click', startFlowchart);
        navContainer.appendChild(backButton);
        navContainer.appendChild(restartButton);
        flowchartPage.appendChild(navContainer);
    }

    function goBack() {
        if (flowchartHistory.length > 1) {
            flowchartHistory.pop();
            renderFlowchartStep(flowchartHistory[flowchartHistory.length - 1]);
        }
    }

    function jumpToStep(index) {
        flowchartHistory = flowchartHistory.slice(0, index + 1);
        renderFlowchartStep(flowchartHistory[flowchartHistory.length - 1]);
    }

    // --- TAB NAVIGATION --- //
    document.querySelectorAll('.tab-container').forEach(container => {
        const tabButtons = container.querySelectorAll(':scope > .tab-buttons > .tab-button');
        const tabContents = container.querySelectorAll(':scope > .tab-content');

        function selectTab(button) {
            if (!button) return;
            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            tabContents.forEach(content => content.classList.remove('active'));
            const activeContent = container.querySelector(`#${button.dataset.tab}`);
            if (activeContent) activeContent.classList.add('active');
        }

        tabButtons.forEach(button => {
            button.addEventListener('click', () => selectTab(button));
        });

        // A cross-reference from one tab's body to another tab, so "the test-dose
        // protocol is on the Assessment tab" can be followed rather than hunted for.
        container.addEventListener('click', (event) => {
            const link = event.target.closest('[data-tab-link]');
            if (!link || !container.contains(link)) return;
            const target = container.querySelector(
                `:scope > .tab-buttons > .tab-button[data-tab="${link.dataset.tabLink}"]`);
            if (!target) return;
            selectTab(target);
            target.scrollIntoView({ block: 'nearest' });
        });

        // Sync panels to whichever button is marked active in the markup. Without
        // this the panel only gains .active on click, so a tab flagged active in
        // HTML but whose panel is not renders an empty container on first view.
        selectTab(container.querySelector(':scope > .tab-buttons > .tab-button.active') || tabButtons[0]);
    });

    // =================================================================
    // INPATIENT GUIDELINES LOGIC
    // =================================================================
    const benzoChoiceBtns = document.querySelectorAll('.benzo-choice-btn');
    const regimenSeverityBtns = document.querySelectorAll('.regimen-severity-btn');
    const regimenTypeBtns = document.querySelectorAll('.regimen-type-btn');
    const intensityAxis = document.getElementById('intensity-axis');
    const testDoseDisplay = document.getElementById('test-dose-protocol');
    const benzoSelectionDisplay = document.getElementById('benzo-selection-display');
    const regimenBenzoDisplay = document.getElementById('regimen-benzo-display');
    const regimenDisplayDiv = document.getElementById('regimen-display');
    const scaleChoiceBtns = document.querySelectorAll('.scale-choice-btn');
    let selectedBenzo = 'Diazepam';
    let selectedSeverity = 'mild';
    // The selector asks two questions, because they have different answers.
    // Regimen type is decided by the patient - seizure history, other-drug
    // withdrawal, comorbidity, the setting - and intensity by the score. The
    // row used to mix the two, offering "Symptom-Triggered" and "Severe" as
    // though they were the same kind of choice. Only a fixed schedule needs an
    // intensity: symptom-triggered dosing carries its own dose-per-score table,
    // and loading and the test dose are single protocols.
    let selectedType = 'fixed';
    const TYPE_CELL = { symptom: 'symptom', loading: 'loading' };
    const activeCellKey = () => (selectedType === 'fixed' ? selectedSeverity : TYPE_CELL[selectedType]);
    // Which withdrawal scale the ward charts. Scoped to the Regimens tab: it
    // decides how bands are labelled here and in the EMR paste. The Monitoring
    // tab deliberately keeps both scales, since its table is the mapping.
    let selectedScale = 'ciwa';
    const SCALE_LABEL = { ciwa: 'CIWA-Ar', aws: 'AWS' };

    // Bands are stored as thresholds only, in both scales. The label is applied
    // here so a band can never render under the wrong scale's name.
    const bandLabel = (b) => `${SCALE_LABEL[selectedScale]} ${b[selectedScale]}`;

    // Title is composed rather than stored: the same cell reads
    // "Mild-Moderate (CIWA-Ar 10-15) - Diazepam" or "Mild-Moderate (AWS 4-14) -
    // Oxazepam". The drug is appended here, once, rather than being written
    // into some cell names and not others.
    const regimenTitle = (cell) => (cell.band ? `${cell.name} (${bandLabel(cell.band)})` : cell.name)
        + ` - ${REGIMEN_CONFIG[selectedBenzo].name}`;

    // --- EMR EXPORT (AUTH-06) --- //

    // Turns rendered clinical markup into something that survives being pasted
    // into an EMR text field. Built from the live DOM rather than from the data
    // modules, so what is copied is by construction what the clinician read.
    // Citations are dropped rather than bracketed: the point of a paste is an
    // uncluttered prescribing block, and the app remains the source of record.
    function elementToPlainText(root) {
        if (!root) return '';
        const clone = root.cloneNode(true);

        clone.querySelectorAll('.src-tag').forEach(tag => tag.remove());
        // Buttons are controls, not content; copying their labels is noise.
        clone.querySelectorAll('button, .clinical-table-wrap').forEach(el => {
            if (el.tagName === 'BUTTON') el.remove();
        });

        const collapse = (s) => s.replace(/\s+/g, ' ').trim();
        // Recurse only into containers that hold other blocks. A callout whose
        // children are all inline (<strong>, <span>) is a paragraph, and walking
        // into it would emit the bold fragments and silently drop the prose
        // between them.
        const BLOCK = /^(DIV|SECTION|ARTICLE|UL|OL|TABLE|P|H[1-6])$/;
        const hasBlockChildren = (el) => [...el.children].some(c => BLOCK.test(c.tagName));

        const lines = [];
        const walk = (node) => {
            for (const child of node.children) {
                const tag = child.tagName;
                if (tag === 'UL' || tag === 'OL') {
                    [...child.children].forEach(li => lines.push('  - ' + collapse(li.textContent)));
                } else if (tag === 'TABLE') {
                    [...child.querySelectorAll('tr')].forEach(row => {
                        lines.push('  ' + [...row.children].map(c => collapse(c.textContent)).join(' | '));
                    });
                } else if (/^H[1-6]$/.test(tag)) {
                    lines.push('', collapse(child.textContent).toUpperCase());
                } else if (hasBlockChildren(child)) {
                    walk(child);
                } else {
                    const text = collapse(child.textContent);
                    if (text) lines.push(text);
                }
            }
        };
        walk(clone);
        return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    // Clinical strings in data/regimens.js are markup. This renders one as the
    // single plain line it becomes in an EMR field, citations removed.
    function plainLine(html) {
        return html
            .replace(/<span class="src-tag[\s\S]*?<\/span>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&asymp;/g, '~').replace(/&rarr;/g, '->').replace(/&ge;/g, '>=')
            .replace(/&nbsp;/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    // Some cells use the `prn` slot for advice rather than doses - the test-dose
    // protocol's "monitor closely, consult D&A" pair, for instance. Labelling
    // those "PRN dosing" reads as an instruction to give something. A dose
    // object, or free text naming a dose, is dosing; the rest is advice. Severe
    // withdrawal states its PRN as prose ("diazepam 10-20mg 2-hourly PRN"), so
    // the test cannot be "is it an object".
    const prnHeading = (entries) => entries.some(e => (typeof e === 'string' ? /\d\s*mg/i.test(e) : e.dose))
        ? 'PRN dosing'
        : 'Additional advice';

    // Whether a regimen carries anything this app does not trace to NSWCG.
    //
    // The provenance line on the paste says "NSW Health-derived", which is true
    // of the severe regimens and of nothing else here: the test-dose protocol is
    // local outright, the oxazepam schedules are converted, the sub-mild options
    // are derived from this site's own ambulatory doses. Stamping a flat NSWCG
    // claim on those would put a false attribution in a patient record - the
    // exact failure the line exists to prevent - so the claim is qualified from
    // the cell's own source tags rather than asserted for all of them.
    const cellHasLocalContent = (cell) => [
        ...(cell.caveat || []), ...(cell.schedule || []), ...(cell.prn || []),
        ...(cell.routing || []), ...(cell.setting || [])
    ].some(s => typeof s === 'string' && /src-local|src-nswcg-adapted/.test(s));

    // Under AWS, the two PRN triggers on a fixed schedule collapse into one band
    // (both are AWS 4-14) at two different doses, because NSWCG's AWS mapping is
    // coarser than the CIWA-Ar split this app uses. Naming the CIWA-Ar sub-band
    // alongside is the honest resolution: silently rendering "AWS 4-14" twice
    // with different doses would be an instruction a nurse cannot follow.
    function prnBandLabel(entry, allEntries) {
        const label = selectedScale === 'aws' ? `AWS ${entry.aws}` : `CIWA-Ar ${entry.range}`;
        if (selectedScale !== 'aws') return label;
        const ambiguous = allEntries.filter((e) => typeof e !== 'string' && e.aws === entry.aws).length > 1;
        return ambiguous ? `${label} (CIWA-Ar ${entry.range})` : label;
    }

    // The EMR paste. Deliberately short: the doses, how often to score, and the
    // three things that stop a schedule being followed off a cliff - the
    // 2-hourly floor, withholding when sedated, and the 24-hour review total.
    //
    // It is built from REGIMEN_CONFIG rather than scraped from the rendered
    // page, so band selection, monitoring frequency, escalation triggers,
    // discharge rules and thiamine - all of which the clinician has on screen -
    // stay out of the paste. Citations are dropped: the app is the source of
    // record, and a prescribing block is read at the drug chart, not audited.
    function buildRegimenSummary() {
        const config = REGIMEN_CONFIG[selectedBenzo];
        const data = config[activeCellKey()];
        const drug = config.name;
        const scale = SCALE_LABEL[selectedScale];
        const out = [`ALCOHOL WITHDRAWAL - ${plainLine(regimenTitle(data))}`, ''];

        if (data.routing) {
            // No regimen exists for this cell (severe withdrawal on oxazepam).
            // The routing advice IS the medication advice, so it is the body.
            data.routing.forEach((item) => out.push(`- ${plainLine(item)}`));
        } else if (data.bands) {
            out.push(`Score ${scale} at the interval for the current band, and give that band's dose:`);
            data.bands.forEach((b) => {
                out.push(`  - ${plainLine(bandLabel(b))}: ${plainLine(b.dose)}, rescore ${b.monitoring}`);
            });
        } else if (typeof data.schedule[0] === 'string') {
            data.schedule.forEach((item) => out.push(`- ${plainLine(item)}`));
        } else {
            out.push('Scheduled dosing:');
            data.schedule.forEach((s, i) => {
                out.push(`  - Day ${i + 1}: ${drug} ${s.dose}mg ${s.freq}`);
            });
        }

        if (data.prn && data.prn.length > 0) {
            out.push('', `${prnHeading(data.prn)}:`);
            data.prn.forEach((p) => {
                out.push(typeof p === 'string'
                    ? `  - ${plainLine(p)}`
                    : `  - ${prnBandLabel(p, data.prn)}: extra ${drug} ${p.dose}mg PRN`);
            });
        }

        // The tail lines are added only where the regimen has not already said
        // the same thing in its own words. A loading regimen states its own
        // 2-hourly interval and its own 80mg review point; repeating them
        // underneath invites the reader to treat the two as different rules.
        const body = out.join('\n');
        out.push('');
        // Symptom-triggered dosing states its own frequency per band above, so
        // repeating a single figure here would contradict the list.
        if (data.monitoring && !data.bands) {
            out.push(data.monitoring === 'hourly'
                ? `Score ${scale} hourly.`
                : `Score ${scale} ${INITIAL_SCORING_INTERVAL}, then ${data.monitoring} while the score stays in band.`);
        }
        if (!data.routing && !/2-hourly|q2hrly/i.test(body)) {
            out.push(EMR_SAFETY_LINES.dosingInterval);
        }
        out.push(EMR_SAFETY_LINES.sedation);
        if (config.reviewMax && !data.routing && !/in 24 hours/i.test(body)) {
            out.push(EMR_SAFETY_LINES.review(drug.toLowerCase(), config.reviewMax));
        }

        // Where this came from. Pasted text outlives the screen it was read on:
        // a regimen sitting in a patient record with no attribution cannot be
        // checked back against its basis by whoever reads the note next. The
        // version matters as much as the source - regimens change between
        // releases, and this says which one produced these numbers.
        //
        // ASCII hyphen, not an em dash: the rest of this block is deliberately
        // plain text because EMR fields mangle anything that is not.
        out.push('', `Generated from SUD Toolkit v${APP_VERSION} - NSW Health-derived`
            + `${cellHasLocalContent(data) ? ' with local adaptations' : ''}; sources in app.`);

        return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    }

    // Condensed, citation-free version of the Day 1-3 buprenorphine and
    // methadone steps above — for pasting into a treatment plan or handover
    // note, where the source tags this app carries everywhere else would
    // just be noise. The doses are the same ones cited (with sources) in the
    // Buprenorphine and Methadone sections on this page; this function does
    // not introduce any figure that is not already stated and sourced there.
    function buildOpioidQuickStart() {
        return [
            '--- QUICK-START: BUPRENORPHINE COMMENCEMENT ---',
            'WARNING: Defer the first dose until the patient is in objective withdrawal (COWS >= 8) to avoid precipitated withdrawal.',
            '',
            'Day 1:',
            '  - Test dose: 2mg sublingually.',
            '  - Review at 1 hour. If no increase in severity and still in withdrawal, give a further 6mg.',
            '  - Mild withdrawal (COWS 4-8): an alternative is 4mg initially, plus a further 4mg after 1-2 hours.',
            '  - Total Day 1 dose: 8-12mg outpatient, 8-16mg inpatient.',
            '',
            'Day 2 (if continuing as Opioid Agonist Treatment):',
            '  - Increase in 2, 4 or 8mg increments as needed, up to 16mg.',
            '  - (If instead tapering for time-limited withdrawal, see the full page - Day 2 reduces, it does not increase.)',
            '',
            'Day 3 onward (Opioid Agonist Treatment):',
            '  - Continue increasing in 2, 4 or 8mg increments, up to 24mg on Day 3, toward a stable dose.',
            '  - More for ongoing withdrawal; less for intoxication or oversedation.',
            '  - Consult an addiction medicine specialist if higher or faster increases are needed, or the patient must suddenly stop a prescribed opioid.',
            '',
            '--- QUICK-START: METHADONE COMMENCEMENT ---',
            'WARNING: Overdose risk is highest in the first 1-2 weeks, while methadone accumulates toward steady state (4-7 days). All doses supervised; review daily before dosing in week 1.',
            '',
            'Day 1:',
            '  - Commence 20-30mg daily.',
            '  - Consider lower (<20mg) for low/uncertain tolerance, high-risk polydrug use (alcohol, benzodiazepines), or other severe medical complications.',
            '  - Specialist consultation required before starting above 40mg.',
            '',
            'Days 2-3:',
            '  - Assess for intoxication ~2-3 hours after dosing (peak effect), and for withdrawal control at 24 hours.',
            '',
            'Day 4 onward:',
            '  - Increase by 5-10mg every 3-5 days if withdrawal features suggest not enough methadone.',
            '  - Typical trajectory: 30-50mg by end of week 1, 40-60mg by end of week 2.',
            '  - Consult an addiction medicine specialist for faster/higher increases, unclear tolerance, high-risk polydrug use, or difficulty stabilising.',
            '',
            '---',
            'Condensed quick-start reference only - see the full Opioid Withdrawal page for the complete protocol, ',
            'precipitated-withdrawal recognition, and when to seek specialist advice.',
            `Generated by SUD Toolkit v${APP_VERSION}. Adult patients only. Verify against local policy and current `
            + 'NSW Health guidance before use; this is decision support, not a prescription.'
        ].join('\n');
    }

    // Shared by the regimen panel and the monitoring/equivalence tables. Wrapped
    // so a wide table scrolls inside its own box rather than widening the page
    // on a phone, which is where this app is mostly read.
    function renderClinicalTable({ headers, rows, caption }) {
        const head = headers.map(h => `<th scope="col">${h}</th>`).join('');
        const body = rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('');
        return `<div class="clinical-table-wrap"><table class="clinical-table">`
            + (caption ? `<caption>${caption}</caption>` : '')
            + `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }

    // One renderer, two callers: the Regimens panel and the test-dose protocol on
    // the Assessment tab. They render the same shape of cell out of the same
    // config, so a second copy of this markup would be a second thing to keep
    // correct. `showBandEscalationNote` is the only caller-specific bit — it only
    // makes sense for a banded fixed schedule.
    function renderCell(data, b_name, { showBandEscalationNote = false } = {}) {
        // A `routing` cell is one where no regimen should be rendered at all —
        // severe withdrawal on oxazepam, for instance. Returning advice instead
        // of a dose list is the point, so bail out before the schedule loop
        // rather than rendering an empty one. The EMR preview is still refreshed
        // on the way out: a routing card that left the previous regimen's doses
        // sitting in the textarea would be the worst possible stale paste.
        if (data.routing) {
            return `<h3>${regimenTitle(data)}</h3>`
                + data.routing.map(item => `<div class="routing-card">${item}</div>`).join('');
        }

        let displayHTML = `<h3>${regimenTitle(data)}</h3>`;

        // Where to manage the patient comes before what to prescribe, so it is
        // rendered above everything else rather than under PRN dosing.
        if (data.setting) {
            displayHTML += `<div class="clinical-block"><h4>Setting</h4>`
                + data.setting.map(item => `<p>${item}</p>`).join('')
                + `</div>`;
        }

        // Shown before the doses, never after: a caveat that qualifies a whole
        // schedule is useless underneath it.
        // An array: a cell can carry more than one (an oxazepam symptom-triggered
        // regimen is both converted and conditional on the care setting).
        // Collapsed by default so caveats don't stack into a wall of text above
        // the doses — but every caveat opens with its own bold lead-in sentence
        // (e.g. "Conversion caveat."), which becomes the <summary>, so the
        // substance is visible without expanding it. Only the elaboration and
        // source-tag rationale are hidden behind the toggle.
        (data.caveat || []).forEach(caveat => {
            const leadIn = caveat.match(/^<b>(.*?)<\/b>\s*/);
            if (leadIn) {
                displayHTML += `<details class="warning-box"><summary>${leadIn[1]}</summary>${caveat.slice(leadIn[0].length)}</details>`;
            } else {
                displayHTML += `<div class="warning-box">${caveat}</div>`;
            }
        });

        // Score-banded dosing (symptom-triggered). A list, not a table: this is
        // the block clinicians paste into the EMR, where a table degrades into
        // pipe-separated rows, and one scale is shown rather than two so the
        // line a nurse reads at the drug chart is the one their ward charts.
        // Rendered above the notes because the bands are the regimen and the
        // notes qualify them.
        if (data.bands) {
            displayHTML += `<b>Dose to the ${SCALE_LABEL[selectedScale]} score:</b><ul class="band-list">`
                + data.bands.map(b => `<li><b>${bandLabel(b)}</b> &rarr; ${b.dose}`
                    + ` <span class="band-monitoring">(rescore ${b.monitoring})</span></li>`).join('')
                + `</ul>`;
        }

        // "Scheduled Dosing" is wrong for a cell that is not a schedule - the
        // test-dose protocol is one observed dose and a decision point - so a cell
        // may name its own heading.
        displayHTML += `<b>${data.scheduleHeading || (data.bands ? 'Notes' : 'Scheduled Dosing')}:</b><ul>`;
        data.schedule.forEach((s, index) => {
            if (typeof s === 'string') {
                displayHTML += `<li>${s}</li>`;
            } else {
                displayHTML += `<li>Day ${index + 1}: ${b_name} ${s.dose}mg ${s.freq}`;
                if (s.note) {
                    displayHTML += ` <i>(${s.note})</i>`;
                }
                displayHTML += `</li>`;
            }
        });
        displayHTML += `</ul>`;

        if (data.prn && data.prn.length > 0) {
            displayHTML += `<b>${prnHeading(data.prn)}:</b>`;
            if (showBandEscalationNote) {
                displayHTML += `<div><i>Consider increasing the regular regimen by a band if PRN is being used `
                    + `frequently (e.g. more than two times daily).</i></div>`;
            }
            displayHTML += `<ul>`;
            data.prn.forEach(p => {
                if (typeof p === 'string') {
                    displayHTML += `<li>${p}</li>`;
                } else {
                    displayHTML += `<li>${prnBandLabel(p, data.prn)}: extra ${b_name} ${p.dose}mg PRN</li>`;
                }
            });
            displayHTML += `</ul>`;
        }

        return displayHTML;
    }

    function updateRegimenDisplay() {
        if (!regimenDisplayDiv) return;

        const config = REGIMEN_CONFIG[selectedBenzo];
        const data = config[activeCellKey()];

        // Intensity is meaningless for the two single-protocol types, so the row
        // is removed from the page rather than left visible and inert.
        if (intensityAxis) intensityAxis.hidden = selectedType !== 'fixed';

        // The EMR preview is refreshed even for a routing card: one that left the
        // previous regimen's doses sitting in the textarea would be the worst
        // possible stale paste.
        regimenDisplayDiv.innerHTML = renderCell(data, config.name, {
            showBandEscalationNote: selectedType === 'fixed'
                && (selectedSeverity === 'mild' || selectedSeverity === 'moderate')
        });
        updateBandLabels();
        refreshRegimenSummary();
    }

    // The preview is rebuilt with the panel, not on click: a textarea still
    // showing the previous regimen's doses after switching severity, drug or
    // scale is a paste waiting to go into the wrong chart.
    // The test-dose protocol is an assessment manoeuvre, not a regimen: it ends
    // by telling you which regimen to start. It lives on the Assessment tab for
    // that reason, but it still prescribes a drug, so it follows the benzo choice.
    function updateTestDoseDisplay() {
        if (!testDoseDisplay) return;
        const config = REGIMEN_CONFIG[selectedBenzo];
        testDoseDisplay.innerHTML = renderCell(config.unknown, config.name);
    }

    function refreshRegimenSummary() {
        const preview = document.getElementById('plan-summary');
        if (preview) preview.value = buildRegimenSummary();
    }

    // The severity buttons name their band too, so they have to follow the
    // toggle or the page would offer "Mild-Mod (CIWA-Ar 10-15)" as the route to
    // a panel headed "AWS 4-14".
    function updateBandLabels() {
        document.querySelectorAll('.band-label').forEach(el => {
            const text = el.dataset[selectedScale];
            if (text) el.textContent = text;
        });
        // Where the AWS bands came from only matters to a ward that charts AWS.
        // Shown to everyone it was three lines of derivation above the selector,
        // duplicating the AWS note already collapsed on each schedule.
        const awsNote = document.getElementById('aws-band-note');
        if (awsNote) awsNote.hidden = selectedScale !== 'aws';
    }

    scaleChoiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedScale = btn.dataset.scale;
            scaleChoiceBtns.forEach(b => {
                const on = b.dataset.scale === selectedScale;
                b.classList.toggle('active', on);
                b.setAttribute('aria-pressed', String(on));
            });
            updateRegimenDisplay();
        });
    });

    benzoChoiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBenzo = btn.dataset.benzo;
            benzoChoiceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (benzoSelectionDisplay) benzoSelectionDisplay.textContent = selectedBenzo;
            if (regimenBenzoDisplay) regimenBenzoDisplay.textContent = selectedBenzo;
            updateRegimenDisplay();
            updateTestDoseDisplay();
        });
    });

    // Pressed state is applied from the current selection rather than at the
    // click site, so the routing card's "switch to Loading" button and a real
    // click on the type row cannot disagree about what is selected.
    function syncSelectorButtons() {
        regimenTypeBtns.forEach(b => {
            const on = b.dataset.regimenType === selectedType;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
        regimenSeverityBtns.forEach(b => {
            const on = selectedType === 'fixed' && b.dataset.severity === selectedSeverity;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
    }

    function selectRegimenType(type) {
        selectedType = type;
        syncSelectorButtons();
        updateRegimenDisplay();
    }

    regimenTypeBtns.forEach(btn => {
        btn.addEventListener('click', () => selectRegimenType(btn.dataset.regimenType));
    });

    regimenSeverityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSeverity = btn.dataset.severity;
            selectedType = 'fixed';
            syncSelectorButtons();
            updateRegimenDisplay();
        });
    });

    // The Severe intensity holds no schedule - it explains that severe
    // withdrawal is loaded, and offers the switch. Delegated because the card
    // is re-rendered on every change.
    if (regimenDisplayDiv) {
        regimenDisplayDiv.addEventListener('click', (event) => {
            const target = event.target.closest('[data-select-type]');
            if (target) selectRegimenType(target.dataset.selectType);
        });
    }

    // Built from REGIMEN_CONFIG, so it is cheap enough to rebuild with the
    // panel; this handler only has to copy what is already shown.
    const planSummaryEl = document.getElementById('plan-summary');
    const copyPlanBtn = document.getElementById('copy-plan-btn');
    if (planSummaryEl && copyPlanBtn) {
        copyPlanBtn.addEventListener('click', () => {
            planSummaryEl.value = buildRegimenSummary();
            planSummaryEl.select();
            navigator.clipboard.writeText(planSummaryEl.value);
            const original = copyPlanBtn.textContent;
            copyPlanBtn.textContent = 'Copied!';
            setTimeout(() => { copyPlanBtn.textContent = original; }, 2000);
        });
    }

    const opioidQuickStartEl = document.getElementById('opioid-quickstart-summary');
    const copyOpioidQuickStartBtn = document.getElementById('copy-opioid-quickstart-btn');
    if (opioidQuickStartEl && copyOpioidQuickStartBtn) {
        copyOpioidQuickStartBtn.addEventListener('click', () => {
            opioidQuickStartEl.value = buildOpioidQuickStart();
            opioidQuickStartEl.select();
            navigator.clipboard.writeText(opioidQuickStartEl.value);
            const original = copyOpioidQuickStartBtn.textContent;
            copyOpioidQuickStartBtn.textContent = 'Copied!';
            setTimeout(() => { copyOpioidQuickStartBtn.textContent = original; }, 2000);
        });
    }

    // Generic quick-start copy for the other substance pages with a plain
    // dosing regimen. A page opts in by marking the relevant .clinical-
    // block(s) with data-quickcopy and pairing a
    // <textarea id="X-quickstart-summary"> with a
    // <button id="copy-X-quickstart-btn">. Unlike opioid's above (which
    // needed hand-written reconciliation between two overlapping NSWCG/OAT
    // protocols), these are built straight from the marked DOM content, so
    // one generic handler covers all of them without drifting from the page.
    document.querySelectorAll('button[id^="copy-"][id$="-quickstart-btn"]').forEach(btn => {
        if (btn.id === 'copy-opioid-quickstart-btn') return; // already wired above
        const textarea = document.getElementById(btn.id.replace(/^copy-/, '').replace(/-btn$/, '-summary'));
        const page = btn.closest('.page');
        if (!textarea || !page) return;
        btn.addEventListener('click', () => {
            const blocks = [...page.querySelectorAll('[data-quickcopy]')];
            const body = blocks
                .map(el => elementToPlainText(el))
                .filter(Boolean)
                .join('\n\n');
            const text = [
                `${(page.dataset.title || page.id).toUpperCase()} - QUICK-START REFERENCE`,
                '',
                body,
                '',
                '---',
                'Condensed quick-start reference only - see the full page for the complete protocol and sourcing.',
                `Generated by SUD Toolkit v${APP_VERSION}. Adult patients only. Verify against local policy and `
                + 'current NSW Health guidance before use; this is decision support, not a prescription.'
            ].join('\n');
            textarea.value = text;
            textarea.select();
            navigator.clipboard.writeText(text);
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        });
    });

    if (document.getElementById('inpatient-guidelines-page')) {
        updateRegimenDisplay();
        updateTestDoseDisplay();
    }

    // =================================================================
    // CALCULATOR LOGIC
    // =================================================================

    // --- Standard Drink Calculator by Type ---
    const calculateByTypeBtn = document.getElementById('calculate-by-type');
    if (calculateByTypeBtn) {
        calculateByTypeBtn.addEventListener('click', () => {
            let totalSd = 0;
            const inputs = document.querySelectorAll('#std-by-type input[type="number"]');
            inputs.forEach(input => {
                const qty = Math.max(0, parseFloat(input.value) || 0); // Prevent negative quantities
                const sd = parseFloat(input.dataset.sd) || 0;
                totalSd += qty * sd;
            });
            document.getElementById('type-result').value = `--- Total Standard Drinks ---\n\nTotal: ${totalSd.toFixed(2)} standard drinks.`;
        });
    }

    // --- Standard Drink Calculator by Volume ---
    const calculateByVolumeBtn = document.getElementById('calculate-by-volume');
    if (calculateByVolumeBtn) {
        calculateByVolumeBtn.addEventListener('click', () => {
            const volume = Math.max(0, parseFloat(document.getElementById('volume-ml').value) || 0);
            const abv = Math.max(0, parseFloat(document.getElementById('abv-percent').value) || 0);
            const result = (volume / 1000) * abv * 0.789;
            document.getElementById('volume-result').value = `--- Standard Drink Calculation ---\n\nA ${volume}mL beverage at ${abv}% ABV contains:\n\n--> ${result.toFixed(2)} standard drinks.\n\nFormula: Volume (L) × ABV (%) × 0.789 (density of ethanol)`;
        });
    }

    // --- Generic Reset for Standard Drink Forms ---
    document.querySelectorAll('#std-drinks .reset-btn').forEach(button => {
        button.addEventListener('click', () => {
            const parentTab = button.closest('.tab-content');
            if (parentTab) {
                parentTab.querySelectorAll('input[type="number"]').forEach(input => input.value = '');
                parentTab.querySelector('textarea').value = '';
            }
        });
    });

    // --- REUSABLE CALCULATOR SETUP FUNCTION ---
    function setupCalculator(config) {
        const template = document.getElementById('calculator-template');
        if (!template) {
            console.error("Calculator template not found!");
            return;
        }

        const tabContent = document.getElementById(config.id);
        if (!tabContent) {
            console.error(`Container for calculator "${config.id}" not found!`);
            return;
        }

        // 1. Create the calculator instance from the template
        const calculatorNode = template.cloneNode(true);
        calculatorNode.removeAttribute('id');
        calculatorNode.style.display = 'block';

        // 2. Get references to elements WITHIN the new node
        const titleNode = calculatorNode.querySelector('.calculator-title');
        const noteNode = calculatorNode.querySelector('.calculator-note');
        const itemsContainer = calculatorNode.querySelector('.calculator-items');
        const totalScoreEl = calculatorNode.querySelector('.total-score');
        const severityEl = calculatorNode.querySelector('.severity');
        const emrSummaryEl = calculatorNode.querySelector('.emr-summary');
        const copyBtn = calculatorNode.querySelector('.copy-btn');
        const resetBtn = calculatorNode.querySelector('.reset-btn');

        // 3. Populate the instance
        titleNode.textContent = config.name;
        if (config.note) {
            noteNode.innerHTML = `<i>${config.note}</i>`;
            noteNode.style.display = 'block';
        } else {
            noteNode.style.display = 'none';
        }

        // Add a return button to the related clinical guidelines page if configured
        if (config.relatedPage) {
            const backBtn = document.createElement('button');
            backBtn.className = 'back-to-selection-btn';
            backBtn.textContent = `← Back to ${config.relatedPage.title}`;
            backBtn.addEventListener('click', () => showPage(config.relatedPage.id));
            calculatorNode.insertBefore(backBtn, titleNode);
        }

        let itemsHtml = '';
        config.items.forEach(item => {
            itemsHtml += `<fieldset class="calculator-item"><legend>${item.displayName}</legend>`;
            if (item.instruction) {
                itemsHtml += `<p class="calculator-item-instruction">${item.instruction}</p>`;
            }
            item.options.forEach((opt, index) => {
                const isChecked = index === 0 ? 'checked' : '';
                itemsHtml += `
                <div class="radio-option">
                    <label>
                        <input type="radio" name="${item.radioName}" value="${opt.value}" ${isChecked}>
                        ${opt.label}
                    </label>
                </div>`;
            });
            itemsHtml += `</fieldset>`;
        });
        itemsContainer.innerHTML = itemsHtml;

        // Caveats sit immediately above the score, not below it and not on a
        // separate page: the calculator's own output is what invites the
        // misreading they exist to prevent.
        const caveats = [...SCALE_CAVEATS_UNIVERSAL, ...(config.caveats || [])];
        const caveatNode = document.createElement('div');
        caveatNode.className = 'scale-caveats';
        caveatNode.innerHTML = `<h4>What this scale can and cannot tell you</h4><ul>`
            + caveats.map(c => `<li>${c}</li>`).join('')
            + `</ul>`;
        calculatorNode.insertBefore(caveatNode, calculatorNode.querySelector('.results-grid'));

        // Add reference if it exists
        if (config.reference) {
            const referenceNode = document.createElement('div');
            referenceNode.className = 'calculator-reference';
            referenceNode.innerHTML = `<strong>Reference:</strong><br>${config.reference}`;
            calculatorNode.appendChild(referenceNode);
        }

        // 4. Clear the target tab and append the new calculator
        tabContent.innerHTML = '';
        tabContent.appendChild(calculatorNode);

        // 5. Define a function that operates on this specific instance's elements
        function updateCalculatorState() {
            let totalScore = 0;
            const checkedRadios = itemsContainer.querySelectorAll('input[type="radio"]:checked');
            checkedRadios.forEach(radio => {
                totalScore += parseInt(radio.value, 10);
            });

            const severity = config.severityLogic(totalScore);
            totalScoreEl.textContent = totalScore;
            severityEl.textContent = severity;

            let summary = `${config.name} assessed. Total score: ${totalScore} (${severity}).\nBreakdown:\n`;
            config.items.forEach(item => {
                const radio = itemsContainer.querySelector(`input[name="${item.radioName}"]:checked`);
                if (radio) {
                    const selectedOption = item.options.find(opt => opt.value == radio.value);
                    let labelText = radio.value; // Fallback to just the score
                    if (selectedOption) {
                        // Get the descriptive text and strip any HTML tags for a clean summary
                        labelText = selectedOption.label.replace(/<[^>]*>?/gm, '');
                    }
                    summary += `- ${item.displayName}: ${labelText}\n`;
                }
            });
            emrSummaryEl.value = summary.trim();
        }

        // 6. Add event listeners
        itemsContainer.addEventListener('change', updateCalculatorState);

        copyBtn.addEventListener('click', (e) => {
            emrSummaryEl.select();
            navigator.clipboard.writeText(emrSummaryEl.value);
            const btn = e.target;
            const originalText = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = originalText; }, 2000);
        });

        resetBtn.addEventListener('click', () => {
            itemsContainer.querySelectorAll('fieldset').forEach(fieldset => {
                const firstRadio = fieldset.querySelector('input[type="radio"]');
                if (firstRadio) {
                    firstRadio.checked = true;
                }
            });
            updateCalculatorState(); // Recalculate after resetting
        });

        // 7. Set initial state
        updateCalculatorState();
    }

    // --- SHARED SYMPTOMATIC MEDICATION BLOCKS --- //
    // One structure rendered into each substance page's placeholder, so a dose
    // correction lands everywhere at once instead of on whichever page was open.
    document.querySelectorAll('[data-symptomatic]').forEach(host => {
        const set = SYMPTOMATIC[host.dataset.symptomatic];
        if (!set) {
            console.warn('no symptomatic set named', host.dataset.symptomatic);
            return;
        }
        const items = set.items.map(item =>
            `<h5>${item.symptom}</h5><ul>${item.lines.map(l => `<li>${l}</li>`).join('')}</ul>`).join('');
        host.classList.add('shared-block');
        host.innerHTML = `<h4>${set.title}</h4>`
            + (set.intro ? `<p>${set.intro}</p>` : '')
            + items
            + `<h5>Rules that apply to all of the above</h5><ul>`
            + SYMPTOMATIC_UNIVERSAL.map(rule => `<li>${rule}</li>`).join('')
            + `</ul>`;
    });

    // --- SHARED HARM REDUCTION BLOCKS --- //
    document.querySelectorAll('[data-harm-reduction]').forEach(host => {
        const blocks = HARM_REDUCTION[host.dataset.harmReduction];
        if (!blocks) {
            console.warn('no harm reduction set named', host.dataset.harmReduction);
            return;
        }
        host.classList.add('shared-block');
        host.innerHTML = `<h4>Harm reduction</h4>` + blocks.map(block => {
            const body = `<h5>${block.heading}</h5><ul>`
                + block.points.map(p => `<li>${p}</li>`).join('')
                + `</ul><p>${block.source}</p>`;
            // The blocks a clinician must not skim get the danger treatment;
            // the rest read as a list, so the emphasis stays meaningful.
            return block.danger ? `<div class="danger-box">${body}</div>` : body;
        }).join('');
    });

    // --- BENZODIAZEPINE EQUIVALENCE TABLE --- //
    // Rendered from data so HyperTaper and this page cannot disagree about what
    // a given drug is worth in diazepam.
    document.querySelectorAll('[data-benzo-equivalence]').forEach(host => {
        host.innerHTML = renderClinicalTable({
            headers: ['Drug', `Dose equivalent to diazepam ${DIAZEPAM_REFERENCE_MG}mg`],
            rows: BENZO_EQUIVALENCE.map(e => [e.drug, `${e.mg}mg`])
        }) + `<ul>` + EQUIVALENCE_CAVEATS.map(c => `<li>${c}</li>`).join('') + `</ul>`
            + `<p><span class="src-tag src-other">OTHER - eTG, via NSWCG Table 11.2</span></p>`;
    });

    // --- OTP PHARMACOTHERAPY --- //
    // Three medicines, four columns. The warning below it is rendered from the
    // same module because it exists only to stop one cell of the table being
    // carried across to the wrong drug.
    document.querySelectorAll('[data-otp-pharmacotherapy]').forEach(host => {
        host.innerHTML = renderClinicalTable({
            headers: ['Medication', 'Formulation and route', 'Initiation and titration',
                'Target maintenance dose'],
            rows: PHARMACOTHERAPY.map(m => [
                `<strong>${m.medication}</strong><br>${m.source}`,
                m.formulation, m.initiation, m.maintenance
            ])
        }) + `<div class="warning-box">${PHARMACOTHERAPY_WARNING}</div>`;
    });

    // --- OTP ASSESSMENT AND CASE FLAGGING --- //
    document.querySelectorAll('[data-otp-assessment]').forEach(host => {
        host.innerHTML = OTP_ASSESSMENT.map(item =>
            `<h5>${item.heading}</h5><ul>`
            + item.points.map(p => `<li>${p}</li>`).join('')
            + `</ul><p>${item.source}</p>`).join('')
            + `<h5>Case flagging - review frequency and setting</h5>`
            + `<p>${CASE_FLAGGING_RULE}</p>`
            + renderClinicalTable({
                headers: ['Tier', 'Features', 'Setting', 'Clinical review', 'Medical review'],
                rows: CASE_FLAGGING.map(t => [
                    `<strong>${t.tier}</strong>`, t.features, t.setting, t.clinical, t.medical
                ])
            })
            + `<p>${CASE_FLAGGING_SOURCE}</p>`;
    });

    // --- OTP PRESCRIBING AND REGULATORY FRAMEWORK --- //
    // The caseload limits render inside a <details> because they bind the
    // prescriber setting up a practice, not the clinician holding a dose.
    document.querySelectorAll('[data-otp-framework]').forEach(host => {
        host.innerHTML = PRESCRIBER_FRAMEWORK.map(item =>
            `<h5>${item.heading}</h5><p>${item.body}</p><p>${item.source}</p>`).join('')
            + `<details class="warning-box"><summary><strong>${PRESCRIBER_CAPS.summary}</strong></summary>`
            + renderClinicalTable({
                headers: ['Prescriber', 'Limit'],
                rows: PRESCRIBER_CAPS.rows
            })
            + `<p>${PRESCRIBER_CAPS.source}</p></details>`;
    });

    // --- CONFIRMING CURRENT OPIOID TREATMENT --- //
    // Two hosts, one list: the OTP page opens with it, and the withdrawal page's
    // regulatory section ends with it. The Ministry of Health numbers exist once.
    document.querySelectorAll('[data-confirm-otp]').forEach(host => {
        host.innerHTML = `<ul>`
            + CONFIRM_CURRENT_TREATMENT.map(item => `<li>${item}</li>`).join('')
            + `</ul><p>${CONFIRM_CURRENT_TREATMENT_SOURCE}</p>`;
    });

    // --- MISSED DOSES ON OTP --- //
    // The static half: the two absolutes, what the review covers, the bands, and
    // the Buvidal windows. Rendered from data so the section and the calculator
    // below it cannot drift apart.
    document.querySelectorAll('[data-otp-missed-doses]').forEach(host => {
        host.innerHTML =
            `<div class="danger-box"><strong>&#128721; Before anything else:</strong><ul>`
            + MISSED_DOSE_STOPS.map(s => `<li>${s}</li>`).join('')
            + `</ul></div>`
            + `<h5>Review before dosing, in every band</h5>`
            + `<p>Done by the dispenser, the prescriber, or - if neither is available - their delegate, the `
            + `dosing clinician or an experienced drug and alcohol clinician.</p><ul>`
            + MISSED_DOSE_REVIEW.map(item => `<li>${item}</li>`).join('')
            + `</ul>`
            + `<h5>What is at risk after more than three missed doses</h5><ul>`
            + `<li><strong>Methadone:</strong> ${MISSED_DOSE_RATIONALE.methadone}</li>`
            + `<li><strong>Buprenorphine:</strong> ${MISSED_DOSE_RATIONALE.buprenorphine}</li>`
            + `</ul>`
            + renderClinicalTable({
                headers: ['Consecutive doses missed', 'Who decides', 'Dose'],
                rows: MISSED_DOSE_BANDS.map(b => [b.missed, b.decidedBy, b.action])
            })
            + `<p><span class="src-tag src-nswcg">NSWCG &sect;8.3.5</span> ${MISSED_DOSE_SOURCE}</p>`
            + `<h5>Buvidal (long-acting injectable buprenorphine)</h5>`
            + `<p>Counted in days overdue, not in missed doses.</p>`
            + renderClinicalTable({
                headers: ['Product', 'Scheduled', 'Flexible window', 'When re-induction may be required'],
                rows: BUVIDAL_WINDOWS.map(w => [w.product, w.scheduled, w.window, w.reinduction])
            })
            + `<ul>` + BUVIDAL_NOTES.map(n => `<li>${n}</li>`).join('') + `</ul>`
            + `<p>${BUVIDAL_SOURCE}</p>`;
    });

    // The calculator. It answers one question - what may be dispensed today -
    // and refuses to answer it as a number in the two bands where the number is
    // not the decision: at 1-3 the dose is the usual one subject to the review,
    // and above 5 there is no dose without the prescriber.
    const otpAgentEl = document.getElementById('otp-agent');
    const otpDoseEl = document.getElementById('otp-usual-dose');
    const otpMissedEl = document.getElementById('otp-missed-count');
    const otpResultEl = document.getElementById('otp-missed-result');

    if (otpAgentEl && otpDoseEl && otpMissedEl && otpResultEl) {
        // Half a milligram is dispensable for methadone syrup; a trailing ".0"
        // on a whole number is not how a dose is written on a chart.
        const mg = (n) => `${Number(n.toFixed(1))}mg`;

        const card = (tone, title, body) =>
            `<div class="otp-result-card ${tone}"><strong>${title}</strong>${body}</div>`;

        const updateOtpMissed = () => {
            const agentKey = otpAgentEl.value;
            const agent = ORAL_OTP_AGENTS[agentKey];
            const usual = parseFloat(otpDoseEl.value);
            const missed = parseInt(otpMissedEl.value, 10);
            const band = bandFor(missed);

            if (!band) {
                otpResultEl.innerHTML = '';
                return;
            }

            if (band.key === 'resume') {
                otpResultEl.innerHTML = card('resume',
                    `${agent.label} - ${missed} dose${missed === 1 ? '' : 's'} missed: usual dose, after review`,
                    `<p>Resume the <strong>normal dose</strong>`
                    + (Number.isFinite(usual) && usual > 0 ? ` (${mg(usual)})` : '')
                    + ` if the review above finds no intoxication, no significant withdrawal and no other `
                    + `clinical concern. If it does, consult the prescriber or delegate, or seek DASAS advice `
                    + `on <a href="tel:1800023687">1800 023 687</a>.</p>`);
                return;
            }

            if (band.key === 'review') {
                otpResultEl.innerHTML = card('review',
                    `${agent.label} - ${missed} doses missed: prescriber review, no dose today`,
                    `<p><strong>The prescriber must review the patient before treatment recommences.</strong> `
                    + `Tolerance can no longer be assumed from the previous dose`
                    + (Number.isFinite(usual) && usual > 0 ? ` of ${mg(usual)}` : '')
                    + `, so this is a re-induction rather than a resumed dose.</p>`
                    + `<p>${agent.reinduction}</p>`);
                return;
            }

            const result = restartDose(agentKey, usual);
            if (!result) {
                otpResultEl.innerHTML = card('reduced',
                    `${agent.label} - ${missed} doses missed: reduced dose, prescriber must authorise`,
                    `<p>Enter the usual daily dose to calculate today's reduced dose. The rule is half the `
                    + `usual dose or ${agent.floorMg}mg, whichever is higher.</p>`);
                return;
            }

            otpResultEl.innerHTML = card('reduced',
                `${agent.label} - ${missed} doses missed: ${mg(result.doseMg)} today`,
                `<p>Half of ${mg(result.usualDoseMg)} is ${mg(result.halfDoseMg)}; the floor for `
                + `${agent.label.toLowerCase()} is ${agent.floorMg}mg. `
                + (result.cappedAtUsual
                    ? `Taking the higher of the two would give ${agent.floorMg}mg - <strong>more than this `
                      + `patient's usual dose</strong>, immediately after a gap that has cost them tolerance. `
                      + `Capped at the usual dose, ${mg(result.doseMg)}.`
                    : `<strong>Today's dose is ${mg(result.doseMg)}.</strong>`)
                + `</p>`
                + `<p><strong>This dose cannot be given without the prescriber.</strong> Contact the prescriber `
                + `or delegate; a legal prescription must reach the dosing site - a faxed script or a telephone `
                + `order will do. If neither can be obtained, the patient cannot be dosed and must be referred `
                + `back for review.</p>`
                + `<p><strong>Then:</strong> clinician review before each subsequent dose, climbing back to `
                + `${mg(result.usualDoseMg)} over ${agent.returnDays}, in increments of up to `
                + `${agent.stepMg}mg per day.</p>`
                + (result.cappedAtUsual ? `<p>${RESTART_CAP_SOURCE}</p>` : ''));
        };

        [otpAgentEl, otpDoseEl, otpMissedEl].forEach(el => {
            el.addEventListener('input', updateOtpMissed);
            el.addEventListener('change', updateOtpMissed);
        });

        document.getElementById('reset-otp-missed-btn')?.addEventListener('click', () => {
            otpAgentEl.selectedIndex = 0;
            otpDoseEl.value = '';
            otpMissedEl.value = '';
            updateOtpMissed();
        });

        updateOtpMissed();
    }

    // --- PER-PAGE REVIEW METADATA (AUTH-02) --- //
    // Appended to the page itself rather than kept in a repository file: a
    // clinician reading a page is the person who needs to know how old it is.
    Object.entries(CONTENT_META).forEach(([pageId, meta]) => {
        const page = document.getElementById(pageId);
        if (!page) {
            console.warn('content metadata for a page that does not exist:', pageId);
            return;
        }
        const footer = document.createElement('p');
        footer.className = 'review-meta';
        footer.innerHTML = meta.lastReviewed
            ? `Source: ${meta.source}. Content last reviewed ${formatReviewMonth(meta.lastReviewed)}. `
            + `Reviewer: ${meta.reviewer || 'authored, not yet independently reviewed'}.`
            : `Source: ${meta.source}. Not yet authored - nothing on this page has been reviewed.`;
        page.appendChild(footer);
    });

    // --- SETUP ALL CALCULATORS ---
    SCALES.forEach(setupCalculator);

    // --- LONG PROVENANCE RATIONALES --- //
    // The Sources page promises that a LOCAL or NSWCG-adapted chip carries a
    // one-line rationale. A handful run to sixty or ninety words — each of them
    // worth keeping, none of them worth putting between the clinician and the
    // dose, and several render in the schedule and PRN lists, which are not
    // collapsed the way caveats are.
    //
    // So the collapse happens here rather than in the content: the source files
    // keep the full sentence, test/provenance.test.js keeps reading it, and the
    // chip renders as its citation with the rationale one tap away. Nothing is
    // rewritten and nothing is dropped — which is the whole point of doing it at
    // render time rather than by editing the text down.
    const RATIONALE_CLAMP_WORDS = 25;

    const collapseLongRationales = () => {
        document.querySelectorAll('.src-tag:not([data-rationale-collapsed])').forEach(tag => {
            const text = tag.textContent.replace(/\s+/g, ' ').trim();
            if (text.split(' ').length <= RATIONALE_CLAMP_WORDS) return;

            // No "rationale:" means there is no second half to hide — a long
            // bibliographic citation is left exactly as it is.
            const split = text.search(/\brationale:/i);
            if (split === -1) return;

            const citation = text.slice(0, split).replace(/[\s-]+$/, '');
            // The button says "why", so the word "rationale:" would only be
            // said twice once it opens.
            const rationale = text.slice(split).replace(/^rationale:\s*/i, '');

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'src-why';
            toggle.setAttribute('aria-expanded', 'false');

            const body = document.createElement('span');
            body.className = 'src-rationale';
            body.hidden = true;
            body.textContent = ' ' + rationale;

            // The label does not change when it opens: it stays the control
            // you press to close it again.
            toggle.textContent = `${citation} - why`;
            toggle.addEventListener('click', () => {
                body.hidden = !body.hidden;
                toggle.setAttribute('aria-expanded', String(!body.hidden));
            });

            tag.dataset.rationaleCollapsed = 'true';
            tag.textContent = '';
            tag.append(toggle, body);
        });
    };

    collapseLongRationales();
    // Regimens, symptomatic tables and harm-reduction blocks are rebuilt on
    // selection, so the pass has to run again on whatever those renders inject.
    // Re-entry is bounded by the data-rationale-collapsed marker: the second
    // pass finds nothing left to change.
    new MutationObserver(collapseLongRationales)
        .observe(mainContent, { childList: true, subtree: true });

    // --- INITIAL ROUTE --- //
    // Runs last so a deep link like #scales-page/cows lands on a fully built
    // calculator. Also seeds a history entry, so the first Back press has
    // somewhere to go rather than leaving the app.
    applyRouteFromHash();

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Use relative path to support hosting on both custom domain root and subdirectories.
            navigator.serviceWorker.register('sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
});
