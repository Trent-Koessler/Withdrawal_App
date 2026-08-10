// Extracted from script.js so this clinical data can be unit tested.
//
// Each scale may carry `caveats`, rendered inside its own calculator rather
// than on a help page nobody opens (AUTH-05). The UI puts a total next to a
// severity band and an EMR summary, which is a strong invitation to treat the
// number as the decision — so the limits of each instrument have to sit in the
// same field of view as its output.

// True of every scale here, and the sentence most often forgotten.
export const SCALE_CAVEATS_UNIVERSAL = [
    `Scales <b>do not diagnose withdrawal</b> and <b>do not override clinical judgement</b>. They measure the severity of a syndrome that has already been diagnosed. <span class="src-tag src-nswcg">NSWCG §4.4.2</span>`
];

// CIWA-Ar and AWS: both depend on the patient being able to report and on the
// observer being able to read consciousness, which is exactly what is
// unreliable in the patients who score highest.
const ALCOHOL_SCALE_CAVEATS = [
    `<b>Consider discontinuing the scale in patients with multiple pathologies</b>, where the result may be misleading rather than merely imprecise. <span class="src-tag src-nswcg">NSWCG §5.4.5</span>`,
    `<b>Monitoring of consciousness may be compromised by head injury or CVA</b> — specialist consultation is essential in those patients. <span class="src-tag src-nswcg">NSWCG §5.4.5</span>`,
    `<b>Re-evaluate regularly</b> to confirm the diagnosis is withdrawal and not another condition — particularly where the patient is not responding to treatment. A rising score is a reason to reconsider the diagnosis, not only to increase the dose. <span class="src-tag src-nswcg">NSWCG §5.4.5</span>`
];

// The monitoring-only scales. The UI shows a score and a severity band beside
// each other, which invites an inference these instruments cannot support.
const NOT_FOR_DOSING = [
    `<b>This scale is not validated for linking a score to a medication decision.</b> Use it to track change over time, not to choose or justify a dose. <span class="src-tag src-nswcg">NSWCG §6.3.5, §7.3.5, §11.3.8</span>`
];

