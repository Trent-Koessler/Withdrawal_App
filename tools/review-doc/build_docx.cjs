const fs = require('fs');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, ShadingType, BorderStyle, AlignmentType, PageOrientation, PageBreak,
        TableOfContents, Header, Footer, PageNumber, VerticalAlign } = D;

const WORK = process.env.WORK_DIR || '.';
const read = n => JSON.parse(fs.readFileSync(require('path').join(WORK, n), 'utf8'));
const htmlPages = read('html.json');
const generated = read('generated.json');
const meta      = read('data.json').CONTENT_META;
const INFO      = read('info.json');

// ---- layout -----------------------------------------------------------------
const MARGIN = 720;
const PAGE_W = 16838, USABLE = PAGE_W - MARGIN*2;          // A4 landscape
const COLS   = [1000, 8300, 2100, 1750, 2248];             // Ref | Text | Source | Verdict | Comment
const SUM = COLS.reduce((a,b)=>a+b,0);
if (SUM !== USABLE) throw new Error(`columns ${SUM} != usable ${USABLE}`);

const GREY = 'F2F2F2', HEAD = 'D9E2F3', WARN = 'FFF2CC', DANGER = 'FCE4E4', CAVEAT = 'EDEDED';
const boxShade = b => b==='DANGER' ? DANGER : (b==='WARNING' ? WARN : (b ? CAVEAT : null));

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'BFBFBF' };
const BORDERS = { top: thin, bottom: thin, left: thin, right: thin,
                  insideHorizontal: thin, insideVertical: thin };

// ---- text helpers -----------------------------------------------------------
/** A run list from the extractor -> docx TextRuns, split on newlines into paragraphs. */
function runsToParagraphs(runs, opts = {}) {
  const paras = []; let cur = [];
  for (const r of runs || []) {
    const pieces = String(r.t).split('\n');
    pieces.forEach((piece, i) => {
      if (i > 0) { paras.push(cur); cur = []; }
      if (piece) cur.push(new TextRun({
        text: piece, bold: !!r.b, italics: !!r.i,
        size: opts.size || 18, font: 'Calibri',
        color: r.url ? '1F4E79' : (opts.color || '000000')
      }));
    });
  }
  paras.push(cur);
  return paras.filter(p => p.length).map(children => new Paragraph({
    children, spacing: { after: 60, line: 240 }, alignment: opts.align
  }));
}

const txt = (text, o = {}) => new Paragraph({
  children: [new TextRun({ text, bold: o.bold, italics: o.italics, size: o.size || 18,
                           font: 'Calibri', color: o.color || '000000' })],
  spacing: { after: o.after === undefined ? 80 : o.after, before: o.before || 0 },
  alignment: o.align, heading: o.heading, pageBreakBefore: o.pageBreakBefore
});

const cell = (children, width, o = {}) => new TableCell({
  children: children.length ? children : [txt('')],
  width: { size: width, type: WidthType.DXA },
  shading: o.shade ? { type: ShadingType.CLEAR, fill: o.shade, color: 'auto' } : undefined,
  columnSpan: o.span, verticalAlign: VerticalAlign.TOP,
  margins: { top: 60, bottom: 60, left: 90, right: 90 }
});

// ---- item numbering ---------------------------------------------------------
const PREFIX = {
  'alcohol-withdrawal-page':'FLOW', 'inpatient-guidelines-page':'INP',
  'ambulatory-guidelines-page':'AMB', 'scales-page':'SCALE', 'screening-page':'SCR',
  'bbv-sti-page':'BBV', 'opioid-withdrawal-page':'OPI', 'benzo-withdrawal-page':'BZD',
  'cannabis-withdrawal-page':'CAN', 'stimulant-withdrawal-page':'STIM',
  'gabapentinoid-withdrawal-page':'GAB', 'ghb-withdrawal-page':'GHB',
  'nicotine-withdrawal-page':'NIC', 'volatile-withdrawal-page':'VOL',
  'populations-page':'POP', 'capacity-page':'CAP', 'continuing-care-page':'CC',
  'contacts-page':'CONTACT', 'criteria-modal':'DX', 'disclaimer-modal':'USE'
};
const counters = {};
function nextRef(pageId) {
  const p = PREFIX[pageId] || 'MISC';
  counters[p] = (counters[p] || 0) + 1;
  return `${p}-${String(counters[p]).padStart(3,'0')}`;
}

