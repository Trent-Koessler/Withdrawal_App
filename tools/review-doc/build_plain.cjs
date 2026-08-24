const fs = require('fs');
const path = require('path');
const D = require('docx');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
        WidthType, ShadingType, BorderStyle, AlignmentType, PageOrientation, PageBreak,
        TableOfContents, Header, Footer, PageNumber, VerticalAlign } = D;

const WORK = process.env.WORK_DIR || '.';
const read = n => JSON.parse(fs.readFileSync(path.join(WORK, n), 'utf8'));
const htmlPages = read('html.json');
const generated = read('generated.json');
const meta      = read('data.json').CONTENT_META;
const INFO      = read('info.json');

// ---- page geometry (A4 portrait) -------------------------------------------
const MARGIN = 1134;                       // 2 cm
const USABLE = 11906 - MARGIN * 2;         // 9638 dxa

const INK = '1A1A1A', MUTED = '6B6B6B', NAVY = '1F3864', BLUE = '2E5496';
const WARN_BG = 'FFF6E0', WARN_ED = 'D9A441';
const DANGER_BG = 'FDECEC', DANGER_ED = 'C0504D';
const CAVEAT_BG = 'F2F2F2', CAVEAT_ED = 'A6A6A6';
const HEAD_BG = 'E8EDF6';

const boxStyle = b => b === 'DANGER' ? { bg: DANGER_BG, ed: DANGER_ED }
                  : b === 'WARNING' ? { bg: WARN_BG, ed: WARN_ED }
                  : b ? { bg: CAVEAT_BG, ed: CAVEAT_ED } : null;

const thin = { style: BorderStyle.SINGLE, size: 4, color: 'C9C9C9' };
const BORDERS = { top: thin, bottom: thin, left: thin, right: thin,
                  insideHorizontal: thin, insideVertical: thin };

// ---- text -------------------------------------------------------------------
const BODY = 21;   // half-points -> 10.5pt

/** Runs from the extractor -> paragraphs, splitting on newlines. */
function toParagraphs(runs, o = {}) {
  const paras = []; let cur = [];
  for (const r of runs || []) {
    String(r.t).split('\n').forEach((piece, i) => {
      if (i > 0) { paras.push(cur); cur = []; }
      if (piece) cur.push(new TextRun({
        text: piece, bold: !!r.b, italics: !!r.i,
        size: o.size || BODY, font: 'Calibri',
        color: r.url ? BLUE : (o.color || INK)
      }));
    });
  }
  paras.push(cur);
  return paras.filter(p => p.length);
}

const shadeOf = box => {
  const s = boxStyle(box);
  return s ? { type: ShadingType.CLEAR, fill: s.bg, color: 'auto' } : undefined;
};
const bordersOf = box => {
  const s = boxStyle(box);
  return s ? { left: { style: BorderStyle.SINGLE, size: 18, color: s.ed, space: 8 } } : undefined;
};

/** One content block -> flowing paragraphs. Citations trail the last line. */
function blockParagraphs(block, opts = {}) {
  const out = [];
  const box = block.box;
  const groups = toParagraphs(block.runs, opts);
  const bullet = block.kind === 'li';

  if (box) {
    out.push(new Paragraph({
      children: [new TextRun({ text: box, bold: true, size: 16, font: 'Calibri',
                               color: boxStyle(box).ed, characterSpacing: 20 })],
      shading: shadeOf(box), border: bordersOf(box),
      spacing: { before: 140, after: 0 }, indent: { left: 170, right: 170 }
    }));
  }

  groups.forEach((children, i) => {
    const last = i === groups.length - 1;
    const kids = [...children];
    if (last && (block.cites || []).length) {
      kids.push(new TextRun({ text: '  ' + block.cites.join('  '), size: 16,
                              italics: true, font: 'Calibri', color: MUTED }));
    }
    out.push(new Paragraph({
      children: bullet && i === 0
        ? [new TextRun({ text: '• ', size: BODY, font: 'Calibri', color: MUTED }), ...kids]
        : kids,
      shading: shadeOf(box), border: box ? bordersOf(box) : undefined,
      spacing: { before: box && i === 0 ? 0 : (bullet ? 40 : 90),
                 after: box && last ? 140 : (bullet ? 40 : 90), line: 265 },
      indent: box ? { left: 170, right: 170 }
            : (bullet ? { left: 340, hanging: 200 } : undefined)
    }));
  });
  return out;
}

