// Builds the official-looking Hebrew (RTL) PDF of the "return home" package.
// pdfkit has no bidi support, so text is laid out visually here: RTL paragraphs are reversed run by run,
// while LTR runs (digits, ids, latin) keep their order. Two fonts are used because the Heebo "hebrew"
// subset has no digits/parentheses and the "latin" subset has no Hebrew letters.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const FONT_DIR = path.join(__dirname, '..', '..', '..', 'node_modules', '@fontsource', 'heebo', 'files');
const FONTS = {
  hebrew: path.join(FONT_DIR, 'heebo-hebrew-400-normal.woff'),
  latin: path.join(FONT_DIR, 'heebo-latin-400-normal.woff'),
  hebrewBold: path.join(FONT_DIR, 'heebo-hebrew-700-normal.woff'),
  latinBold: path.join(FONT_DIR, 'heebo-latin-700-normal.woff'),
};

const COLORS = { navy: '#1e3a8a', text: '#1f2937', muted: '#6b7280', line: '#d1d5db', band: '#f3f4f6', ok: '#166534', okBg: '#dcfce7' };
const LTR_TOKEN = /([A-Za-z0-9]+(?:[-_./:@][A-Za-z0-9]+)*)/;
const HEBREW_LETTER = /[֐-׿]/;
const MIRROR = { '(': ')', ')': '(', '[': ']', ']': '[', '<': '>', '>': '<' };

// Logical text -> visual runs [{ text, hebrew }] ordered left-to-right on the page.
function visualRuns(text) {
  const pieces = String(text).split(LTR_TOKEN); // odd indexes are LTR tokens (kept as-is)
  // RTL pieces: reverse characters (mirroring brackets) and split by font; then reverse the piece order.
  const groups = [];
  pieces.forEach((piece, i) => {
    if (!piece) return;
    if (i % 2 === 1) { groups.push([{ text: piece, hebrew: false }]); return; }
    const rev = [...piece].reverse().map((c) => MIRROR[c] || c);
    const g = [];
    let cur = null;
    for (const ch of rev) {
      const heb = HEBREW_LETTER.test(ch);
      if (cur && cur.hebrew === heb) cur.text += ch; else { cur = { text: ch, hebrew: heb }; g.push(cur); }
    }
    groups.push(g);
  });
  return groups.reverse().flat();
}

const fontName = (run, bold) => (run.hebrew ? (bold ? 'hebrewBold' : 'hebrew') : (bold ? 'latinBold' : 'latin'));

function measure(doc, text, size, bold) {
  return visualRuns(text).reduce((w, r) => w + doc.font(fontName(r, bold)).fontSize(size).widthOfString(r.text), 0);
}

// Draw one visual line; align 'right' | 'left' | 'center' inside [x, x + width].
function drawLine(doc, text, { x, y, width, size = 12, bold = false, color = COLORS.text, align = 'right' }) {
  const runs = visualRuns(text);
  const total = runs.reduce((w, r) => w + doc.font(fontName(r, bold)).fontSize(size).widthOfString(r.text), 0);
  let cx = align === 'right' ? x + width - total : align === 'center' ? x + (width - total) / 2 : x;
  doc.fillColor(color);
  for (const r of runs) {
    doc.font(fontName(r, bold)).fontSize(size);
    doc.text(r.text, cx, y, { lineBreak: false });
    cx += doc.widthOfString(r.text);
  }
  return total;
}

// Wrap logical text into lines no wider than maxWidth (words are split on spaces).
function wrap(doc, text, maxWidth, size, bold) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && measure(doc, next, size, bold) > maxWidth) { lines.push(cur); cur = w; } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [''];
}

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * data: { buildingId, address, apartmentCount, eligibilityStatus, budgetStatus, rehabilitationStatus, generatedAt }
 * Resolves when the file is fully written.
 */
