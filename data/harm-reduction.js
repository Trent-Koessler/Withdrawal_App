// Shared harm reduction content (P2-06).
//
// The app previously offered take-home naloxone on the opioid page and nothing
// else. Harm reduction is the part of a withdrawal episode that still matters
// when the withdrawal does not succeed, which is most of the time, so it is
// composed from shared blocks and rendered on every substance page rather than
// written once where it was easiest.

// The single most important sentence after any withdrawal episode, on every
// page, in the same words.
const REDUCED_TOLERANCE = {
    heading: 'Reduced tolerance',
    danger: true,
    points: [
        `Tolerance falls after <b>any</b> withdrawal episode, completed or not. A dose that was routine before is enough to cause an overdose afterwards.`,
        `If the patient resumes use, advise <b>much smaller doses</b> than before, not using alone, and having someone who can call an ambulance.`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG §4.5.2</span>`
};

const INJECTING = {
    heading: 'Safer injecting',
    points: [
        `Needle and Syringe Program (NSP) access, and <b>sterile injecting kits to take home on discharge</b>.`,
        `Discuss <b>non-injecting routes</b> where the drug allows it.`,
        `Never share injecting equipment — including spoons, filters, water and tourniquets, not only needles.`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG §4.5.2, §8.4.1</span>`
};

const PIPES = {
    heading: 'Pipe and intranasal equipment hygiene',
    points: [
        `Use a <b>heat-resistant pipe</b> (e.g. Pyrex). Avoid broken or cracked pipes — they cause burns and cuts.`,
        `Clean the inside of pipes.`,
        `<b>Do not share pipes or intranasal equipment</b>: hepatitis B, herpes simplex, respiratory infections and tuberculosis all transmit this way.`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG §7.4.1</span>`
};

const SEXUAL_HEALTH = {
    heading: 'Sexual health',
    points: [
        `Safer sex; condoms and dental dams.`,
        `Discuss <b>PrEP and PEP</b> where relevant, and adherence to antiretroviral therapy for patients living with HIV.`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG §4.5.2, §7.4.1</span>`
};

const DRIVING = {
    heading: 'Driving',
    points: [
        `Advise on driving and give the advice explicitly — impairment, and the legal obligation to disclose a relevant condition to the licensing authority. <b>Document the advice given.</b>`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG §7.4.1</span>`
};

const NUAA = {
    heading: 'Peer resources',
    points: [
        `<b>NUAA</b> (NSW Users and AIDS Association) — peer-based information, resources and support for people who use drugs.`
    ],
    source: `<span class="src-tag src-nswcg">NSWCG App 3</span>`
};

export const HARM_REDUCTION = {
    alcohol: [
        REDUCED_TOLERANCE,
        {
            heading: 'Reducing risk while still drinking',
            points: [
                `Alternate alcoholic drinks with soft drinks or water; use smaller glasses; start later in the day.`,
                `Choose lower-alcohol alternatives.`,
                `Avoid top-ups and drinking in rounds — both make intake impossible to track.`,
                `Eat before and during drinking.`,
                `<b>Avoid combining alcohol with other sedatives</b>, including benzodiazepines and opioids.`,
                `Drink-spiking precautions.`
            ],
            source: `<span class="src-tag src-nswcg">NSWCG §5.5.1</span>`
        },
        DRIVING,
        NUAA
    ],

    opioid: [
        REDUCED_TOLERANCE,
        {
            heading: 'Take-home naloxone',
            danger: true,
            points: [
                `Always prescribe or supply take-home naloxone (e.g. Nyxoid nasal spray, or Prenoxad intramuscular injection) to <b>any</b> patient discharging from opioid withdrawal, with brief overdose response education.`
            ],
            source: `<span class="src-tag src-nswcg">NSWCG §8.4.1</span>`
        },
        INJECTING,
        SEXUAL_HEALTH,
        DRIVING,
        NUAA
    ],

    psychostimulant: [
        REDUCED_TOLERANCE,
        INJECTING,
        PIPES,
        SEXUAL_HEALTH,
        DRIVING,
        NUAA
    ],

    cannabis: [
        REDUCED_TOLERANCE,
        {
            heading: 'Reducing risk while still using',
            points: [
                `Avoid daily use.`,
                `Prefer <b>lower THC / higher CBD</b> products.`,
                `Avoid use in the teenage years.`,
                `Avoid mixing with tobacco — offer NRT where the patient does.`,
                `Avoid deep inhalation and bucket bongs.`,
                `Glass equipment rather than plastic, hoses or aluminium.`,
                `Vaporisers produce less tar than smoking.`
            ],
            source: `<span class="src-tag src-nswcg">NSWCG §6.4.1</span>`
        },
        DRIVING,
        NUAA
    ],

    benzodiazepine: [
        REDUCED_TOLERANCE,
        {
            heading: 'Reducing risk',
            points: [
                `<b>Avoid combining with alcohol or opioids</b> — respiratory depression is the mechanism of most benzodiazepine-involved deaths.`,
                `Staged dispensing reduces the risk of taking a taper's remaining supply at once.`
            ],
            source: `<span class="src-tag src-nswcg">NSWCG §11.4</span>`
        },
        DRIVING,
        NUAA
    ],

    ghb: [
        REDUCED_TOLERANCE,
        {
            heading: 'GHB-specific risks',
            danger: true,
            points: [
                `GHB is <b>colourless and odourless</b>, and is often stored in water bottles and takeaway soy sauce containers — a high risk of accidental poisoning, including of children. Advise storing it safely and out of reach.`,
                `<b>Avoid combining</b> with alcohol, benzodiazepines, sedating antihistamines or opioids.`,
                `Do not use alone.`,
                `<b>Wait long enough to feel the effects before redosing</b> — the gap between an effective dose and an overdose is small.`
            ],
            source: `<span class="src-tag src-nswcg">NSWCG §9.4.1</span>`
        },
        DRIVING,
        NUAA
    ]
};