// ---- review table rows ------------------------------------------------------
function headerRow() {
  const h = (t, w) => cell([txt(t, { bold: true, size: 17 })], w, { shade: HEAD });
  return new TableRow({
    tableHeader: true,
    children: [h('Ref', COLS[0]), h('Website text (verbatim)', COLS[1]),
               h('Source cited on site', COLS[2]), h('Accurate?', COLS[3]), h('Comment / correction', COLS[4])]
  });
}

const VERDICT = [txt('☐ Accurate', { size: 17, after: 20 }),
                 txt('☐ Needs change', { size: 17, after: 20 }),
                 txt('☐ Unsure', { size: 17, after: 0 })];

function itemRow(ref, block) {
  const shade = boxShade(block.box);
  const body = [];
  if (block.box) body.push(txt(`[${block.box}]`, { bold: true, size: 16, color: '7F3F00', after: 40 }));
  if (block.kind === 'li') {
    const ps = runsToParagraphs(block.runs);
    ps.forEach(p => body.push(p));
  } else {
    runsToParagraphs(block.runs).forEach(p => body.push(p));
  }
  const src = (block.cites || []).length
    ? (block.cites || []).map(c => txt(c, { size: 16 }))
    : [txt('— none cited —', { size: 16, italics: true, color: '808080' })];
  return new TableRow({ children: [
    cell([txt(ref, { bold: true, size: 16 })], COLS[0], { shade: shade || GREY }),
    cell(body, COLS[1], { shade }),
    cell(src, COLS[2], { shade }),
    cell(VERDICT.map(p => new Paragraph({ ...p })), COLS[3]),
    cell([txt('')], COLS[4])
  ]});
}

// Rebuild verdict paragraphs fresh each time (docx nodes are not reusable).
function verdictCell() {
  return cell([txt('☐ Accurate', { size: 17, after: 20 }),
               txt('☐ Needs change', { size: 17, after: 20 }),
               txt('☐ Unsure', { size: 17, after: 0 })], COLS[3]);
}
function itemRow2(ref, block) {
  const shade = boxShade(block.box);
  const body = [];
  if (block.box) body.push(txt(`[${block.box}]`, { bold: true, size: 16, color: '7F3F00', after: 40 }));
  const bullet = block.kind === 'li';
  runsToParagraphs(block.runs).forEach((p, i) => {
    if (bullet && i === 0) body.push(new Paragraph({ children: [new TextRun({ text: '• ', size: 18, font: 'Calibri' }), ...p.root.slice(1)], spacing: { after: 60 } }));
    else body.push(p);
  });
  const src = (block.cites || []).length
    ? block.cites.map(c => txt(c, { size: 16 }))
    : [txt('—', { size: 16, color: '808080' })];
  return new TableRow({ children: [
    cell([txt(ref, { bold: true, size: 16 })], COLS[0], { shade: shade || GREY }),
    cell(body, COLS[1], { shade }),
    cell(src, COLS[2], { shade }),
    verdictCell(),
    cell([], COLS[4])
  ]});
}

// ---- content tables (tables that appear on the site) ------------------------
function siteTable(ref, block) {
  const rows = block.rows;
  const ncol = Math.max(...rows.map(r => r.length));
  const inner = Math.round((COLS[1] + COLS[2]) / ncol);
  const widths = Array(ncol).fill(inner);
  widths[ncol-1] = (COLS[1] + COLS[2]) - inner * (ncol - 1);
  const trs = rows.map(r => new TableRow({
    children: Array.from({ length: ncol }, (_, i) => {
      const c = r[i];
      if (!c) return cell([], widths[i]);
      const ps = runsToParagraphs(c.runs, { size: 17 });
      if ((c.cites || []).length) ps.push(txt(c.cites.join('; '), { size: 15, italics: true, color: '555555' }));
      return cell(ps, widths[i], { shade: c.header ? HEAD : undefined });
    })
  }));
  const tbl = new Table({ rows: trs, columnWidths: widths,
                          width: { size: COLS[1] + COLS[2], type: WidthType.DXA }, borders: BORDERS });
  const capPara = block.caption
    ? [txt(String(block.caption), { bold: true, size: 18, after: 60 })] : [];
  return new TableRow({ children: [
    cell([txt(ref, { bold: true, size: 16 }), txt('table', { size: 15, italics: true, color: '808080' })], COLS[0], { shade: GREY }),
    new TableCell({ children: [...capPara, tbl], columnSpan: 2,
                    width: { size: COLS[1] + COLS[2], type: WidthType.DXA },
                    margins: { top: 60, bottom: 60, left: 90, right: 90 } }),
    verdictCell(),
    cell([], COLS[4])
  ]});
}

