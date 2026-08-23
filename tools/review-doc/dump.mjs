import { FLOWCHART_LOGIC } from '../../data/flowchart.js';
import * as regimens from '../../data/regimens.js';
import * as scales from '../../data/scales.js';
import * as symptomatic from '../../data/symptomatic.js';
import * as harm from '../../data/harm-reduction.js';
import * as benzo from '../../data/benzo-equivalence.js';
import * as meta from '../../data/content-meta.js';
const strip = o => JSON.parse(JSON.stringify(o, (k,v)=> typeof v === 'function' ? undefined : v));
const out = {
  FLOWCHART_LOGIC,
  REGIMEN_CONFIG: regimens.REGIMEN_CONFIG,
  EMR_SAFETY_LINES: regimens.EMR_SAFETY_LINES,
  INITIAL_SCORING_INTERVAL: regimens.INITIAL_SCORING_INTERVAL,
  SCALES: scales.SCALES,
  SCALE_CAVEATS_UNIVERSAL: scales.SCALE_CAVEATS_UNIVERSAL,
  SYMPTOMATIC: symptomatic.SYMPTOMATIC,
  SYMPTOMATIC_UNIVERSAL: symptomatic.SYMPTOMATIC_UNIVERSAL,
  HARM_REDUCTION: harm.HARM_REDUCTION,
  BENZO_EQUIVALENCE: benzo.BENZO_EQUIVALENCE,
  EQUIVALENCE_CAVEATS: benzo.EQUIVALENCE_CAVEATS,
  DIAZEPAM_REFERENCE_MG: benzo.DIAZEPAM_REFERENCE_MG,
  CONTENT_META: meta.CONTENT_META,
};
process.stdout.write(JSON.stringify(strip(out), null, 1));
