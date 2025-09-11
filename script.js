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
    const aboutButton = document.getElementById('about-button');

    function showPage(pageId) {
        pages.forEach(page => {
            page.classList.remove('active-page');
        });
        const newPage = document.getElementById(pageId);
        if (newPage) {
            newPage.classList.add('active-page');
            const button = document.querySelector(`[data-page='${pageId}']`);
            let title = 'Withdrawal Management Assistant'; // Default title
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
    aboutButton.addEventListener('click', () => showPage('about-page'));

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
    let selectedSeverity = 'mild';

    const REGIMEN_CONFIG = {
        "Diazepam": {
            name: "Diazepam",
            mild: { title: 'Mild-Moderate (CIWA 10-15)', schedule: [ { dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 10, freq: 'bd' }, { dose: 5, freq: 'bd' }, { dose: 5, freq: 'nocte' } ], prn: [ { range: '10-15', dose: 10 }, { range: '15-20', dose: 20 } ] },
            moderate: { title: 'Moderate-Severe (CIWA 15-20)', schedule: [ { dose: 20, freq: 'qid' }, { dose: 15, freq: 'qid' }, { dose: 10, freq: 'qid' }, { dose: 10, freq: 'tds' }, { dose: 5, freq: 'tds' }, { dose: 5, freq: 'bd' } ], prn: [ { range: '10-15', dose: 10 }, { range: '15-20', dose: 20 } ] },
            severe: { title: 'Severe (CIWA > 20)', schedule: [ `Loading Dose: 20mg hourly until sedated or total dose reaches 80mg.`, "Then commence Moderate-Severe schedule." ], prn: ["Manage in HDU.", "Review if total > 80mg diazepam equivalent."] }
        },
        "Oxazepam": {
            name: "Oxazepam",
            mild: { title: 'Mild-Moderate (CIWA 10-15)', schedule: [ { dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 30, freq: 'bd' }, { dose: 15, freq: 'bd' }, { dose: 15, freq: 'nocte' } ], prn: [ { range: '10-15', dose: 30 }, { range: '15-20', dose: 60 } ] },
            moderate: { title: 'Moderate-Severe (CIWA 15-20)', schedule: [ { dose: 60, freq: 'qid' }, { dose: 45, freq: 'qid' }, { dose: 30, freq: 'qid' }, { dose: 30, freq: 'tds' }, { dose: 15, freq: 'tds' }, { dose: 15, freq: 'bd' } ], prn: [ { range: '10-15', dose: 30 }, { range: '15-20', dose: 60 } ] },
            severe: { title: 'Severe (CIWA > 20)', schedule: [ `Loading Dose: 60mg hourly until sedated or total dose reaches 240mg.`, "Then commence Moderate-Severe schedule." ], prn: ["Manage in HDU.", "Review if total > 240mg oxazepam equivalent."] }
        }
    };

    function updateRegimenDisplay() {
        if (!regimenDisplayDiv) return;

        const config = REGIMEN_CONFIG[selectedBenzo];
        const data = config[selectedSeverity];
        const b_name = config.name;

        let displayHTML = `<h3>${data.title}</h3><b>Scheduled Dosing:</b><ul>`;
        data.schedule.forEach((s, index) => {
            if (typeof s === 'string') {
                displayHTML += `<li>${s}</li>`;
            } else {
                displayHTML += `<li>Day ${index + 1}: ${b_name} ${s.dose}mg ${s.freq}</li>`;
            }
        });
        displayHTML += `</ul>`;

        if (data.prn && data.prn.length > 0) {
            displayHTML += `<b>PRN Dosing:</b><ul>`;
            data.prn.forEach(p => {
                if (typeof p === 'string') {
                    displayHTML += `<li>${p}</li>`;
                } else {
                    displayHTML += `<li>CIWA ${p.range}: extra ${b_name} ${p.dose}mg prn</li>`;
                }
            });
            displayHTML += `</ul>`;
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

    let itemsHtml = '';
    config.items.forEach(item => {
        itemsHtml += `<fieldset class="calculator-item"><legend>${item.displayName}</legend>`;
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
setupCalculator({
    id: 'aws',
    name: 'Alcohol Withdrawal Scale (AWS)',
    items: [
        { displayName: "Perspiration", radioName: "aws-perspiration", options: [
            { value: 0, label: "<b>0:</b> No abnormal sweating." },
            { value: 1, label: "<b>1:</b> Moist skin." },
            { value: 2, label: "<b>2:</b> Localised beads of sweat, e.g. on face, chest." },
            { value: 3, label: "<b>3:</b> Whole body wet from perspiration." },
            { value: 4, label: "<b>4:</b> Profuse maximal sweating-clothes, linen are wet." }
        ]},
        { displayName: "Tremor", radioName: "aws-tremor", options: [
            { value: 0, label: "<b>0:</b> No tremor." },
            { value: 1, label: "<b>1:</b> Slight tremor." },
            { value: 2, label: "<b>2:</b> Constant slight tremor of upper extremities." },
            { value: 3, label: "<b>3:</b> Constant marked tremor of extremities." }
        ]},
        { displayName: "Anxiety", radioName: "aws-anxiety", options: [
            { value: 0, label: "<b>0:</b> No apprehension or anxiety." },
            { value: 1, label: "<b>1:</b> Slight apprehension." },
            { value: 2, label: "<b>2:</b> Apprehension or understandable fear, e.g. of withdrawal symptoms." },
            { value: 3, label: "<b>3:</b> Anxiety occasionally accentuated to a state of panic." },
            { value: 4, label: "<b>4:</b> Constant panic-like anxiety." }
        ]},
        { displayName: "Agitation", radioName: "aws-agitation", options: [
            { value: 0, label: "<b>0:</b> Rests normally during day, no signs of agitation." },
            { value: 1, label: "<b>1:</b> Slight restlessness, cannot sit or lie still. Awake when others asleep." },
            { value: 2, label: "<b>2:</b> Moves constantly, looks tense. Wants to get out of bed but obeys requests to stay in bed." },
            { value: 3, label: "<b>3:</b> Constantly restless. Gets out of bed for no obvious reason." },
            { value: 4, label: "<b>4:</b> Maximally restless, aggressive. Ignores requests to stay in bed." }
        ]},
        { displayName: "Axilla temperature", radioName: "aws-temp", options: [
            { value: 0, label: "<b>0:</b> Temperature of 37.0°C." },
            { value: 1, label: "<b>1:</b> Temperature of 37.1-37.5°C." },
            { value: 2, label: "<b>2:</b> Temperature of 37.6-38.0°C." },
            { value: 3, label: "<b>3:</b> Temperature of 38.1-38.5°C." },
            { value: 4, label: "<b>4:</b> Temperature above 38.5°C." }
        ]},
        { displayName: "Hallucinations (sight, sound, taste or touch)", radioName: "aws-hallucinations", options: [
            { value: 0, label: "<b>0:</b> No evidence of hallucinations." },
            { value: 1, label: "<b>1:</b> Distortions of real objects, aware that these are not real if this is pointed out." },
            { value: 2, label: "<b>2:</b> Appearance of totally new objects or perceptions, aware that these are not real if this is pointed out." },
            { value: 3, label: "<b>3:</b> Believes the hallucinations are real but still orientated in place and person." },
            { value: 4, label: "<b>4:</b> Believes himself to be in a totally non existent environment, preoccupied, cannot be diverted or reassured." }
        ]},
        { displayName: "Orientation", radioName: "aws-orientation", options: [
            { value: 0, label: "<b>0:</b> The patient is fully orientated in time, place and person." },
            { value: 1, label: "<b>1:</b> The patient is fully orientated in person but is not sure where he is or what time it is." },
            { value: 2, label: "<b>2:</b> Orientated in person but disorientated in time and place." },
            { value: 3, label: "<b>3:</b> Doubtful personal orientation, disorientated in time and place; there may be short periods of lucidity." },
            { value: 4, label: "<b>4:</b> Disorientated in time, place and person. No meaningful contact can be obtained." }
        ]}
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
        { displayName: "Nausea and vomiting", radioName: "ciwa-nausea", options: [
            { value: 0, label: "<b>0:</b> No nausea and no vomiting." },
            { value: 1, label: "<b>1:</b> Mild nausea with no vomiting." },
            { value: 4, label: "<b>4:</b> Intermittent nausea with dry heaves." },
            { value: 7, label: "<b>7:</b> Constant nausea, frequent dry heaves and vomiting." }
        ]},
        { displayName: "Tremor", radioName: "ciwa-tremor", options: [
            { value: 0, label: "<b>0:</b> No tremor." },
            { value: 1, label: "<b>1:</b> Not visible, but can be felt fingertip to fingertip." },
            { value: 4, label: "<b>4:</b> Moderate, with patient's arms extended." },
            { value: 7, label: "<b>7:</b> Severe, even with arms not extended." }
        ]},
        { displayName: "Paroxysmal sweats", radioName: "ciwa-sweats", options: [
            { value: 0, label: "<b>0:</b> No sweat visible." },
            { value: 1, label: "<b>1:</b> Barely perceptible sweating, palms moist." },
            { value: 4, label: "<b>4:</b> Beads of sweat obvious on forehead." },
            { value: 7, label: "<b>7:</b> Drenching sweats." }
        ]},
        { displayName: "Anxiety", radioName: "ciwa-anxiety", options: [
            { value: 0, label: "<b>0:</b> No anxiety, at ease." },
            { value: 1, label: "<b>1:</b> Mildly anxious." },
            { value: 4, label: "<b>4:</b> Moderately anxious, or guarded, so anxiety is inferred." },
            { value: 7, label: "<b>7:</b> Equivalent to acute panic states as seen in severe delirium or acute schizophrenic reactions." }
        ]},
        { displayName: "Agitation", radioName: "ciwa-agitation", options: [
            { value: 0, label: "<b>0:</b> Normal activity." },
            { value: 1, label: "<b>1:</b> Somewhat more than normal activity." },
            { value: 4, label: "<b>4:</b> Moderately fidgety and restless." },
            { value: 7, label: "<b>7:</b> Equivalent to acute panic states as seen in severe delirium or acute schizophrenic reactions." }
        ]},
        { displayName: "Tactile disturbances", radioName: "ciwa-tactile", options: [
            { value: 0, label: "<b>0:</b> None." }, { value: 1, label: "<b>1:</b> Very mild itching, pins and needles, burning or numbness." },
            { value: 2, label: "<b>2:</b> Mild itching, pins and needles, burning or numbness." }, { value: 3, label: "<b>3:</b> Moderate itching, pins and needles, burning or numbness." },
            { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
        ]},
        { displayName: "Auditory disturbances", radioName: "ciwa-auditory", options: [
            { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild harshness or ability to frighten." },
            { value: 2, label: "<b>2:</b> Mild harshness or ability to frighten." }, { value: 3, label: "<b>3:</b> Moderate harshness or ability to frighten." },
            { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
        ]},
        { displayName: "Visual disturbances", radioName: "ciwa-visual", options: [
            { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild sensitivity." },
            { value: 2, label: "<b>2:</b> Mild sensitivity." }, { value: 3, label: "<b>3:</b> Moderate sensitivity." },
            { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
        ]},
        { displayName: "Headaches, fullness in head", radioName: "ciwa-headache", options: [
            { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild." }, { value: 2, label: "<b>2:</b> Mild." },
            { value: 3, label: "<b>3:</b> Moderate." }, { value: 4, label: "<b>4:</b> Moderately severe." }, { value: 5, label: "<b>5:</b> Severe." },
            { value: 6, label: "<b>6:</b> Very severe." }, { value: 7, label: "<b>7:</b> Extremely severe." }
        ]},
        { displayName: "Orientation and clouding of sensorium", radioName: "ciwa-orientation", options: [
            { value: 0, label: "<b>0:</b> Orientated and can do serial additions." }, { value: 1, label: "<b>1:</b> Cannot do serial additions or is uncertain about date." },
            { value: 2, label: "<b>2:</b> Disorientated for date by no more than 2 calendar days." }, { value: 3, label: "<b>3:</b> Disorientated for date by more than 2 calendar days." },
            { value: 4, label: "<b>4:</b> Disorientated for place and/or person." }
        ]}
    ],
    severityLogic: (score) => {
        if (score < 10) return "Mild withdrawal";
        if (score <= 18) return "Moderate withdrawal";
        return "Severe withdrawal";
    }
});

setupCalculator({
    id: 'saws',
    name: 'SAWS (Short Alcohol Withdrawal Scale)',
    items: [
        { displayName: "Anxious", radioName: "saws-anxious", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Sleep disturbance", radioName: "saws-sleep", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Memory problems", radioName: "saws-memory", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Nausea", radioName: "saws-nausea", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Restless", radioName: "saws-restless", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Tremor (shakes)", radioName: "saws-tremor", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Feeling confused", radioName: "saws-confused", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Sweating", radioName: "saws-sweating", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Miserable", radioName: "saws-miserable", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "Heart pounding", radioName: "saws-heart", options: [ { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]}
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
    name: 'COWS (Clinical Opiate Withdrawal Scale)',
    items: [
        { displayName: "Resting Pulse Rate", radioName: "cows-pulse", options: [
            { value: 0, label: "<b>0:</b> Pulse rate 80 or below" }, { value: 1, label: "<b>1:</b> Pulse rate 81-100" },
            { value: 2, label: "<b>2:</b> Pulse rate 101-120" }, { value: 4, label: "<b>4:</b> Pulse rate greater than 120" }
        ]},
        { displayName: "Sweating", radioName: "cows-sweating", options: [
            { value: 0, label: "<b>0:</b> No report of chills or flushing" }, { value: 1, label: "<b>1:</b> Subjective report of chills or flushing" },
            { value: 2, label: "<b>2:</b> Flushed or observable moistness on face" }, { value: 3, label: "<b>3:</b> Sweat streaming down face" }
        ]},
        { displayName: "Restlessness", radioName: "cows-restless", options: [
            { value: 0, label: "<b>0:</b> Able to sit still" }, { value: 1, label: "<b>1:</b> Reports difficulty sitting still, but is able to do so" },
            { value: 3, label: "<b>3:</b> Frequent shifting or extraneous movements of legs/arms" }, { value: 5, label: "<b>5:</b> Unable to sit still for more than a few seconds" }
        ]},
        { displayName: "Pupil size", radioName: "cows-pupil", options: [
            { value: 0, label: "<b>0:</b> Pupils pinned or normal size for room light" }, { value: 1, label: "<b>1:</b> Pupils possibly larger than normal for room light" },
            { value: 2, label: "<b>2:</b> Pupils moderately dilated" }, { value: 5, label: "<b>5:</b> Pupils so dilated that only the rim of the iris is visible" }
        ]},
        { displayName: "Bone or joint aches", radioName: "cows-aches", options: [
            { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Mild diffuse discomfort" },
            { value: 2, label: "<b>2:</b> Severe diffuse aching of joints/muscles" }, { value: 4, label: "<b>4:</b> Patient is rubbing joints or muscles" }
        ]},
        { displayName: "Runny nose or tearing", radioName: "cows-nose", options: [
            { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Nasal stuffiness or unusually moist eyes" },
            { value: 2, label: "<b>2:</b> Nose running or tearing" }, { value: 4, label: "<b>4:</b> Nose constantly running or tears streaming" }
        ]},
        { displayName: "GI Upset", radioName: "cows-gi", options: [
            { value: 0, label: "<b>0:</b> No GI symptoms" }, { value: 1, label: "<b>1:</b> Stomach cramps" }, { value: 2, label: "<b>2:</b> Nausea or loose stool" },
            { value: 3, label: "<b>3:</b> Vomiting or diarrhoea" }, { value: 5, label: "<b>5:</b> Multiple episodes of diarrhoea or vomiting" }
        ]},
        { displayName: "Tremor", radioName: "cows-tremor", options: [
            { value: 0, label: "<b>0:</b> No tremor" }, { value: 1, label: "<b>1:</b> Tremor can be felt but not observed" },
            { value: 2, label: "<b>2:</b> Slight tremor observable" }, { value: 4, label: "<b>4:</b> Gross tremor or muscle twitching" }
        ]},
        { displayName: "Yawning", radioName: "cows-yawning", options: [
            { value: 0, label: "<b>0:</b> No yawning" }, { value: 1, label: "<b>1:</b> Yawning once or twice during assessment" },
            { value: 2, label: "<b>2:</b> Yawning three or more times" }, { value: 4, label: "<b>4:</b> Yawning several times per minute" }
        ]},
        { displayName: "Anxiety or irritability", radioName: "cows-anxiety", options: [
            { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Reports increasing irritability or anxiousness" },
            { value: 2, label: "<b>2:</b> Obviously irritable or anxious" }, { value: 4, label: "<b>4:</b> So irritable or anxious that participation is difficult" }
        ]},
        { displayName: "Gooseflesh skin", radioName: "cows-skin", options: [
            { value: 0, label: "<b>0:</b> Skin is smooth" }, { value: 3, label: "<b>3:</b> Piloerection of skin can be felt" },
            { value: 5, label: "<b>5:</b> Prominent piloerection" }
        ]}
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
    name: 'CIWA-B (Benzodiazepine)',
    items: [
        { displayName: "1. Nausea and Vomiting", radioName: "ciwab-nausea", options: [
            { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild nausea, no vomiting" },
            { value: 4, label: "<b>4:</b> Intermittent nausea" }, { value: 7, label: "<b>7:</b> Constant nausea and vomiting" }
        ]},
        { displayName: "2. Tremor", radioName: "ciwab-tremor", options: [
            { value: 0, label: "<b>0:</b> No tremor" }, { value: 1, label: "<b>1:</b> Not visible, can be felt" },
            { value: 4, label: "<b>4:</b> Moderate with arms extended" }, { value: 7, label: "<b>7:</b> Severe, even without arms extended" }
        ]},
        { displayName: "3. Diaphoresis (Sweating)", radioName: "ciwab-sweats", options: [
            { value: 0, label: "<b>0:</b> No sweat visible" }, { value: 1, label: "<b>1:</b> Barely perceptible" },
            { value: 4, label: "<b>4:</b> Beads of sweat on forehead" }, { value: 7, label: "<b>7:</b> Drenching sweats" }
        ]},
        { displayName: "4. Anxiety", radioName: "ciwab-anxiety", options: [
            { value: 0, label: "<b>0:</b> No anxiety" }, { value: 1, label: "<b>1:</b> Mildly anxious" },
            { value: 4, label: "<b>4:</b> Moderately anxious or guarded" }, { value: 7, label: "<b>7:</b> Equivalent to acute panic" }
        ]},
        { displayName: "5. Agitation", radioName: "ciwab-agitation", options: [
            { value: 0, label: "<b>0:</b> Normal activity" }, { value: 1, label: "<b>1:</b> Somewhat more than normal" },
            { value: 2, label: "<b>2:</b> Moderately fidgety/restless" }, { value: 4, label: "<b>4:</b> Paces, thrashes about" }
        ]},
        { displayName: "6. Tactile Disturbances", radioName: "ciwab-tactile", options: [
            { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Very mild itching, pins and needles, burning or numbness" }, { value: 2, label: "<b>2:</b> Mild itching, pins and needles, burning or numbness" },
            { value: 3, label: "<b>3:</b> Moderate itching, pins and needles, burning or numbness" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
        ]},
        { displayName: "7. Auditory Disturbances", radioName: "ciwab-auditory", options: [
            { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild harshness or ability to frighten" }, { value: 2, label: "<b>2:</b> Mild harshness or ability to frighten" },
            { value: 3, label: "<b>3:</b> Moderate harshness or ability to frighten" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
        ]},
        { displayName: "8. Visual Disturbances", radioName: "ciwab-visual", options: [
            { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild sensitivity" }, { value: 2, label: "<b>2:</b> Mild sensitivity" },
            { value: 3, label: "<b>3:</b> Moderate sensitivity" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
            { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
        ]},
        { displayName: "9. Headache", radioName: "ciwab-headache", options: [
            { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild" }, { value: 2, label: "<b>2:</b> Mild" }, { value: 3, label: "<b>3:</b> Moderate" },
            { value: 4, label: "<b>4:</b> Moderately severe" }, { value: 5, label: "<b>5:</b> Severe" }, { value: 6, label: "<b>6:</b> Very severe" }, { value: 7, label: "<b>7:</b> Extremely severe" }
        ]},
        { displayName: "10. Clouding of Sensorium (Orientation)", radioName: "ciwab-orientation", options: [
            { value: 0, label: "<b>0:</b> Oriented" }, { value: 1, label: "<b>1:</b> Cannot do serial additions" }, { value: 2, label: "<b>2:</b> Disoriented for date by no more than 2 calendar days" },
            { value: 3, label: "<b>3:</b> Disoriented for date by more than 2 calendar days" }, { value: 4, label: "<b>4:</b> Disoriented for place and/or person" }
        ]}
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
    note: 'This is a monitoring tool, not a diagnostic one. Higher scores indicate greater severity.',
    items: [
        { displayName: "1. Craving for marijuana", radioName: "nsw-cws-craving", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" },
            { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }
        ]},
        { displayName: "2. Decreased appetite", radioName: "nsw-cws-appetite", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "3. Sleep difficulty", radioName: "nsw-cws-sleep", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "4. Increased aggression", radioName: "nsw-cws-aggression", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "5. Increased anger", radioName: "nsw-cws-anger", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "6. Increased irritability", radioName: "nsw-cws-irritability", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "7. Increased nervousness", radioName: "nsw-cws-nervousness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "8. Restlessness", radioName: "nsw-cws-restlessness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "9. Strange/vivid dreams", radioName: "nsw-cws-dreams", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "10. Nausea", radioName: "nsw-cws-nausea", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "11. Stomach ache", radioName: "nsw-cws-stomach", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "12. Shakiness/tremors", radioName: "nsw-cws-shakiness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "13. Sweating", radioName: "nsw-cws-sweating", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "14. Headache", radioName: "nsw-cws-headache", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "15. Depressed mood", radioName: "nsw-cws-depressed", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "16. Chills", radioName: "nsw-cws-chills", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "17. Physical tension", radioName: "nsw-cws-tension", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "18. Yawning", radioName: "nsw-cws-yawning", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "19. Runny nose", radioName: "nsw-cws-runnynose", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]}
    ],
    severityLogic: (score) => {
        // This scale does not have defined severity levels, it's for monitoring.
        return "N/A";
    }
});

setupCalculator({
    id: 'cwas',
    name: 'Cannabis Withdrawal Assessment Scale',
    note: 'This is a monitoring tool. Higher scores indicate greater severity.',
    items: [
        { displayName: "1. Craving for marijuana", radioName: "cwas-craving", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" },
            { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }
        ]},
        { displayName: "2. Decreased appetite", radioName: "cwas-appetite", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "3. Sleep difficulty", radioName: "cwas-sleep", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "4. Increased aggression", radioName: "cwas-aggression", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "5. Increased anger", radioName: "cwas-anger", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "6. Irritability", radioName: "cwas-irritability", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "7. Strange dreams", radioName: "cwas-dreams", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "8. Restlessness", radioName: "cwas-restlessness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "9. Chills", radioName: "cwas-chills", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "10. Feverish feeling", radioName: "cwas-feverish", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "11. Stuffy nose", radioName: "cwas-stuffy-nose", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "12. Nausea", radioName: "cwas-nausea", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "13. Diarrhoea", radioName: "cwas-diarrhoea", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "14. Hot flashes", radioName: "cwas-hot-flashes", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "15. Dizziness", radioName: "cwas-dizziness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "16. Sweating", radioName: "cwas-sweating", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "17. Hiccups", radioName: "cwas-hiccups", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "18. Yawning", radioName: "cwas-yawning", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "19. Headaches", radioName: "cwas-headaches", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "20. Shakiness", radioName: "cwas-shakiness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "21. Muscle spasms", radioName: "cwas-muscle-spasms", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "22. Stomach pains", radioName: "cwas-stomach-pains", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "23. Fatigue", radioName: "cwas-fatigue", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "24. Depressed mood", radioName: "cwas-depressed", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "25. Difficulty concentrating", radioName: "cwas-concentrating", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "26. Nervousness", radioName: "cwas-nervousness", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]},
        { displayName: "27. Violent outbursts", radioName: "cwas-violent-outbursts", options: [ { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" } ]}
    ],
    severityLogic: (score) => "N/A"
});

setupCalculator({
    id: 'awq',
    name: 'Amphetamine Withdrawal Questionnaire (AWQ)',
    note: 'This is a monitoring tool. Higher scores indicate greater severity.',
    items: [
        { displayName: "1. Craving for amphetamine", radioName: "awq-craving", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "2. Feeling sad", radioName: "awq-sad", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "3. Lost interest or pleasure", radioName: "awq-interest", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "4. Feeling anxious", radioName: "awq-anxious", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "5. Slowed movements", radioName: "awq-slowed", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "6. Feeling agitated", radioName: "awq-agitated", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "7. Feeling tired", radioName: "awq-tired", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "8. Increased appetite", radioName: "awq-appetite", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "9. Vivid or unpleasant dreams", radioName: "awq-dreams", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]},
        { displayName: "10. Craving sleep or sleeping too much", radioName: "awq-sleep", options: [
            { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
            { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
        ]}
    ],
    severityLogic: (score) => "N/A" // No severity levels provided, for monitoring only.
});

    // --- PWA Service Worker Registration ---
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Use an absolute path for the service worker to avoid issues with subdirectories.
            // Explicitly set the scope to the app's root directory.
            navigator.serviceWorker.register('/Withdrawal_App/sw.js', { scope: '/Withdrawal_App/' }).then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }, err => {
                console.log('ServiceWorker registration failed: ', err);
            });
        });
    }
});