// ---- assemble ---------------------------------------------------------------
const PAGE_ORDER = ['alcohol-withdrawal-page','inpatient-guidelines-page','ambulatory-guidelines-page',
  'scales-page','screening-page','bbv-sti-page','opioid-withdrawal-page','benzo-withdrawal-page',
  'cannabis-withdrawal-page','stimulant-withdrawal-page','gabapentinoid-withdrawal-page',
  'ghb-withdrawal-page','nicotine-withdrawal-page','volatile-withdrawal-page','populations-page',
  'capacity-page','continuing-care-page','contacts-page'];
const APPENDIX = ['criteria-modal','disclaimer-modal'];

const byId = {};
for (const p of htmlPages) byId[p.page_id] = p;
const genByPage = {};
for (const g of generated) (genByPage[g.page_id] ||= []).push(g);

const PAGE_TITLES = {
  'alcohol-withdrawal-page':'Alcohol Withdrawal Decision Flowchart',
  'criteria-modal':'Appendix A — Diagnostic criteria pop-up',
  'disclaimer-modal':'Appendix B — Intended-use and terms gate'
};

const body = [];

function emitBlocks(pageId, blocks, out) {
  let rows = [];
  const flush = () => {
    if (rows.length) {
      out.push(new Table({ rows: [headerRow(), ...rows], columnWidths: COLS,
                           width: { size: USABLE, type: WidthType.DXA }, borders: BORDERS }));
      out.push(txt('', { after: 120 }));
      rows = [];
    }
  };
  for (const b of blocks) {
    if (b.kind === 'heading') {
      flush();
      const lvl = Math.min(6, (b.level || 4));
      const t = (b.runs || []).map(r => r.t).join('').trim();
      if (!t) continue;
      out.push(txt(t, { bold: true, size: lvl <= 3 ? 24 : (lvl === 4 ? 21 : (lvl === 5 ? 19 : 18)),
                        before: 200, after: 100, color: '1F3864',
                        heading: lvl <= 4 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4 }));
    } else if (b.kind === 'table') {
      rows.push(siteTable(nextRef(pageId), b));
    } else {
      if (!(b.runs || []).length && (b.cites || []).length) {
        rows.push(itemRow2(nextRef(pageId), { ...b, runs: [{ t: '(source note attached to the block above)', b: false, i: true }] }));
      } else if ((b.runs || []).length) {
        rows.push(itemRow2(nextRef(pageId), b));
      }
    }
  }
  flush();
}

function emitPage(pageId, first) {
  const stat = byId[pageId];
  const gens = genByPage[pageId] || [];
  if (!stat && !gens.length) return;
  const title = PAGE_TITLES[pageId] || (stat && stat.title) || pageId;
  body.push(txt(title, { heading: HeadingLevel.HEADING_1, bold: true, size: 30,
                         color: '1F3864', before: 0, after: 60, pageBreakBefore: !first }));
  const m = meta[pageId];
  if (m) {
    body.push(txt(`Source cited for this page: ${m.source}`, { size: 17, italics: true, color: '555555', after: 20 }));
    body.push(txt(`Last reviewed by author: ${m.lastReviewed} | Independent clinical review: not yet completed`,
                  { size: 17, italics: true, color: '555555', after: 140 }));
  }
  const used = new Set();
  if (stat) {
    for (const s of stat.sections) {
      const attached = gens.filter(g => g.attach_to && s.tab && g.attach_to === s.tab);
      if (s.tab) body.push(txt(s.tab, { heading: HeadingLevel.HEADING_2, bold: true, size: 25,
                                        color: '2E5496', before: 200, after: 100 }));
      emitBlocks(pageId, s.blocks, body);
      for (const g of attached) {
        used.add(g);
        body.push(txt(g.title, { heading: HeadingLevel.HEADING_2, bold: true, size: 23,
                                 color: '2E5496', before: 180, after: 100 }));
        emitBlocks(pageId, g.blocks, body);
      }
    }
  }
  for (const g of gens) {
    if (used.has(g)) continue;
    body.push(txt(g.title, { heading: HeadingLevel.HEADING_2, bold: true, size: 25,
                             color: '2E5496', before: 200, after: 100 }));
    emitBlocks(pageId, g.blocks, body);
  }
}