/** A table that appears on the site stays a table. */
function contentTable(block) {
  const out = [];
  if (block.caption) {
    out.push(new Paragraph({
      children: [new TextRun({ text: String(block.caption), bold: true, size: 19, font: 'Calibri', color: NAVY })],
      spacing: { before: 160, after: 60 }, keepNext: true
    }));
  }
  const rows = block.rows;
  const ncol = Math.max(...rows.map(r => r.length));
  const w = Array(ncol).fill(Math.floor(USABLE / ncol));
  w[ncol - 1] = USABLE - w[0] * (ncol - 1);
  const trs = rows.map((r, ri) => new TableRow({
    tableHeader: ri === 0 && r.every(c => c.header),
    children: Array.from({ length: ncol }, (_, i) => {
      const c = r[i];
      const kids = c ? toParagraphs(c.runs, { size: 19 }).map(children => new Paragraph({
        children, spacing: { before: 40, after: 40, line: 250 }
      })) : [];
      if (c && (c.cites || []).length) kids.push(new Paragraph({
        children: [new TextRun({ text: c.cites.join('  '), size: 15, italics: true, font: 'Calibri', color: MUTED })],
        spacing: { after: 40 }
      }));
      return new TableCell({
        children: kids.length ? kids : [new Paragraph({ children: [] })],
        width: { size: w[i], type: WidthType.DXA },
        shading: c && c.header ? { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' } : undefined,
        verticalAlign: VerticalAlign.TOP,
        margins: { top: 70, bottom: 70, left: 110, right: 110 }
      });
    })
  }));
  out.push(new Table({ rows: trs, columnWidths: w,
                       width: { size: USABLE, type: WidthType.DXA }, borders: BORDERS }));
  out.push(new Paragraph({ children: [], spacing: { after: 140 } }));
  return out;
}

const heading = (text, level, o = {}) => new Paragraph({
  children: [new TextRun({ text, bold: true, size: o.size, font: 'Calibri', color: o.color || NAVY })],
  heading: level, spacing: { before: o.before || 240, after: o.after || 100 },
  pageBreakBefore: o.pageBreakBefore, keepNext: true,
  border: o.rule ? { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C9D3E8', space: 6 } } : undefined
});

const note = (text, o = {}) => new Paragraph({
  children: [new TextRun({ text, size: o.size || 18, italics: o.italics !== false,
                           font: 'Calibri', color: o.color || MUTED, bold: o.bold })],
  spacing: { before: o.before || 0, after: o.after === undefined ? 80 : o.after, line: 250 },
  alignment: o.align
});

// ---- assembly ---------------------------------------------------------------
const PAGE_ORDER = ['alcohol-withdrawal-page','inpatient-guidelines-page','ambulatory-guidelines-page',
  'scales-page','screening-page','bbv-sti-page','opioid-withdrawal-page','benzo-withdrawal-page',
  'cannabis-withdrawal-page','stimulant-withdrawal-page','gabapentinoid-withdrawal-page',
  'ghb-withdrawal-page','nicotine-withdrawal-page','volatile-withdrawal-page','populations-page',
  'capacity-page','continuing-care-page','contacts-page'];
const APPENDIX = ['criteria-modal','disclaimer-modal'];
const PAGE_TITLES = {
  'alcohol-withdrawal-page':'Alcohol Withdrawal Decision Flowchart',
  'criteria-modal':'Appendix A — Diagnostic criteria pop-up',
  'disclaimer-modal':'Appendix B — Intended-use and terms gate'
};

const byId = {}; for (const p of htmlPages) byId[p.page_id] = p;
const genByPage = {}; for (const g of generated) (genByPage[g.page_id] ||= []).push(g);

const body = [];
let counts = { paras: 0, tables: 0 };

function emitBlocks(blocks) {
  for (const b of blocks) {
    if (b.kind === 'heading') {
      const t = (b.runs || []).map(r => r.t).join('').trim();
      if (!t) continue;
      const lvl = b.level || 4;
      body.push(heading(t, lvl <= 4 ? HeadingLevel.HEADING_3 : HeadingLevel.HEADING_4,
                        { size: lvl <= 3 ? 25 : (lvl === 4 ? 23 : 21),
                          color: lvl <= 4 ? NAVY : BLUE, before: 240, after: 90 }));
    } else if (b.kind === 'table') {
      contentTable(b).forEach(x => body.push(x)); counts.tables++;
    } else if ((b.runs || []).length) {
      blockParagraphs(b).forEach(x => body.push(x)); counts.paras++;
    } else if ((b.cites || []).length) {
      body.push(note('Source: ' + b.cites.join('  '), { size: 16 }));
    }
  }
}

function emitPage(pageId, first) {
  const stat = byId[pageId];
  const gens = genByPage[pageId] || [];
  if (!stat && !gens.length) return;
  body.push(heading(PAGE_TITLES[pageId] || (stat && stat.title) || pageId,
                    HeadingLevel.HEADING_1,
                    { size: 34, before: 0, after: 80, pageBreakBefore: !first, rule: true }));
  const m = meta[pageId];
  if (m) {
    body.push(note(`Source cited for this page: ${m.source}`, { size: 17, after: 20 }));
    body.push(note(`Last reviewed by author ${m.lastReviewed} · independent clinical review not yet completed`,
                   { size: 17, after: 180 }));
  }
  const used = new Set();
  if (stat) {
    for (const s of stat.sections) {
      const attached = gens.filter(g => g.attach_to && s.tab && g.attach_to === s.tab);
      if (s.tab) body.push(heading(s.tab, HeadingLevel.HEADING_2, { size: 28, color: BLUE, before: 280, after: 110 }));
      emitBlocks(s.blocks);
      for (const g of attached) {
        used.add(g);
        body.push(heading(g.title, HeadingLevel.HEADING_2, { size: 26, color: BLUE, before: 260, after: 110 }));
        emitBlocks(g.blocks);
      }
    }
  }
  for (const g of gens) {
    if (used.has(g)) continue;
    body.push(heading(g.title, HeadingLevel.HEADING_2, { size: 28, color: BLUE, before: 280, after: 110 }));
    emitBlocks(g.blocks);
  }
}

// ---- front matter -----------------------------------------------------------
body.push(new Paragraph({ children: [], spacing: { after: 1200 } }));
body.push(note('Substance Use Disorder (SUD) Toolkit', { size: 44, bold: true, italics: false, color: NAVY, align: AlignmentType.CENTER, after: 100 }));
body.push(note('The complete text of the website', { size: 28, italics: false, color: BLUE, align: AlignmentType.CENTER, after: 400 }));
body.push(note(`Version ${INFO.version} · commit ${INFO.commit} · content as at ${INFO.date}`, { size: 19, align: AlignmentType.CENTER, after: 40 }));
body.push(note(`Generated ${INFO.generated} · ${INFO.site}`, { size: 19, align: AlignmentType.CENTER, after: 600 }));
body.push(note('This is every word of clinical text on the site, reproduced as it appears there. Nothing has been paraphrased or shortened. Where the site sets words in bold, they are bold here; where it places a statement in a coloured callout, the callout is kept.', { size: 20, italics: false, align: AlignmentType.CENTER, after: 140 }));
body.push(note('Much of the site is assembled as the reader clicks — dosing schedules, calculator items, flowchart branches. Those are written out in full here, so sections headed "(generated by the app)" read as continuous text rather than as screens.', { size: 20, italics: false, align: AlignmentType.CENTER, after: 140 }));
body.push(note('No section has completed independent clinical review.', { size: 20, italics: false, bold: true, align: AlignmentType.CENTER, after: 0 }));

body.push(new Paragraph({ children: [new PageBreak()] }));
body.push(heading('Contents', HeadingLevel.HEADING_1, { size: 32, before: 0, after: 140, rule: true }));
body.push(new TableOfContents('Contents', { hyperlink: true, headingStyleRange: '1-2' }));
body.push(new Paragraph({ children: [new PageBreak()] }));

PAGE_ORDER.forEach((p, i) => emitPage(p, i === 0));
APPENDIX.forEach(p => emitPage(p, false));

// ---- review register --------------------------------------------------------
body.push(heading('Appendix C — Review register recorded in the app', HeadingLevel.HEADING_1,
                  { size: 34, pageBreakBefore: true, after: 80, rule: true }));
body.push(note('The dates the app displays in each page footer. No section records a reviewer: authored, not independently reviewed.', { size: 19, italics: false, after: 160 }));
{
  const w = [3400, 4600, 1638];
  const hdr = ['Section', 'Source cited', 'Last reviewed'];
  const rows = [new TableRow({ tableHeader: true, children: hdr.map((h, i) => new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 19, font: 'Calibri' })] })],
    width: { size: w[i], type: WidthType.DXA },
    shading: { type: ShadingType.CLEAR, fill: HEAD_BG, color: 'auto' },
    margins: { top: 70, bottom: 70, left: 110, right: 110 } })) })];
  for (const [k, v] of Object.entries(meta)) {
    rows.push(new TableRow({ children: [k, String(v.source || '—'), String(v.lastReviewed || '—')].map((t, i) =>
      new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: t, size: 18, font: 'Calibri' })], spacing: { before: 30, after: 30 } })],
        width: { size: w[i], type: WidthType.DXA },
        margins: { top: 70, bottom: 70, left: 110, right: 110 } })) }));
  }
  body.push(new Table({ rows, columnWidths: w, width: { size: USABLE, type: WidthType.DXA }, borders: BORDERS }));
}

const doc = new Document({
  creator: 'SUD Toolkit', title: 'SUD Toolkit — the complete text of the website',
  description: 'The full clinical text of the SUD Toolkit website, as continuous prose',
  features: { updateFields: true },
  styles: { default: { document: { run: { font: 'Calibri', size: BODY, color: INK } } } },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
                          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    headers: { default: new Header({ children: [new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `SUD Toolkit v${INFO.version} — complete website text`, size: 16, color: MUTED })] })] }) },
    footers: { default: new Footer({ children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], size: 16, color: MUTED })] })] }) },
    children: body
  }]
});

Packer.toBuffer(doc).then(buf => {
  const out = process.argv[2] || 'website-text.docx';
  fs.writeFileSync(out, buf);
  console.log(`text blocks: ${counts.paras}   tables kept: ${counts.tables}`);
  console.log('written:', out);
});
