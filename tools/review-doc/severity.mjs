import { SCALES } from '../../data/scales.js';
const out = {};
for (const sc of SCALES) {
  if (typeof sc.severityLogic !== 'function') { out[sc.id] = null; continue; }
  // Maximum attainable total = sum of the highest option value on each item.
  const max = (sc.items || []).reduce((t, it) =>
    t + Math.max(...(it.options || [{value:0}]).map(o => o.value ?? 0)), 0);
  const bands = [];
  for (let s = 0; s <= max; s++) {
    const label = String(sc.severityLogic(s));
    if (bands.length && bands[bands.length-1].label === label) bands[bands.length-1].to = s;
    else bands.push({ from: s, to: s, label });
  }
  out[sc.id] = { max, bands };
}
process.stdout.write(JSON.stringify(out, null, 1));
