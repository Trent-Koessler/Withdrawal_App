import { FLOWCHART_LOGIC } from './data/flowchart.js';
import { REGIMEN_CONFIG } from './data/regimens.js';
import { SCALES } from './data/scales.js';

document.addEventListener('DOMContentLoaded', () => {
    const APP_VERSION = '0.3.2';
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
            }
        } else {
            window.history.replaceState({ pageId, tabId }, '', hash);
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
    const benzoSelectionDisplay = document.getElementById('benzo-selection-display');
    const regimenBenzoDisplay = document.getElementById('regimen-benzo-display');
    const regimenDisplayDiv = document.getElementById('regimen-display');
    let selectedBenzo = 'Diazepam';
    let selectedSeverity = 'mild';



    function updateRegimenDisplay() {
        if (!regimenDisplayDiv) return;

        const config = REGIMEN_CONFIG[selectedBenzo];
        const data = config[selectedSeverity];
        const b_name = config.name;

        // A `routing` cell is one where no regimen should be rendered at all —
        // severe withdrawal on oxazepam, for instance. Returning advice instead
        // of a dose table is the point, so bail out before the schedule loop
        // rather than rendering an empty one.
        if (data.routing) {
            regimenDisplayDiv.innerHTML = `<h3>${data.title}</h3>`
                + data.routing.map(item => `<div class="routing-card">${item}</div>`).join('');
            return;
        }

        let displayHTML = `<h3>${data.title}</h3>`;

        // Shown before the doses, never after: a caveat that qualifies a whole
        // schedule is useless underneath it.
        if (data.caveat) {
            displayHTML += `<div class="warning-box">${data.caveat}</div>`;
        }

        displayHTML += `<b>Scheduled Dosing:</b><ul>`;
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
            displayHTML += `<b>PRN Dosing:</b>`;
            if (selectedSeverity === 'mild' || selectedSeverity === 'moderate') {
                displayHTML += `<div><i>(max twice daily PRN)</i></div>`;
            }
            displayHTML += `<ul>`;
            data.prn.forEach(p => {
                if (typeof p === 'string') {
                    displayHTML += `<li>${p}</li>`;
                } else {
                    displayHTML += `<li>CIWA ${p.range}: extra ${b_name} ${p.dose}mg PRN</li>`;
                }
            });
            displayHTML += `</ul>`;
        }

        // Add alternative symptom-triggered regimen for mild/moderate cases
        if (selectedSeverity === 'mild' && data.symptom_triggered) {
            const st = data.symptom_triggered;
            displayHTML += `<hr style="margin: 20px 0;">`;
            displayHTML += `<h3>Alternative: ${st.title}</h3>`;
            displayHTML += `<p><i>${st.note}</i></p>`;
            displayHTML += `<b>Dosing based on score:</b><ul>`;
            st.doses.forEach(dose_info => {
                displayHTML += `<li>${dose_info}</li>`;
            });
            displayHTML += `</ul>`;
            displayHTML += `<p><b>${st.review}</b></p>`;
        }

        regimenDisplayDiv.innerHTML = displayHTML;
    }

    benzoChoiceBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedBenzo = btn.dataset.benzo;
            benzoChoiceBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (benzoSelectionDisplay) benzoSelectionDisplay.textContent = selectedBenzo;
            if (regimenBenzoDisplay) regimenBenzoDisplay.textContent = selectedBenzo;
            updateRegimenDisplay();
        });
    });

    regimenSeverityBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            selectedSeverity = btn.dataset.severity;
            regimenSeverityBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            updateRegimenDisplay();
        });
    });

    if (document.getElementById('inpatient-guidelines-page')) {
        updateRegimenDisplay();
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

    // --- SETUP ALL CALCULATORS ---
    SCALES.forEach(setupCalculator);

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