// ---- front matter -----------------------------------------------------------
body.push(txt('Substance Use Disorder (SUD) Toolkit', { bold: true, size: 40, color: '1F3864', align: AlignmentType.CENTER, after: 60 }));
body.push(txt('Full website text for clinical accuracy review', { size: 30, color: '2E5496', align: AlignmentType.CENTER, after: 240 }));
body.push(txt(`Version ${INFO.version}  —  commit ${INFO.commit}  —  content as at ${INFO.date}`, { size: 20, align: AlignmentType.CENTER, after: 40 }));
body.push(txt(`Document generated ${INFO.generated}  —  ${INFO.site}`, { size: 20, align: AlignmentType.CENTER, after: 300 }));

body.push(txt('What this document is', { bold: true, size: 24, color: '1F3864', before: 200, after: 80 }));
body.push(txt('This is the complete clinical text of the SUD Toolkit website, reproduced word for word, so that it can be checked for clinical accuracy away from the app. Nothing has been paraphrased, shortened or rewritten. Where the site sets words in bold, they are bold here.', { size: 19, after: 80 }));
body.push(txt('The site builds much of its content at run time from data files rather than storing it as fixed pages — every dosing schedule, every calculator item, every flowchart branch. Those have been expanded in full, so that combinations a reader would only reach by clicking through the app appear here as plain text. Sections marked "(generated by the app)" are that expanded content.', { size: 19, after: 80 }));

body.push(txt('How to review it', { bold: true, size: 24, color: '1F3864', before: 200, after: 80 }));
[
 ['Every item has a permanent reference number', 'such as INP-014 or SCALE-032. Quote that number in any correspondence and the exact statement is unambiguous, even after the site changes.'],
 ['Tick one box per item', 'in the "Accurate?" column: Accurate, Needs change, or Unsure. An item left untouched is read as "not yet reviewed", not as "accurate".'],
 ['Put the correction in the Comment column', 'wherever you tick Needs change — the wording you would use, or the reason it is wrong. Tracked changes and Word comments are equally welcome if you prefer them.'],
 ['Check the cited source', 'shown in the "Source cited on site" column. Items reading "—" make a clinical claim with no source named on the site: those are worth particular attention.'],
 ['Flag anything unsafe immediately', 'rather than waiting until the review is finished. Doses, thresholds, routes and maximums matter most.']
].forEach(([b, rest]) => body.push(new Paragraph({
  children: [new TextRun({ text: '•  ', size: 19, font: 'Calibri' }),
             new TextRun({ text: b + ' ', bold: true, size: 19, font: 'Calibri' }),
             new TextRun({ text: rest, size: 19, font: 'Calibri' })],
  spacing: { after: 70 }, indent: { left: 200 }
})));

body.push(txt('Colour coding follows the site', { bold: true, size: 24, color: '1F3864', before: 200, after: 80 }));
body.push(txt('Items the site presents inside a coloured callout are shaded the same way here: [DANGER] red, [WARNING] amber, [CAVEAT] grey. The label is part of how the statement is presented to a clinician, so it is part of what is being reviewed.', { size: 19, after: 80 }));