function build(data, outPath) {
  return new Promise((resolve, reject) => {
    for (const f of Object.values(FONTS)) if (!fs.existsSync(f)) return reject(new Error('Font missing: ' + f + ' (run npm install)'));
    const doc = new PDFDocument({ size: 'A4', margin: 0, info: { Title: 'תיק אכלוס מחדש', Author: 'משרד השיכון' } });
    const out = fs.createWriteStream(outPath);
    out.on('finish', resolve);
    out.on('error', reject);
    doc.on('error', reject);
    doc.pipe(out);
    Object.entries(FONTS).forEach(([k, v]) => doc.registerFont(k, v));

    const W = doc.page.width, M = 50, inner = W - 2 * M;

    // header band
    doc.rect(0, 0, W, 110).fill(COLORS.navy);
    drawLine(doc, 'משרד השיכון', { x: M, y: 24, width: inner, size: 13, color: '#bfdbfe' });
    drawLine(doc, 'תיק אכלוס מחדש', { x: M, y: 46, width: inner, size: 30, bold: true, color: '#ffffff' });
    doc.rect(0, 110, W, 4).fill('#f59e0b');

    // document meta
    drawLine(doc, `מספר מסמך: ${data.buildingId.slice(0, 8).toUpperCase()}`, { x: M, y: 135, width: inner, size: 10, color: COLORS.muted });
    drawLine(doc, `תאריך הפקה: ${fmtDate(data.generatedAt)}`, { x: M, y: 150, width: inner, size: 10, color: COLORS.muted });

    // section title
    drawLine(doc, 'פרטי המבנה', { x: M, y: 185, width: inner, size: 16, bold: true, color: COLORS.navy });
    doc.moveTo(M, 210).lineTo(W - M, 210).lineWidth(1.5).strokeColor(COLORS.navy).stroke();

    // table: label column on the right, value column to its left
    const labelW = 150, valueW = inner - labelW, rowPad = 10, size = 12;
    const rows = [
      ['מזהה מבנה', data.buildingId, 10],
      ['כתובת', data.address, size],
      ['מספר דירות', String(data.apartmentCount), size],
      ['סטטוס זכאות', data.eligibilityStatus, size],
      ['סטטוס תקציב', data.budgetStatus, size],
      ['סטטוס שיקום', data.rehabilitationStatus, size],
    ];
    let y = 222;
    rows.forEach(([label, value, vSize], i) => {
      const lines = wrap(doc, value, valueW - 24, vSize, false);
      const h = Math.max(34, lines.length * (vSize + 5) + 2 * rowPad - 4);
      if (i % 2 === 0) doc.rect(M, y, inner, h).fill(COLORS.band);
      doc.rect(M, y, inner, h).lineWidth(0.5).strokeColor(COLORS.line).stroke();
      doc.moveTo(M + valueW, y).lineTo(M + valueW, y + h).stroke();
      drawLine(doc, label, { x: M + valueW + 8, y: y + (h - 12) / 2 - 1, width: labelW - 18, size: 12, bold: true, color: COLORS.navy });
      lines.forEach((ln, li) => drawLine(doc, ln, { x: M + 8, y: y + rowPad - 2 + li * (vSize + 5), width: valueW - 24, size: vSize }));
      y += h;
    });

    // verdict box
    y += 40;
    doc.roundedRect(M, y, inner, 90, 8).fillAndStroke(COLORS.okBg, COLORS.ok);
    drawLine(doc, 'ניתן לאכלוס מחדש', { x: M, y: y + 28, width: inner, size: 28, bold: true, color: COLORS.ok, align: 'center' });

    // footer
    doc.moveTo(M, 770).lineTo(W - M, 770).lineWidth(0.5).strokeColor(COLORS.line).stroke();
    drawLine(doc, 'מסמך זה הופק אוטומטית על ידי מערכת דיווחי הנזק של משרד השיכון.', { x: M, y: 782, width: inner, size: 9, color: COLORS.muted, align: 'center' });

    doc.end();
  });
}

module.exports = { build };