export const SCALES = [
    {
        id: 'aws',
        caveats: ALCOHOL_SCALE_CAVEATS,
        name: 'Alcohol Withdrawal Scale (AWS)',
        reference: 'Adapted from NSW Dept of Health (2000).',
        items: [
            {
                displayName: "Perspiration", radioName: "aws-perspiration", options: [
                    { value: 0, label: "<b>0:</b> No abnormal sweating." },
                    { value: 1, label: "<b>1:</b> Moist skin." },
                    { value: 2, label: "<b>2:</b> Localised beads of sweat, e.g. on face, chest." },
                    { value: 3, label: "<b>3:</b> Whole body wet from perspiration." },
                    { value: 4, label: "<b>4:</b> Profuse maximal sweating-clothes, linen are wet." }
                ]
            },
            {
                displayName: "Tremor", radioName: "aws-tremor", options: [
                    { value: 0, label: "<b>0:</b> No tremor." },
                    { value: 1, label: "<b>1:</b> Slight tremor." },
                    { value: 2, label: "<b>2:</b> Constant slight tremor of upper extremities." },
                    { value: 3, label: "<b>3:</b> Constant marked tremor of extremities." }
                ]
            },
            {
                displayName: "Anxiety", radioName: "aws-anxiety", options: [
                    { value: 0, label: "<b>0:</b> No apprehension or anxiety." },
                    { value: 1, label: "<b>1:</b> Slight apprehension." },
                    { value: 2, label: "<b>2:</b> Apprehension or understandable fear, e.g. of withdrawal symptoms." },
                    { value: 3, label: "<b>3:</b> Anxiety occasionally accentuated to a state of panic." },
                    { value: 4, label: "<b>4:</b> Constant panic-like anxiety." }
                ]
            },
            {
                displayName: "Agitation", radioName: "aws-agitation", options: [
                    { value: 0, label: "<b>0:</b> Rests normally during day, no signs of agitation." },
                    { value: 1, label: "<b>1:</b> Slight restlessness, cannot sit or lie still. Awake when others asleep." },
                    { value: 2, label: "<b>2:</b> Moves constantly, looks tense. Wants to get out of bed but obeys requests to stay in bed." },
                    { value: 3, label: "<b>3:</b> Constantly restless. Gets out of bed for no obvious reason." },
                    { value: 4, label: "<b>4:</b> Maximally restless, aggressive. Ignores requests to stay in bed." }
                ]
            },
            {
                displayName: "Axilla temperature", radioName: "aws-temp", options: [
                    { value: 0, label: "<b>0:</b> Temperature of 37.0°C." },
                    { value: 1, label: "<b>1:</b> Temperature of 37.1-37.5°C." },
                    { value: 2, label: "<b>2:</b> Temperature of 37.6-38.0°C." },
                    { value: 3, label: "<b>3:</b> Temperature of 38.1-38.5°C." },
                    { value: 4, label: "<b>4:</b> Temperature above 38.5°C." }
                ]
            },
            {
                displayName: "Hallucinations (sight, sound, taste or touch)", radioName: "aws-hallucinations", options: [
                    { value: 0, label: "<b>0:</b> No evidence of hallucinations." },
                    { value: 1, label: "<b>1:</b> Distortions of real objects, aware that these are not real if this is pointed out." },
                    { value: 2, label: "<b>2:</b> Appearance of totally new objects or perceptions, aware that these are not real if this is pointed out." },
                    { value: 3, label: "<b>3:</b> Believes the hallucinations are real but still orientated in place and person." },
                    { value: 4, label: "<b>4:</b> Believes himself to be in a totally non existent environment, preoccupied, cannot be diverted or reassured." }
                ]
            },
            {
                displayName: "Orientation", radioName: "aws-orientation", options: [
                    { value: 0, label: "<b>0:</b> The patient is fully orientated in time, place and person." },
                    { value: 1, label: "<b>1:</b> The patient is fully orientated in person but is not sure where he is or what time it is." },
                    { value: 2, label: "<b>2:</b> Orientated in person but disorientated in time and place." },
                    { value: 3, label: "<b>3:</b> Doubtful personal orientation, disorientated in time and place; there may be short periods of lucidity." },
                    { value: 4, label: "<b>4:</b> Disorientated in time, place and person. No meaningful contact can be obtained." }
                ]
            }
        ],
        severityLogic: (score) => {
            if (score <= 4) return "Mild withdrawal";
            if (score <= 14) return "Moderate withdrawal";
            return "Severe withdrawal";
        }
    },

    {
        id: 'ciwa-ar',
        caveats: ALCOHOL_SCALE_CAVEATS,
        name: 'CIWA-Ar',
        reference: 'Clinical institute withdrawal assessment for alcohol — revised. Sullivan J, Sykora M, Schneiderman J, et al. Assessment of alcohol withdrawal: the revised Clinical Institute withdrawal for alcohol scale (CIWA-Ar). Br J Addict 1989; 84: 1353–1357.',
        items: [
            {
                displayName: "Nausea and vomiting", instruction: "Ask “Do you feel sick to your stomach? Have you vomited?” and observe.", radioName: "ciwa-nausea", options: [
                    { value: 0, label: "<b>0:</b> No nausea and no vomiting." },
                    { value: 1, label: "<b>1:</b> Mild nausea with no vomiting." },
                    { value: 4, label: "<b>4:</b> Intermittent nausea with dry heaves." },
                    { value: 7, label: "<b>7:</b> Constant nausea, frequent dry heaves and vomiting." }
                ]
            },
            {
                displayName: "Tremor", instruction: "Observe patient’s arms extended and fingers spread apart.", radioName: "ciwa-tremor", options: [
                    { value: 0, label: "<b>0:</b> No tremor." },
                    { value: 1, label: "<b>1:</b> Not visible, but can be felt fingertip to fingertip." },
                    { value: 4, label: "<b>4:</b> Moderate, with patient's arms extended." },
                    { value: 7, label: "<b>7:</b> Severe, even with arms not extended." }
                ]
            },
            {
                displayName: "Paroxysmal sweats", radioName: "ciwa-sweats", options: [
                    { value: 0, label: "<b>0:</b> No sweat visible." },
                    { value: 1, label: "<b>1:</b> Barely perceptible sweating, palms moist." },
                    { value: 4, label: "<b>4:</b> Beads of sweat obvious on forehead." },
                    { value: 7, label: "<b>7:</b> Drenching sweats." }
                ]
            },
            {
                displayName: "Anxiety", instruction: "Observe, and ask, “Do you feel nervous?”", radioName: "ciwa-anxiety", options: [
                    { value: 0, label: "<b>0:</b> No anxiety, at ease." },
                    { value: 1, label: "<b>1:</b> Mildly anxious." },
                    { value: 4, label: "<b>4:</b> Moderately anxious, or guarded, so anxiety is inferred." },
                    { value: 7, label: "<b>7:</b> Equivalent to acute panic states as seen in severe delirium or acute schizophrenic reactions." }
                ]
            },
            {
                displayName: "Agitation", radioName: "ciwa-agitation", options: [
                    { value: 0, label: "<b>0:</b> Normal activity." },
                    { value: 1, label: "<b>1:</b> Somewhat more than normal activity." },
                    { value: 4, label: "<b>4:</b> Moderately fidgety and restless." },
                    { value: 7, label: "<b>7:</b> Equivalent to acute panic states as seen in severe delirium or acute schizophrenic reactions." }
                ]
            },
            {
                displayName: "Tactile disturbances", instruction: "Ask “Have you any itching, pins and needles sensations, any burning, any numbness or do you feel bugs crawling on or under your skin?”", radioName: "ciwa-tactile", options: [
                    { value: 0, label: "<b>0:</b> None." }, { value: 1, label: "<b>1:</b> Very mild itching, pins and needles, burning or numbness." },
                    { value: 2, label: "<b>2:</b> Mild itching, pins and needles, burning or numbness." }, { value: 3, label: "<b>3:</b> Moderate itching, pins and needles, burning or numbness." },
                    { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
                ]
            },
            {
                displayName: "Auditory disturbances", instruction: "Ask “Are you more aware of sounds around you? Are they harsh? Do they frighten you? Are you hearing anything that is disturbing to you? Are you hearing things you know are not there?”, and observe.", radioName: "ciwa-auditory", options: [
                    { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild harshness or ability to frighten." },
                    { value: 2, label: "<b>2:</b> Mild harshness or ability to frighten." }, { value: 3, label: "<b>3:</b> Moderate harshness or ability to frighten." },
                    { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
                ]
            },
            {
                displayName: "Visual disturbances", instruction: "Ask “Does the light appear to be too bright? Is its colour different? Does it hurt your eyes? Are you seeing anything that is disturbing to you? Are you seeing things you know are not there?”, and observe.", radioName: "ciwa-visual", options: [
                    { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild sensitivity." },
                    { value: 2, label: "<b>2:</b> Mild sensitivity." }, { value: 3, label: "<b>3:</b> Moderate sensitivity." },
                    { value: 4, label: "<b>4:</b> Moderately severe hallucinations." }, { value: 5, label: "<b>5:</b> Severe hallucinations." },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations." }, { value: 7, label: "<b>7:</b> Continuous hallucinations." }
                ]
            },
            {
                displayName: "Headaches, fullness in head", instruction: "Ask “Does your head feel different? Does it feel like there is a band around your head?” Do not rate for dizziness or lightheadedness. Otherwise, rate severity", radioName: "ciwa-headache", options: [
                    { value: 0, label: "<b>0:</b> Not present." }, { value: 1, label: "<b>1:</b> Very mild." }, { value: 2, label: "<b>2:</b> Mild." },
                    { value: 3, label: "<b>3:</b> Moderate." }, { value: 4, label: "<b>4:</b> Moderately severe." }, { value: 5, label: "<b>5:</b> Severe." },
                    { value: 6, label: "<b>6:</b> Very severe." }, { value: 7, label: "<b>7:</b> Extremely severe." }
                ]
            },
            {
                displayName: "Orientation and clouding of sensorium", instruction: "Ask “What day is this? Where are you? Who am I?”", radioName: "ciwa-orientation", options: [
                    { value: 0, label: "<b>0:</b> Orientated and can do serial additions." }, { value: 1, label: "<b>1:</b> Cannot do serial additions or is uncertain about date." },
                    { value: 2, label: "<b>2:</b> Disorientated for date by no more than 2 calendar days." }, { value: 3, label: "<b>3:</b> Disorientated for date by more than 2 calendar days." },
                    { value: 4, label: "<b>4:</b> Disorientated for place and/or person." }
                ]
            }
        ],
        severityLogic: (score) => {
            if (score < 10) return "Mild withdrawal";
            if (score <= 18) return "Moderate withdrawal";
            return "Severe withdrawal";
        }
    },

    {
        id: 'saws',
        name: 'SAWS (Short Alcohol Withdrawal Scale)',
        reference: "Gossop, M, Keaney, F, Stewart, D, Marshall, E & Strang, JA 2002, ‘Short Alcohol Withdrawal Scale (SAWS) development and psychometric properties’, Addiction Biology, vol. 7, pp. 37–43.",
        items: [
            { displayName: "Anxious", radioName: "saws-anxious", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Sleep disturbance", radioName: "saws-sleep", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Memory problems", radioName: "saws-memory", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Nausea", radioName: "saws-nausea", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Restless", radioName: "saws-restless", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Tremor (shakes)", radioName: "saws-tremor", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Feeling confused", radioName: "saws-confused", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Sweating", radioName: "saws-sweating", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Miserable", radioName: "saws-miserable", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "Heart pounding", radioName: "saws-heart", options: [{ value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] }
        ],
        severityLogic: (score) => {
            if (score === 0) return "None";
            if (score <= 5) return "Mild";
            if (score <= 12) return "Moderate";
            return "Severe";
        }
    },

    {
        id: 'cows',
        caveats: [
            `<b>COWS is preferred over SOWS</b> because it assesses both objective and subjective measures. <span class="src-tag src-nswcg">NSWCG §8.3.6</span>`,
            `For inpatient treatment, score <b>6-hourly</b>. <span class="src-tag src-nswcg">NSWCG §8.3.6</span>`
        ],
        name: 'COWS (Clinical Opiate Withdrawal Scale)',
        reference: 'Wesson, D. R., & Ling, W. (2003). The Clinical Opiate Withdrawal Scale (COWS). Journal of Psychoactive Drugs, 35(2), 253–259.',
        relatedPage: { id: 'opioid-withdrawal-page', title: 'Opioid Withdrawal Guidelines' },
        items: [
            {
                displayName: "Resting Pulse Rate", instruction: "Measured after patient is sitting or lying for one minute.", radioName: "cows-pulse", options: [
                    { value: 0, label: "<b>0:</b> Pulse rate 80 or below" }, { value: 1, label: "<b>1:</b> Pulse rate 81-100" },
                    { value: 2, label: "<b>2:</b> Pulse rate 101-120" }, { value: 4, label: "<b>4:</b> Pulse rate greater than 120" }
                ]
            },
            {
                displayName: "Sweating", instruction: "Over past half-hour not accounted for by room temperature or patient activity.", radioName: "cows-sweating", options: [
                    { value: 0, label: "<b>0:</b> No report of chills or flushing" }, { value: 1, label: "<b>1:</b> Subjective report of chills or flushing" },
                    { value: 2, label: "<b>2:</b> Flushed or observable moistness on face" }, { value: 3, label: "<b>3:</b> Sweat streaming down face" }
                ]
            },
            {
                displayName: "Restlessness", instruction: "Observation during assessment", radioName: "cows-restless", options: [
                    { value: 0, label: "<b>0:</b> Able to sit still" }, { value: 1, label: "<b>1:</b> Reports difficulty sitting still, but is able to do so" },
                    { value: 3, label: "<b>3:</b> Frequent shifting or extraneous movements of legs/arms" }, { value: 5, label: "<b>5:</b> Unable to sit still for more than a few seconds" }
                ]
            },
            {
                displayName: "Pupil size", radioName: "cows-pupil", options: [
                    { value: 0, label: "<b>0:</b> Pupils pinned or normal size for room light" }, { value: 1, label: "<b>1:</b> Pupils possibly larger than normal for room light" },
                    { value: 2, label: "<b>2:</b> Pupils moderately dilated" }, { value: 5, label: "<b>5:</b> Pupils so dilated that only the rim of the iris is visible" }
                ]
            },
            {
                displayName: "Bone or joint aches", instruction: "If patient was having pain previously, only the additional component attributed to opiates withdrawal is scored", radioName: "cows-aches", options: [
                    { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Mild diffuse discomfort" },
                    { value: 2, label: "<b>2:</b> Patient reports severe diffuse aching of joints/muscles" }, { value: 4, label: "<b>4:</b> Patient is rubbing joints or muscles and is unable to sit still because of discomfort" }
                ]
            },
            {
                displayName: "Runny nose or tearing", instruction: "Not accounted for by cold symptoms or allergies", radioName: "cows-nose", options: [
                    { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Nasal stuffiness or unusually moist eyes" },
                    { value: 2, label: "<b>2:</b> Nose running or tearing" }, { value: 4, label: "<b>4:</b> Nose constantly running or tears streaming down cheeks" }
                ]
            },
            {
                displayName: "GI Upset", instruction: "Over last half-hour", radioName: "cows-gi", options: [
                    { value: 0, label: "<b>0:</b> No GI symptoms" }, { value: 1, label: "<b>1:</b> Stomach cramps" }, { value: 2, label: "<b>2:</b> Nausea or loose stool" },
                    { value: 3, label: "<b>3:</b> Vomiting or diarrhoea" }, { value: 5, label: "<b>5:</b> Multiple episodes of diarrhoea or vomiting" }
                ]
            },
            {
                displayName: "Tremor", instruction: "Observation of outstretched hands", radioName: "cows-tremor", options: [
                    { value: 0, label: "<b>0:</b> No tremor" }, { value: 1, label: "<b>1:</b> Tremor can be felt but not observed" },
                    { value: 2, label: "<b>2:</b> Slight tremor observable" }, { value: 4, label: "<b>4:</b> Gross tremor or muscle twitching" }
                ]
            },
            {
                displayName: "Yawning", instruction: "Observation during assessment", radioName: "cows-yawning", options: [
                    { value: 0, label: "<b>0:</b> No yawning" }, { value: 1, label: "<b>1:</b> Yawning once or twice during assessment" },
                    { value: 2, label: "<b>2:</b> Yawning three or more times during assessment" }, { value: 4, label: "<b>4:</b> Yawning several times per minute" }
                ]
            },
            {
                displayName: "Anxiety or irritability", radioName: "cows-anxiety", options: [
                    { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Reports increasing irritability or anxiousness" },
                    { value: 2, label: "<b>2:</b> Obviously irritable or anxious" }, { value: 4, label: "<b>4:</b> Patient so irritable or anxious that participation in the assessment is difficult" }
                ]
            },
            {
                displayName: "Gooseflesh skin", radioName: "cows-skin", options: [
                    { value: 0, label: "<b>0:</b> Skin is smooth" }, { value: 3, label: "<b>3:</b> Piloerection of skin can be felt or hairs standing up on arms" },
                    { value: 5, label: "<b>5:</b> Prominent piloerection" }
                ]
            }
        ],
        severityLogic: (score) => {
            if (score <= 4) return "Minimal Withdrawal";
            if (score <= 12) return "Mild Withdrawal";
            if (score <= 24) return "Moderate Withdrawal";
            if (score <= 36) return "Moderately Severe";
            return "Severe Withdrawal";
        }

    },

    {
        id: 'ciwa-b',
        caveats: NOT_FOR_DOSING,
        name: 'CIWA-B (Benzodiazepine)',
        reference: "Busto UE, Sykora K, Sellers EM. A clinical scale to assess benzodiazepine withdrawal. Journal of Clinical Psychopharmacology. 1989;9(6):412-6. doi: 10.1097/00004714-198912000-00005",
        relatedPage: { id: 'benzo-withdrawal-page', title: 'Benzodiazepine Withdrawal Guidelines' },
        items: [
            {
                displayName: "1. Nausea and Vomiting", radioName: "ciwab-nausea", options: [
                    { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Mild nausea, no vomiting" },
                    { value: 4, label: "<b>4:</b> Intermittent nausea" }, { value: 7, label: "<b>7:</b> Constant nausea and vomiting" }
                ]
            },
            {
                displayName: "2. Tremor", radioName: "ciwab-tremor", options: [
                    { value: 0, label: "<b>0:</b> No tremor" }, { value: 1, label: "<b>1:</b> Not visible, can be felt" },
                    { value: 4, label: "<b>4:</b> Moderate with arms extended" }, { value: 7, label: "<b>7:</b> Severe, even without arms extended" }
                ]
            },
            {
                displayName: "3. Diaphoresis (Sweating)", radioName: "ciwab-sweats", options: [
                    { value: 0, label: "<b>0:</b> No sweat visible" }, { value: 1, label: "<b>1:</b> Barely perceptible" },
                    { value: 4, label: "<b>4:</b> Beads of sweat on forehead" }, { value: 7, label: "<b>7:</b> Drenching sweats" }
                ]
            },
            {
                displayName: "4. Anxiety", radioName: "ciwab-anxiety", options: [
                    { value: 0, label: "<b>0:</b> No anxiety" }, { value: 1, label: "<b>1:</b> Mildly anxious" },
                    { value: 4, label: "<b>4:</b> Moderately anxious or guarded" }, { value: 7, label: "<b>7:</b> Equivalent to acute panic" }
                ]
            },
            {
                displayName: "5. Agitation", radioName: "ciwab-agitation", options: [
                    { value: 0, label: "<b>0:</b> Normal activity" }, { value: 1, label: "<b>1:</b> Somewhat more than normal" },
                    { value: 2, label: "<b>2:</b> Moderately fidgety/restless" }, { value: 4, label: "<b>4:</b> Paces, thrashes about" }
                ]
            },
            {
                displayName: "6. Tactile Disturbances", radioName: "ciwab-tactile", options: [
                    { value: 0, label: "<b>0:</b> None" }, { value: 1, label: "<b>1:</b> Very mild itching, pins and needles, burning or numbness" }, { value: 2, label: "<b>2:</b> Mild itching, pins and needles, burning or numbness" },
                    { value: 3, label: "<b>3:</b> Moderate itching, pins and needles, burning or numbness" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
                ]
            },
            {
                displayName: "7. Auditory Disturbances", radioName: "ciwab-auditory", options: [
                    { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild harshness or ability to frighten" }, { value: 2, label: "<b>2:</b> Mild harshness or ability to frighten" },
                    { value: 3, label: "<b>3:</b> Moderate harshness or ability to frighten" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
                ]
            },
            {
                displayName: "8. Visual Disturbances", radioName: "ciwab-visual", options: [
                    { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild sensitivity" }, { value: 2, label: "<b>2:</b> Mild sensitivity" },
                    { value: 3, label: "<b>3:</b> Moderate sensitivity" }, { value: 4, label: "<b>4:</b> Moderately severe hallucinations" }, { value: 5, label: "<b>5:</b> Severe hallucinations" },
                    { value: 6, label: "<b>6:</b> Extremely severe hallucinations" }, { value: 7, label: "<b>7:</b> Continuous hallucinations" }
                ]
            },
            {
                displayName: "9. Headache", radioName: "ciwab-headache", options: [
                    { value: 0, label: "<b>0:</b> Not present" }, { value: 1, label: "<b>1:</b> Very mild" }, { value: 2, label: "<b>2:</b> Mild" }, { value: 3, label: "<b>3:</b> Moderate" },
                    { value: 4, label: "<b>4:</b> Moderately severe" }, { value: 5, label: "<b>5:</b> Severe" }, { value: 6, label: "<b>6:</b> Very severe" }, { value: 7, label: "<b>7:</b> Extremely severe" }
                ]
            },
            {
                displayName: "10. Clouding of Sensorium (Orientation)", radioName: "ciwab-orientation", options: [
                    { value: 0, label: "<b>0:</b> Oriented" }, { value: 1, label: "<b>1:</b> Cannot do serial additions" }, { value: 2, label: "<b>2:</b> Disoriented for date by no more than 2 calendar days" },
                    { value: 3, label: "<b>3:</b> Disoriented for date by more than 2 calendar days" }, { value: 4, label: "<b>4:</b> Disoriented for place and/or person" }
                ]
            }
        ],
        severityLogic: (score) => {
            if (score < 10) return "Mild withdrawal";
            if (score <= 20) return "Moderate withdrawal";
            return "Severe withdrawal";
        }
    },

    {
        id: 'nsw-cws',
        caveats: NOT_FOR_DOSING,
        name: 'Cannabis Withdrawal Scale',
        reference: "Allsop DJ, Norberg MM, Copeland J, Fu S, Budney AJ. The Cannabis Withdrawal Scale development: patterns and predictors of cannabis withdrawal and distress. Drug Alcohol Dependence. 2011;119(1-2):123-9. doi: 10.1016/j.drugalcdep.2011.06.003",
        relatedPage: { id: 'cannabis-withdrawal-page', title: 'Cannabis Withdrawal Guidelines' },
        note: 'This is a monitoring tool, not a diagnostic one. Higher scores indicate greater severity.',
        items: [
            {
                displayName: "1. Craving for marijuana", radioName: "nsw-cws-craving", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" },
                    { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }
                ]
            },
            { displayName: "2. Decreased appetite", radioName: "nsw-cws-appetite", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "3. Sleep difficulty", radioName: "nsw-cws-sleep", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "4. Increased aggression", radioName: "nsw-cws-aggression", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "5. Increased anger", radioName: "nsw-cws-anger", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "6. Increased irritability", radioName: "nsw-cws-irritability", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "7. Increased nervousness", radioName: "nsw-cws-nervousness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "8. Restlessness", radioName: "nsw-cws-restlessness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "9. Strange/vivid dreams", radioName: "nsw-cws-dreams", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "10. Nausea", radioName: "nsw-cws-nausea", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "11. Stomach ache", radioName: "nsw-cws-stomach", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "12. Shakiness/tremors", radioName: "nsw-cws-shakiness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "13. Sweating", radioName: "nsw-cws-sweating", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "14. Headache", radioName: "nsw-cws-headache", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "15. Depressed mood", radioName: "nsw-cws-depressed", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "16. Chills", radioName: "nsw-cws-chills", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "17. Physical tension", radioName: "nsw-cws-tension", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "18. Yawning", radioName: "nsw-cws-yawning", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "19. Runny nose", radioName: "nsw-cws-runnynose", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] }
        ],
        severityLogic: (score) => {
            // This scale does not have defined severity levels, it's for monitoring.
            return "N/A";
        }
    },

    {
        id: 'cwas',
        caveats: NOT_FOR_DOSING,
        name: 'Cannabis Withdrawal Assessment Scale',
        reference: "Budney, A. et al, Archives of General Psychiatry, Volume 58 (10) October 2001, 917–924.",
        relatedPage: { id: 'cannabis-withdrawal-page', title: 'Cannabis Withdrawal Guidelines' },
        note: 'This is a monitoring tool. Higher scores indicate greater severity.',
        items: [
            {
                displayName: "1. Craving for marijuana", radioName: "cwas-craving", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" },
                    { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }
                ]
            },
            { displayName: "2. Decreased appetite", radioName: "cwas-appetite", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "3. Sleep difficulty", radioName: "cwas-sleep", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "4. Increased aggression", radioName: "cwas-aggression", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "5. Increased anger", radioName: "cwas-anger", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "6. Irritability", radioName: "cwas-irritability", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "7. Strange dreams", radioName: "cwas-dreams", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "8. Restlessness", radioName: "cwas-restlessness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "9. Chills", radioName: "cwas-chills", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "10. Feverish feeling", radioName: "cwas-feverish", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "11. Stuffy nose", radioName: "cwas-stuffy-nose", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "12. Nausea", radioName: "cwas-nausea", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "13. Diarrhoea", radioName: "cwas-diarrhoea", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "14. Hot flashes", radioName: "cwas-hot-flashes", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "15. Dizziness", radioName: "cwas-dizziness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "16. Sweating", radioName: "cwas-sweating", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "17. Hiccups", radioName: "cwas-hiccups", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "18. Yawning", radioName: "cwas-yawning", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "19. Headaches", radioName: "cwas-headaches", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "20. Shakiness", radioName: "cwas-shakiness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "21. Muscle spasms", radioName: "cwas-muscle-spasms", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "22. Stomach pains", radioName: "cwas-stomach-pains", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "23. Fatigue", radioName: "cwas-fatigue", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "24. Depressed mood", radioName: "cwas-depressed", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "25. Difficulty concentrating", radioName: "cwas-concentrating", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "26. Nervousness", radioName: "cwas-nervousness", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] },
            { displayName: "27. Violent outbursts", radioName: "cwas-violent-outbursts", options: [{ value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> Mild" }, { value: 2, label: "<b>2:</b> Moderate" }, { value: 3, label: "<b>3:</b> Severe" }] }
        ],
        severityLogic: (score) => "N/A"
    },

    {
        id: 'awq',
        caveats: NOT_FOR_DOSING,
        name: 'Amphetamine Withdrawal Questionnaire (AWQ)',
        reference: "Srisurapanont, M., Jarusuraisin, N., and Jittiwutikan, J. Amphetamine withdrawal: Reliability, validity and factor structure of a measure. Australian and New Zealand Journal of Psychiatry, 1999. 33(1): 89-93",
        relatedPage: { id: 'stimulant-withdrawal-page', title: 'Psychostimulant Withdrawal Guidelines' },
        note: 'This is a monitoring tool. Higher scores indicate greater severity.',
        items: [
            {
                displayName: "1. Craving for amphetamine", radioName: "awq-craving", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "2. Feeling sad", radioName: "awq-sad", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "3. Lost interest or pleasure", radioName: "awq-interest", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "4. Feeling anxious", radioName: "awq-anxious", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "5. Slowed movements", radioName: "awq-slowed", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "6. Feeling agitated", radioName: "awq-agitated", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "7. Feeling tired", radioName: "awq-tired", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "8. Increased appetite", radioName: "awq-appetite", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "9. Vivid or unpleasant dreams", radioName: "awq-dreams", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            },
            {
                displayName: "10. Craving sleep or sleeping too much", radioName: "awq-sleep", options: [
                    { value: 0, label: "<b>0:</b> Not at all" }, { value: 1, label: "<b>1:</b> A little" },
                    { value: 2, label: "<b>2:</b> Moderately" }, { value: 3, label: "<b>3:</b> Quite a bit" }, { value: 4, label: "<b>4:</b> Extremely" }
                ]
            }
        ],
        severityLogic: (score) => "N/A" // No severity levels provided, for monitoring only.
    }
];