body.push(txt('What is included, and what is not', { bold: true, size: 24, color: '1F3864', before: 200, after: 80 }));
body.push(txt('Included: every clinical page of the site — the alcohol decision flowchart, inpatient and ambulatory alcohol withdrawal, all eight other-substance pages, the scales and calculators, screening, BBV/STI actions, specific populations, capacity and consent, continuing care, and the contacts list. Two non-clinical pop-ups are included as appendices because they make clinical claims: the diagnostic-criteria pop-up and the intended-use gate.', { size: 19, after: 80 }));
body.push(txt('Excluded: navigation and interface wording with no clinical content — button labels, menu items, the About, Sources & Attribution, Contributors and Changelog pages, and error messages.', { size: 19, after: 80 }));
body.push(txt('No section of this site has completed independent clinical review. That is what this document exists to change.', { size: 19, bold: true, after: 80 }));

body.push(new Paragraph({ children: [new PageBreak()] }));
body.push(txt('Contents', { heading: HeadingLevel.HEADING_1, bold: true, size: 30, color: '1F3864', after: 120 }));
body.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));
body.push(new Paragraph({ children: [new PageBreak()] }));

// ---- body -------------------------------------------------------------------
PAGE_ORDER.forEach((p, i) => emitPage(p, i === 0));
APPENDIX.forEach(p => emitPage(p, false));

// ---- appendix C: review register -------------------------------------------
body.push(txt('Appendix C — Review register recorded in the app', { heading: HeadingLevel.HEADING_1, bold: true, size: 30, color: '1F3864', pageBreakBefore: true, after: 80 }));
body.push(txt('The dates the app itself displays in each page footer. "Reviewer" is empty for every section: authored, not independently reviewed.', { size: 19, after: 120 }));
{
  const w = [5200, 7400, 2798];
  const rows = [new TableRow({ tableHeader: true, children: [
    cell([txt('Section', { bold: true, size: 18 })], w[0], { shade: HEAD }),
    cell([txt('Source cited', { bold: true, size: 18 })], w[1], { shade: HEAD }),
    cell([txt('Last reviewed', { bold: true, size: 18 })], w[2], { shade: HEAD })]})];
  for (const [k, v] of Object.entries(meta)) {
    rows.push(new TableRow({ children: [
      cell([txt(k, { size: 17 })], w[0]),
      cell([txt(String(v.source || '—'), { size: 17 })], w[1]),
      cell([txt(String(v.lastReviewed || '—'), { size: 17 })], w[2])]}));
  }
  body.push(new Table({ rows, columnWidths: w, width: { size: USABLE, type: WidthType.DXA }, borders: BORDERS }));
}

// ---- sign-off ---------------------------------------------------------------
body.push(txt('Reviewer sign-off', { heading: HeadingLevel.HEADING_1, bold: true, size: 30, color: '1F3864', pageBreakBefore: true, after: 120 }));
{
  const w = [3400, 3400, 2600, 2600, 3398];
  const hdr = ['Reviewer name', 'Position and qualification', 'Sections reviewed', 'Date', 'Signature'];
  const rows = [new TableRow({ tableHeader: true, children: hdr.map((h, i) =>
    cell([txt(h, { bold: true, size: 18 })], w[i], { shade: HEAD })) })];
  for (let i = 0; i < 6; i++) rows.push(new TableRow({
    height: { value: 700, rule: 'atLeast' },
    children: w.map(width => cell([txt('')], width)) }));
  body.push(new Table({ rows, columnWidths: w, width: { size: USABLE, type: WidthType.DXA }, borders: BORDERS }));
}

const doc = new Document({
  creator: 'SUD Toolkit', title: 'SUD Toolkit — full website text for clinical review',
  description: 'Verbatim clinical text of the SUD Toolkit website, for accuracy review',
  features: { updateFields: true },
  styles: { default: { document: { run: { font: 'Calibri', size: 19 } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
                          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [ new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `SUD Toolkit v${INFO.version} — full website text for clinical review`, size: 16, color: '808080' })] })] }) },
    footers: { default: new Footer({ children: [ new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: '808080' })] })] }) },
    children: body
  }]
});

Packer.toBuffer(doc).then(buf => {
  fs.writeFileSync(process.argv[2] || 'review.docx', buf);
  const total = Object.entries(counters).reduce((a, [, v]) => a + v, 0);
  console.log('items numbered:', total);
  console.log(Object.entries(counters).map(([k, v]) => `${k}=${v}`).join('  '));
  console.log('written:', process.argv[2]);
});
