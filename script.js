document.addEventListener('DOMContentLoaded', () => {

    // --- THEME TOGGLE --- //
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;
    themeToggle.addEventListener('click', () => {
        const isDarkMode = body.dataset.theme === 'dark';
        if (isDarkMode) {
            body.removeAttribute('data-theme');
            themeToggle.textContent = '🌙 Dark Mode';
        } else {
            body.dataset.theme = 'dark';
            themeToggle.textContent = '☀️ Light Mode';
        }
    });

    // --- PAGE NAVIGATION --- //
    const pageTitle = document.getElementById('page-title');
    const pages = document.querySelectorAll('.page');
    const navButtons = document.querySelectorAll('.big-button[data-page]');
    const homeButton = document.getElementById('home-button');

    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.remove('active-page');
        });
        const newPage = document.getElementById(pageId);
        if (newPage) {
            newPage.classList.add('active-page');
            const button = document.querySelector(`[data-page='${pageId}']`);
            let title = 'Home'; // Default title
            if (button) {
                title = button.textContent.replace(/\n/g, ' ');
            } else if (pageId !== 'home-page') {
                const pageElement = document.getElementById(pageId);
                title = pageElement.dataset.title || 'Withdrawal Assistant';
            }
            pageTitle.textContent = title;

            if (pageId === 'alcohol-withdrawal-page') {
                startFlowchart();
            }
        }
    }

    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const pageId = button.dataset.page;
            showPage(pageId);
        });
    });

    homeButton.addEventListener('click', () => showPage('home-page'));

    // --- LINK TO SCALE BUTTONS ---
    // Handles buttons on the "Other Syndromes" page that link to specific calculator tabs.
    document.querySelectorAll('[data-link-to-scale]').forEach(button => {
        button.addEventListener('click', () => {
            const scaleId = button.dataset.linkToScale;
            
            // 1. Navigate to the main scales page
            showPage('scales-page');
            
            // 2. Find and click the correct tab button on that page
            const targetTabButton = document.querySelector(`#scales-page .tab-button[data-tab="${scaleId}"]`);
            
            if (targetTabButton) {
                targetTabButton.click();
            }
        });
    });
    // =================================================================
    // ALCOHOL WITHDRAWAL FLOWCHART LOGIC
    // =================================================================

    const FLOWCHART_LOGIC = {
        'start': { 'title': 'Start', 'type': 'question', 'text': 'How is the patient being referred?', 'options': [{'label': 'GP, D&A, Other LHD Service, or Self-Referral', 'next_step': 'intake_assessment'}] },
        'intake_assessment': { 'title': 'Assessment', 'type': 'question', 'text': 'Proceed with intake and a comprehensive assessment. Does the patient require withdrawal management?', 'options': [{'label': 'Yes, withdrawal is required', 'next_step': 'ask_std_drinks'}, {'label': 'No, withdrawal is not required', 'next_step': 'refer_psychosocial'}] },
        'refer_psychosocial': { 'title': 'Referral', 'type': 'outcome', 'text': 'Patient does not require withdrawal management.\n\nRefer to Addiction Medicine / psychosocial team as appropriate.', 'emr_summary': 'Patient assessed and does not require withdrawal management. Referred to Addiction Medicine / psychosocial team for ongoing support.' },
        'ask_std_drinks': { 'title': 'Alcohol Intake', 'type': 'question', 'text': "What is the patient's average recent daily standard drink (std) intake?", 'options': [ {'label': '≤ 7 Standard Drinks daily', 'next_step': 'ask_seizure_history_under8'}, {'label': '8-14 Standard Drinks daily', 'next_step': 'ask_seizure_history_8to14'}, {'label': '≥ 15 Standard Drinks daily', 'next_step': 'ask_seizure_history_15plus'} ] },
        'ask_seizure_history_under8': { 'title': 'Seizure History (≤ 7)', 'type': 'question', 'text': 'Does the patient have a past history of seizures, delirium tremens, or complex withdrawal?', 'options': [{'label': 'No past history', 'next_step': 'outcome_supportive_care_under8'}, {'label': 'Yes, has a past history', 'next_step': 'outcome_admit_dh_under8'}] },
        'outcome_supportive_care_under8': { 'title': 'Supportive Care', 'type': 'outcome', 'text': 'Patient has no past history of severe withdrawal.\n\nRecommendation: Supportive treatment.', 'emr_summary': 'Patient consuming ≤ 7 standard drinks daily with no history of complex withdrawal. Plan: Supportive treatment.' },
        'outcome_admit_dh_under8': { 'title': 'Consider Admission (≤ 7)', 'type': 'outcome', 'text': 'Patient has a past history of severe withdrawal.\n\nRecommendation: Consider admission to district hospital / MPS / outpatient detox unit for monitoring.', 'emr_summary': 'Patient consuming ≤ 7 standard drinks daily but has a history of complex withdrawal. Plan: Consider admission to district hospital / MPS / outpatient detox unit for monitored withdrawal.', 'guideline_link': 'inpatient-guidelines-page' },
        'ask_seizure_history_8to14': { 'title': 'Seizure History (8-14)', 'type': 'question', 'text': 'Does the patient have a past history of seizures, delirium tremens, or complex withdrawal?', 'options': [{'label': 'No past history', 'next_step': 'ask_psychosocial_8to14'}, {'label': 'Yes, has a past history', 'next_step': 'outcome_consider_base_8to14'}] },
        'ask_psychosocial_8to14': { 'title': 'Psychosocial (8-14)', 'type': 'question', 'text': "What is the patient's psychosocial situation?", 'options': [ {'label': 'Good psychosocial support / No alcohol in house', 'next_step': 'outcome_ambulatory_detox'}, {'label': 'Poor support / Lives alone / Failed outpatient attempts', 'next_step': 'outcome_admit_dh_8to14'} ] },
        'outcome_ambulatory_detox': { 'title': 'Ambulatory Detox', 'type': 'outcome', 'text': 'Patient has good psychosocial support.\n\nRecommendation: Ambulatory Detox.', 'emr_summary': 'Patient consuming 8-14 standard drinks daily with no complex withdrawal history and good psychosocial support. Plan: Ambulatory Detox.', 'ambulatory_guideline_link': 'ambulatory-guidelines-page' },
        'outcome_admit_dh_8to14': { 'title': 'Admission (8-14)', 'type': 'outcome', 'text': 'Patient has poor psychosocial support or has failed previous outpatient attempts.\n\nRecommendation: Admission to district hospital / MPS / outpatient detox unit.', 'emr_summary': 'Patient consuming 8-14 standard drinks daily with poor psychosocial support. Plan: Admission to district hospital / MPS / outpatient detox unit.', 'guideline_link': 'inpatient-guidelines-page' },
        'outcome_consider_base_8to14': { 'title': 'Consider General Hospital (8-14)', 'type': 'outcome', 'text': 'Patient has a past history of severe withdrawal.\n\nRecommendation: Can consider admission to district hospital / MPS / outpatient detox unit, but Base Hospital is safer.', 'emr_summary': 'Patient consuming 8-14 std drinks with a history of complex withdrawal. Plan: Admission is recommended; Base Hospital is the safer option over district hospital / MPS / outpatient detox unit.', 'guideline_link': 'inpatient-guidelines-page' },
        'ask_seizure_history_15plus': { 'title': 'Seizure History (≥ 15)', 'type': 'question', 'text': 'Does the patient have a past history of seizures, delirium tremens, or complex withdrawal?', 'options': [{'label': 'No past history', 'next_step': 'outcome_consider_base_15plus'}, {'label': 'Yes, has a past history', 'next_step': 'outcome_base_only_15plus'}] },
        'outcome_consider_base_15plus': { 'title': 'Consider General (≥ 15)', 'type': 'outcome', 'text': 'Patient has no history of severe withdrawal but intake is high.\n\nRecommendation: Consider General Hospital admission.', 'emr_summary': 'Patient consuming 15+ standard drinks daily. Plan: Consider Base Hospital admission due to high level of use.', 'guideline_link': 'inpatient-guidelines-page' },
        'outcome_base_only_15plus': { 'title': 'General Hospital Admission Only', 'type': 'outcome', 'text': 'Patient has a history of severe withdrawal and high intake.\n\nRecommendation: For General Hospital admission only.', 'emr_summary': 'Patient consuming 15+ standard drinks daily with a history of complex withdrawal. Plan: For Base Hospital admission only.', 'guideline_link': 'inpatient-guidelines-page' }
    };

    const flowchartPage = document.getElementById('alcohol-withdrawal-page');
    let history = [];

    function startFlowchart() {
        history = ['start'];
        renderFlowchartStep('start');
    }

    function renderFlowchartStep(stepId) {
        const stepData = FLOWCHART_LOGIC[stepId];
        if (!stepData) return;
        flowchartPage.innerHTML = '';
        const breadcrumbs = document.createElement('div');
        breadcrumbs.className = 'breadcrumbs';
        history.forEach((histStepId, index) => {
            const crumb = document.createElement('button');
            crumb.className = 'breadcrumb-button';
            crumb.textContent = FLOWCHART_LOGIC[histStepId].title;
            crumb.addEventListener('click', () => jumpToStep(index));
            breadcrumbs.appendChild(crumb);
            if (index < history.length - 1) {
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
        const optionsContainer = document.createElement('div');
        optionsContainer.className = 'flowchart-options';
        if (stepData.type === 'question') {
            stepData.options.forEach(option => {
                const button = document.createElement('button');
                button.className = 'big-button';
                button.innerText = option.label;
                button.addEventListener('click', () => {
                    history.push(option.next_step);
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
        backButton.disabled = history.length <= 1;
        backButton.addEventListener('click', goBack);
        const restartButton = document.createElement('button');
        restartButton.textContent = 'Restart';
        restartButton.addEventListener('click', startFlowchart);
        navContainer.appendChild(backButton);
        navContainer.appendChild(restartButton);
        flowchartPage.appendChild(navContainer);
    }

    function goBack() {
        if (history.length > 1) {
            history.pop();
            renderFlowchartStep(history[history.length - 1]);
        }
    }

    function jumpToStep(index) {
        history = history.slice(0, index + 1);
        renderFlowchartStep(history[history.length - 1]);
    }

    // --- TAB NAVIGATION --- //
    document.querySelectorAll('.tab-container').forEach(container => {
        const tabButtons = container.querySelectorAll(':scope > .tab-buttons > .tab-button');
        const tabContents = container.querySelectorAll(':scope > .tab-content');
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const tabId = button.dataset.tab;
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.remove('active'));
                const activeContent = container.querySelector(`#${tabId}`);
                if (activeContent) activeContent.classList.add('active');
            });
        });
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
    let lastSeverity = 'mild';

    function updateRegimenDisplay() {
        const isOxa = selectedBenzo === "Oxazepam";
        const factor = isOxa ? 3 : 1;
        const b_name = selectedBenzo;
        const regimens = {
            'mild': { 'title': 'Mild-Moderate (CIWA 10-15)', 'schedule': [`Day 1: ${b_name} ${10*factor}mg qid`, `Day 2: ${b_name} ${10*factor}mg tds`, `Day 3: ${b_name} ${10*factor}mg bd`, `Day 4: ${b_name} ${5*factor}mg bd`, `Day 5: ${b_name} ${5*factor}mg nocte`], 'prn': [`CIWA 10-15: extra ${b_name} ${10*factor}mg prn`, `CIWA 15-20: extra ${b_name} ${20*factor}mg prn`] },
            'moderate': { 'title': 'Moderate-Severe (CIWA 15-20)', 'schedule': [`Day 1: ${b_name} ${20*factor}mg qid`, `Day 2: ${b_name} ${15*factor}mg qid`, `Day 3: ${b_name} ${10*factor}mg qid`, `Day 4: ${b_name} ${10*factor}mg tds`, `Day 5: ${b_name} ${5*factor}mg tds`, `Day 6: ${b_name} ${5*factor}mg bd`], 'prn': [`CIWA 10-15: extra ${b_name} ${10*factor}mg prn`, `CIWA 15-20: extra ${b_name} ${20*factor}mg prn`] },
            'severe': { 'title': 'Severe (CIWA > 20)', 'schedule': [`Loading Dose: ${b_name} ${20*factor}mg hourly until sedated or total dose reaches ${80*factor}mg.`, "Then commence Moderate-Severe schedule."], 'prn': ["Manage in HDU.", "Review if total > 80mg diazepam equivalent."] }
        };
        const data = regimens[lastSeverity];
        let displayHTML = `<h3>${data.title}</h3><b>Scheduled Dosing:</b><ul>`;
        data.schedule.forEach(s => displayHTML += `<li>${s}</li>`);
        displayHTML += `</ul><b>PRN Dosing:</b><ul>`;
        data.prn.forEach(p => displayHTML += `<li>${p}</li>`);
        displayHTML += `</ul>`;
        if (regimenDisplayDiv) regimenDisplayDiv.innerHTML = displayHTML;
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
            lastSeverity = btn.dataset.severity;
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
                const qty = parseFloat(input.value) || 0;
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
            const volume = parseFloat(document.getElementById('volume-ml').value) || 0;
            const abv = parseFloat(document.getElementById('abv-percent').value) || 0;
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
    const container = document.getElementById(config.id);
    if (!container) return;

    const itemsContainer = container.querySelector('.calculator-items');
    if (!itemsContainer) return;

    const totalScoreEl = container.querySelector('.total-score');
    const severityEl = container.querySelector('.severity');
    const emrSummaryEl = container.querySelector('.emr-summary');
    const copyBtn = container.querySelector('.copy-btn');
    const resetBtn = container.querySelector('.reset-btn');

    function calculateScore() {
        let totalScore = 0;
        const checkedRadios = itemsContainer.querySelectorAll('input[type="radio"]:checked');
        checkedRadios.forEach(radio => {
            totalScore += parseInt(radio.value, 10);
        });
        
        const severity = config.severityLogic(totalScore);
        
        totalScoreEl.textContent = totalScore;
        severityEl.textContent = severity;
        
        // This summary logic is now robust and no longer relies on array order.
        let summary = `${config.name} assessed. Total score: ${totalScore} (${severity}).\nBreakdown:\n`;
        config.items.forEach(item => {
            const radio = itemsContainer.querySelector(`input[name="${item.radioName}"]:checked`);
            if (radio) {
                summary += `- ${item.displayName}: ${radio.value}\n`;
            }
        });
        emrSummaryEl.value = summary.trim();
    }

    itemsContainer.addEventListener('change', calculateScore);

    copyBtn.addEventListener('click', () => {
        emrSummaryEl.select();
        navigator.clipboard.writeText(emrSummaryEl.value);
    });

    resetBtn.addEventListener('click', () => {
        itemsContainer.querySelectorAll('input[type="radio"]').forEach(radio => {
            const groupName = radio.name;
            const firstRadioInGroup = itemsContainer.querySelector(`input[name="${groupName}"]`);
            if (radio === firstRadioInGroup) {
                radio.checked = true;
            } else {
                radio.checked = false;
            }
        });
        calculateScore(); // Recalculate after resetting
    });
    
    // Initial calculation on load
    calculateScore();
}
    
// --- SETUP ALL CALCULATORS ---
setupCalculator({
    id: 'aws',
    name: 'AWS',
    items: [
        { displayName: "Perspiration", radioName: "aws-perspiration" },
        { displayName: "Tremor", radioName: "aws-tremor" },
        { displayName: "Anxiety", radioName: "aws-anxiety" },
        { displayName: "Agitation", radioName: "aws-agitation" },
        { displayName: "Axilla temperature", radioName: "aws-temp" },
        { displayName: "Hallucinations", radioName: "aws-hallucinations" },
        { displayName: "Orientation", radioName: "aws-orientation" }
    ],
    severityLogic: (score) => {
        if (score <= 4) return "Mild withdrawal";
        if (score <= 14) return "Moderate withdrawal";
        return "Severe withdrawal";
    }
});
    
setupCalculator({
    id: 'ciwa-ar',
    name: 'CIWA-Ar',
    items: [
        { displayName: "Nausea & Vomiting", radioName: "ciwa-nausea" },
        { displayName: "Tremor", radioName: "ciwa-tremor" },
        { displayName: "Paroxysmal Sweats", radioName: "ciwa-sweats" },
        { displayName: "Anxiety", radioName: "ciwa-anxiety" },
        { displayName: "Agitation", radioName: "ciwa-agitation" },
        { displayName: "Tactile Disturbances", radioName: "ciwa-tactile" },
        { displayName: "Auditory Disturbances", radioName: "ciwa-auditory" },
        { displayName: "Visual Disturbances", radioName: "ciwa-visual" },
        { displayName: "Headache", radioName: "ciwa-headache" },
        { displayName: "Orientation", radioName: "ciwa-orientation" }
    ],
    severityLogic: (score) => {
        if (score < 10) return "Mild withdrawal";
        if (score <= 18) return "Moderate withdrawal";
        return "Severe withdrawal";
    }
});

setupCalculator({
    id: 'saws',
    name: 'SAWS',
    items: [
        { displayName: "Anxious", radioName: "saws-anxious" },
        { displayName: "Sleep disturbance", radioName: "saws-sleep" },
        { displayName: "Memory problems", radioName: "saws-memory" },
        { displayName: "Nausea", radioName: "saws-nausea" },
        { displayName: "Restless", radioName: "saws-restless" },
        { displayName: "Tremor (shakes)", radioName: "saws-tremor" },
        { displayName: "Feeling confused", radioName: "saws-confused" },
        { displayName: "Sweating", radioName: "saws-sweating" },
        { displayName: "Miserable", radioName: "saws-miserable" },
        { displayName: "Heart pounding", radioName: "saws-heart" }
    ],
    severityLogic: (score) => {
        if (score === 0) return "None";
        if (score <= 5) return "Mild";
        if (score <= 12) return "Moderate";
        return "Severe";
    }
});

setupCalculator({
    id: 'cows',
    name: 'COWS',
    items: [
        { displayName: "Resting Pulse Rate", radioName: "cows-pulse" },
        { displayName: "Sweating", radioName: "cows-sweating" },
        { displayName: "Restlessness", radioName: "cows-restless" },
        { displayName: "Pupil size", radioName: "cows-pupil" },
        { displayName: "Bone or joint aches", radioName: "cows-aches" },
        { displayName: "Runny nose or tearing", radioName: "cows-nose" },
        { displayName: "GI Upset", radioName: "cows-gi" },
        { displayName: "Tremor", radioName: "cows-tremor" },
        { displayName: "Yawning", radioName: "cows-yawning" },
        { displayName: "Anxiety or irritability", radioName: "cows-anxiety" },
        { displayName: "Gooseflesh skin", radioName: "cows-skin" }
    ],
    severityLogic: (score) => {
        if (score <= 4) return "Minimal Withdrawal";
        if (score <= 12) return "Mild Withdrawal";
        if (score <= 24) return "Moderate Withdrawal";
        if (score <= 36) return "Moderately Severe";
        return "Severe Withdrawal";
    }

});

setupCalculator({
    id: 'ciwa-b',
    name: 'CIWA-B',
    items: [
        { displayName: "Nausea and Vomiting", radioName: "ciwab-nausea" },
        { displayName: "Tremor", radioName: "ciwab-tremor" },
        { displayName: "Diaphoresis (Sweating)", radioName: "ciwab-sweats" },
        { displayName: "Anxiety", radioName: "ciwab-anxiety" },
        { displayName: "Agitation", radioName: "ciwab-agitation" },
        { displayName: "Tactile Disturbances", radioName: "ciwab-tactile" },
        { displayName: "Auditory Disturbances", radioName: "ciwab-auditory" },
        { displayName: "Visual Disturbances", radioName: "ciwab-visual" },
        { displayName: "Headache", radioName: "ciwab-headache" },
        { displayName: "Clouding of Sensorium (Orientation)", radioName: "ciwab-orientation" }
    ],
    severityLogic: (score) => {
        if (score < 10) return "Mild withdrawal";
        if (score <= 20) return "Moderate withdrawal";
        return "Severe withdrawal";
    }
});

setupCalculator({
    id: 'nsw-cws',
    name: 'Cannabis Withdrawal Scale',
    items: [
        { displayName: "Craving for marijuana", radioName: "nsw-cws-craving" },
        { displayName: "Decreased appetite", radioName: "nsw-cws-appetite" },
        { displayName: "Sleep difficulty", radioName: "nsw-cws-sleep" },
        { displayName: "Increased aggression", radioName: "nsw-cws-aggression" },
        { displayName: "Increased anger", radioName: "nsw-cws-anger" },
        { displayName: "Increased irritability", radioName: "nsw-cws-irritability" },
        { displayName: "Increased nervousness", radioName: "nsw-cws-nervousness" },
        { displayName: "Restlessness", radioName: "nsw-cws-restlessness" },
        { displayName: "Strange/vivid dreams", radioName: "nsw-cws-dreams" },
        { displayName: "Nausea", radioName: "nsw-cws-nausea" },
        { displayName: "Stomach ache", radioName: "nsw-cws-stomach" },
        { displayName: "Shakiness/tremors", radioName: "nsw-cws-shakiness" },
        { displayName: "Sweating", radioName: "nsw-cws-sweating" },
        { displayName: "Headache", radioName: "nsw-cws-headache" },
        { displayName: "Depressed mood", radioName: "nsw-cws-depressed" },
        { displayName: "Chills", radioName: "nsw-cws-chills" },
        { displayName: "Physical tension", radioName: "nsw-cws-tension" },
        { displayName: "Yawning", radioName: "nsw-cws-yawning" },
        { displayName: "Runny nose", radioName: "nsw-cws-runnynose" }
    ],
    severityLogic: (score) => {
        // This scale does not have defined severity levels, it's for monitoring.
        return "N/A";
    }
});

setupCalculator({
    id: 'cwas',
    name: 'Cannabis Withdrawal Assessment Scale',
    items: [
        { displayName: "Craving for marijuana", radioName: "cwas-craving" },
        { displayName: "Decreased appetite", radioName: "cwas-appetite" },
        { displayName: "Sleep difficulty", radioName: "cwas-sleep" },
        { displayName: "Increased aggression", radioName: "cwas-aggression" },
        { displayName: "Increased anger", radioName: "cwas-anger" },
        { displayName: "Irritability", radioName: "cwas-irritability" },
        { displayName: "Strange dreams", radioName: "cwas-dreams" },
        { displayName: "Restlessness", radioName: "cwas-restlessness" },
        { displayName: "Chills", radioName: "cwas-chills" },
        { displayName: "Feverish feeling", radioName: "cwas-feverish" },
        { displayName: "Stuffy nose", radioName: "cwas-stuffy-nose" },
        { displayName: "Nausea", radioName: "cwas-nausea" },
        { displayName: "Diarrhoea", radioName: "cwas-diarrhoea" },
        { displayName: "Hot flashes", radioName: "cwas-hot-flashes" },
        { displayName: "Dizziness", radioName: "cwas-dizziness" },
        { displayName: "Sweating", radioName: "cwas-sweating" },
        { displayName: "Hiccups", radioName: "cwas-hiccups" },
        { displayName: "Yawning", radioName: "cwas-yawning" },
        { displayName: "Headaches", radioName: "cwas-headaches" },
        { displayName: "Shakiness", radioName: "cwas-shakiness" },
        { displayName: "Muscle spasms", radioName: "cwas-muscle-spasms" },
        { displayName: "Stomach pains", radioName: "cwas-stomach-pains" },
        { displayName: "Fatigue", radioName: "cwas-fatigue" },
        { displayName: "Depressed mood", radioName: "cwas-depressed" },
        { displayName: "Difficulty concentrating", radioName: "cwas-concentrating" },
        { displayName: "Nervousness", radioName: "cwas-nervousness" },
        { displayName: "Violent outbursts", radioName: "cwas-violent-outbursts" }
    ],
    severityLogic: (score) => "N/A"
});

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
});