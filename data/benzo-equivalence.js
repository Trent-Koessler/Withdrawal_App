// Benzodiazepine / z-drug equivalence (P2-03).
//
// Exported as data rather than written into the page so that HyperTaper — the
// separate taper-calculator tool this site links to — can consume the same
// table instead of carrying its own copy. Two tools disagreeing about what
// clonazepam 0.5 mg is worth is exactly the failure this prevents.
//
// Source: eTG, via NSWCG Table 11.2. All values are milligrams equivalent to
// DIAZEPAM 5 mg.

export const DIAZEPAM_REFERENCE_MG = 5;

export const BENZO_EQUIVALENCE = [
    { drug: 'Alprazolam', mg: 0.5 },
    { drug: 'Bromazepam', mg: 3 },
    { drug: 'Clobazam', mg: 10 },
    { drug: 'Clonazepam', mg: 0.25 },
    { drug: 'Flunitrazepam', mg: 0.5 },
    { drug: 'Lorazepam', mg: 1 },
    { drug: 'Nitrazepam', mg: 5 },
    { drug: 'Oxazepam', mg: 15 },
    { drug: 'Temazepam', mg: 10 }
];

// A conversion table invites arithmetic, and the arithmetic is the easy part.
// These are the reasons the answer can still be wrong, so they travel with the
// numbers rather than sitting in a paragraph somewhere above them.
export const EQUIVALENCE_CAVEATS = [
    `Differing half-lives and receptor binding make exact equivalence difficult. These are approximations for planning a taper, not interchangeable doses.`,
    `<b>Z-drug conversion is unclear and is deliberately excluded</b> from this table.`,
    `Take particular care converting <b>from clonazepam</b> - reported equivalences vary widely.`,
    `<b>Lorazepam may be relatively more potent at higher doses</b>, so a conversion that holds at 1mg may not hold at 6mg.`
];
