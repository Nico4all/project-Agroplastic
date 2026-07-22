import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import PDFDocument = require('pdfkit');

type TableRow = Array<string | number | null | undefined>;

export type PdfTableColumn = {
  label: string;
  width: number;
  align?: 'left' | 'center' | 'right';
};

export type CashReceiptData = {
  kind: 'income' | 'expense';
  number: string;
  date: string;
  partyLabel: string;
  party: string;
  document?: string;
  amount: number;
  concept: string;
  details: Array<{ label: string; value: string }>;
  paymentMethod?: string;
  preparedBy: string;
  approvedBy?: string;
  status: string;
  voidReason?: string;
};

export type OrderTicketData = {
  number: string;
  date: string;
  clientName: string;
  clientDocument: string;
  userName: string;
  invoiced: boolean;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  total: number;
};

const BRAND_GREEN = '#009846';
const BRAND_DARK = '#096b38';
const PALE_GREEN = '#edf8f2';
const INK = '#17211b';
const MUTED = '#5f6f65';
const LINE = '#cfd9d2';
const DANGER = '#b42318';

let cachedLogo: Buffer | null | undefined;

export function formatMoney(value: number) {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

export function formatDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function buildExcelHtml(title: string, headers: string[], rows: TableRow[]) {
  const tableRows = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? ''))}</td>`).join('')}</tr>`)
    .join('');
  const logo = getLogoBuffer();
  const logoMarkup = logo
    ? `<img src="data:image/png;base64,${logo.toString('base64')}" alt="AgroPlastick" />`
    : '<strong>AgroPlastick</strong>';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body { font-family: Arial, sans-serif; color: #17211b; }
    .brand { margin-bottom: 14px; }
    .brand img { width: 260px; height: auto; }
    h1 { color: #096b38; font-size: 18px; margin: 0 0 14px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #cfd9d2; padding: 6px 8px; font-size: 12px; }
    th { background: #edf8f2; color: #096b38; font-weight: 700; }
  </style>
</head>
<body>
  <div class="brand">${logoMarkup}</div>
  <h1>${escapeHtml(title)}</h1>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
}

export async function buildListPdf(
  title: string,
  summary: Array<{ label: string; value: string }>,
  columns: PdfTableColumn[],
  rows: TableRow[],
) {
  const { doc, done } = createDocument({ size: 'A4', layout: 'landscape', margin: 36, bufferPages: true });
  const left = 36;
  const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
  let y = 0;

  const drawHeader = () => {
    const logo = getLogoBuffer();
    if (logo) doc.image(logo, left, 25, { fit: [235, 58], valign: 'center' });
    else doc.font('Helvetica-Bold').fontSize(24).fillColor(BRAND_GREEN).text('AgroPlastick', left, 38);

    doc
      .font('Helvetica-Bold')
      .fontSize(18)
      .fillColor(BRAND_DARK)
      .text(title, 300, 32, { width: tableWidth - 300, align: 'right' });
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(MUTED)
      .text(`Generado: ${new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`, 300, 57, {
        width: tableWidth - 300,
        align: 'right',
      });
    doc.moveTo(left, 91).lineTo(left + tableWidth, 91).lineWidth(1.2).strokeColor(BRAND_GREEN).stroke();
    y = 104;
  };

  const drawSummary = () => {
    const gap = 10;
    const cardWidth = Math.min(185, (tableWidth - gap * Math.max(0, summary.length - 1)) / Math.max(1, summary.length));
    summary.forEach((item, index) => {
      const x = left + index * (cardWidth + gap);
      doc.roundedRect(x, y, cardWidth, 43, 5).fillAndStroke(PALE_GREEN, '#d9eee2');
      doc.font('Helvetica').fontSize(7.5).fillColor(MUTED).text(item.label.toUpperCase(), x + 10, y + 8, { width: cardWidth - 20 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND_DARK).text(item.value, x + 10, y + 21, { width: cardWidth - 20 });
    });
    y += 55;
  };

  const drawTableHeader = () => {
    let x = left;
    columns.forEach((column) => {
      doc.rect(x, y, column.width, 24).fillAndStroke(BRAND_DARK, BRAND_DARK);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor('#ffffff').text(column.label, x + 5, y + 8, {
        width: column.width - 10,
        align: column.align || 'left',
        lineBreak: false,
      });
      x += column.width;
    });
    y += 24;
  };

  const addPage = () => {
    doc.addPage();
    drawHeader();
    drawTableHeader();
  };

  drawHeader();
  drawSummary();
  drawTableHeader();

  if (!rows.length) {
    doc.rect(left, y, tableWidth, 42).strokeColor(LINE).stroke();
    doc.font('Helvetica-Oblique').fontSize(10).fillColor(MUTED).text('No hay registros para los filtros seleccionados.', left, y + 15, {
      width: tableWidth,
      align: 'center',
    });
  }

  rows.forEach((row, rowIndex) => {
    // heightOfString uses the current cursor position internally. Keep it away
    // from the page footer so measuring a row can never create an extra page.
    doc.x = 0;
    doc.y = 0;
    const cellHeights = columns.map((column, columnIndex) =>
      doc.font('Helvetica').fontSize(7.5).heightOfString(String(row[columnIndex] ?? ''), {
        width: column.width - 10,
        align: column.align || 'left',
      }),
    );
    const rowHeight = Math.max(24, Math.max(...cellHeights) + 10);
    if (y + rowHeight > doc.page.height - 58) addPage();

    let x = left;
    columns.forEach((column, columnIndex) => {
      if (rowIndex % 2 === 1) doc.rect(x, y, column.width, rowHeight).fill('#f8fbf9');
      doc.rect(x, y, column.width, rowHeight).lineWidth(0.5).strokeColor(LINE).stroke();
      doc.font('Helvetica').fontSize(7.5).fillColor(INK).text(String(row[columnIndex] ?? ''), x + 5, y + 6, {
        width: column.width - 10,
        height: rowHeight - 8,
        align: column.align || 'left',
        ellipsis: true,
      });
      x += column.width;
    });
    y += rowHeight;
  });

  addPageNumbers(doc);
  doc.end();
  return done;
}

export async function buildCashReceiptPdf(data: CashReceiptData) {
  const { doc, done } = createDocument({ size: [595.28, 419.53], margin: 24, bufferPages: true });
  const width = doc.page.width - 48;
  const left = 24;
  const receiptTitle = data.kind === 'income' ? 'RECIBO DE INGRESO' : 'RECIBO DE EGRESO';
  const partyAccent = data.kind === 'income' ? BRAND_GREEN : '#b7791f';
  const logo = getLogoBuffer();

  doc.roundedRect(14, 14, doc.page.width - 28, doc.page.height - 28, 8).lineWidth(1).strokeColor('#9eaaa2').stroke();
  if (logo) doc.image(logo, left, 24, { fit: [238, 61], valign: 'center' });
  else doc.font('Helvetica-Bold').fontSize(25).fillColor(BRAND_GREEN).text('AgroPlastick', left, 37);

  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(receiptTitle, 355, 30, { width: 190, align: 'right' });
  doc.font('Helvetica-Bold').fontSize(19).fillColor(partyAccent).text(data.number, 355, 48, { width: 190, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`Fecha: ${data.date}`, 355, 72, { width: 190, align: 'right' });
  doc.moveTo(left, 92).lineTo(left + width, 92).lineWidth(1.2).strokeColor(partyAccent).stroke();

  labeledValue(doc, data.partyLabel, data.party, left, 106, 335);
  labeledValue(doc, 'Documento', data.document || '-', 375, 106, 172);

  doc.roundedRect(left, 151, width, 48, 5).fillAndStroke(PALE_GREEN, '#d9eee2');
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('VALOR', left + 12, 161);
  doc.font('Helvetica-Bold').fontSize(22).fillColor(BRAND_DARK).text(formatMoney(data.amount), left + 12, 174, { width: 225 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('CONCEPTO', 270, 161);
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(data.concept || '-', 270, 174, { width: 265, height: 20, ellipsis: true });

  let detailX = left;
  const detailWidth = width / Math.max(1, data.details.length);
  data.details.forEach((detail) => {
    labeledValue(doc, detail.label, detail.value || '-', detailX, 215, detailWidth - 8);
    detailX += detailWidth;
  });

  if (data.paymentMethod) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('FORMA DE PAGO', left, 266);
    const isCash = data.paymentMethod.toLowerCase().includes('efectivo');
    checkOption(doc, 'Efectivo', isCash, left, 281);
    checkOption(doc, 'Banco', !isCash, left + 94, 281);
  }

  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(`ESTADO: ${data.status.toUpperCase()}`, 390, 270, { width: 157, align: 'right' });
  signature(doc, 'Elaborado por', data.preparedBy, left, 333, 225);
  signature(doc, data.kind === 'income' ? 'Recibido de / firma' : 'Aprobado por', data.approvedBy || '', 322, 333, 225);

  if (data.voidReason) {
    doc.save();
    doc.rotate(-18, { origin: [doc.page.width / 2, doc.page.height / 2] });
    doc.font('Helvetica-Bold').fontSize(60).fillColor(DANGER).opacity(0.16).text('ANULADO', 120, 185, { width: 360, align: 'center' });
    doc.restore();
    doc.opacity(1).font('Helvetica').fontSize(7).fillColor(DANGER).text(`Motivo: ${data.voidReason}`, left, 391, { width, align: 'center' });
  }

  doc.end();
  return done;
}

export async function buildOrderTicketPdf(data: OrderTicketData) {
  const pageWidth = 226.77;
  const itemHeight = data.items.reduce((sum, item) => sum + 35 + Math.max(0, Math.ceil(item.description.length / 31) - 1) * 9, 0);
  const pageHeight = Math.max(470, 330 + itemHeight);
  const { doc, done } = createDocument({ size: [pageWidth, pageHeight], margin: 16 });
  const contentWidth = pageWidth - 32;
  const logo = getLogoBuffer();

  if (logo) doc.image(logo, 16, 16, { fit: [contentWidth, 66], align: 'center', valign: 'center' });
  else doc.font('Helvetica-Bold').fontSize(20).fillColor(BRAND_GREEN).text('AgroPlastick', 16, 30, { width: contentWidth, align: 'center' });
  let y = 91;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(INK).text('PEDIDO', 16, y, { width: contentWidth, align: 'center' });
  y += 18;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(BRAND_DARK).text(data.number, 16, y, { width: contentWidth, align: 'center' });
  y += 25;
  ticketPair(doc, 'Fecha', data.date, y, contentWidth);
  y += 15;
  ticketPair(doc, 'Cliente', data.clientName, y, contentWidth);
  y += Math.max(18, doc.heightOfString(data.clientName, { width: 124 }));
  ticketPair(doc, 'Documento', data.clientDocument, y, contentWidth);
  y += 19;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text('PRODUCTOS', 16, y);
  y += 16;
  data.items.forEach((item) => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(item.description, 16, y, { width: contentWidth });
    y += doc.heightOfString(item.description, { width: contentWidth }) + 3;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${formatQuantity(item.quantity)} x ${formatMoney(item.unitPrice)}`, 16, y, { width: 112 });
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(INK).text(formatMoney(item.lineTotal), 128, y, { width: 82, align: 'right' });
    y += 19;
  });

  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('TOTAL', 16, y);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(BRAND_DARK).text(formatMoney(data.total), 80, y - 2, { width: 130, align: 'right' });
  y += 28;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 13;

  ticketPair(doc, 'Estado', data.invoiced ? 'Facturado' : 'Pendiente', y, contentWidth);
  y += 16;
  ticketPair(doc, 'Atendido por', data.userName, y, contentWidth);
  y += Math.max(20, doc.heightOfString(data.userName, { width: 124 }));
  doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND_DARK).text('Gracias por su pedido', 16, y + 10, { width: contentWidth, align: 'center' });
  doc.font('Helvetica').fontSize(7).fillColor(MUTED).text('Empaques, amarres y proteccion para el agro', 16, y + 26, {
    width: contentWidth,
    align: 'center',
  });

  doc.end();
  return done;
}

function createDocument(options: Record<string, unknown>) {
  const doc = new PDFDocument({ autoFirstPage: true, info: { Producer: 'AgroPlastick' }, ...options });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  return { doc, done };
}

function addPageNumbers(doc: any) {
  const range = doc.bufferedPageRange();
  for (let pageIndex = range.start; pageIndex < range.start + range.count; pageIndex += 1) {
    doc.switchToPage(pageIndex);
    doc.font('Helvetica').fontSize(7).fillColor(MUTED).text(`Pagina ${pageIndex + 1} de ${range.count}`, 36, doc.page.height - 48, {
      width: doc.page.width - 72,
      align: 'right',
      lineBreak: false,
    });
  }
}

function labeledValue(doc: any, label: string, value: string, x: number, y: number, width: number) {
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, y, { width });
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(value || '-', x, y + 13, { width, height: 19, ellipsis: true });
  doc.moveTo(x, y + 35).lineTo(x + width, y + 35).lineWidth(0.6).strokeColor(LINE).stroke();
}

function checkOption(doc: any, label: string, checked: boolean, x: number, y: number) {
  doc.rect(x, y, 11, 11).lineWidth(0.7).strokeColor(MUTED).stroke();
  if (checked) {
    doc.moveTo(x + 2, y + 6).lineTo(x + 5, y + 9).lineTo(x + 10, y + 2).lineWidth(1.5).strokeColor(BRAND_GREEN).stroke();
  }
  doc.font('Helvetica').fontSize(8).fillColor(INK).text(label, x + 16, y + 2);
}

function signature(doc: any, label: string, value: string, x: number, y: number, width: number) {
  doc.moveTo(x, y).lineTo(x + width, y).lineWidth(0.7).strokeColor('#7d8981').stroke();
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(MUTED).text(label.toUpperCase(), x, y + 7, { width, align: 'center' });
  if (value) doc.font('Helvetica').fontSize(8).fillColor(INK).text(value, x, y - 14, { width, align: 'center', ellipsis: true });
}

function ticketPair(doc: any, label: string, value: string, y: number, contentWidth: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(MUTED).text(label, 16, y, { width: 65 });
  doc.font('Helvetica').fontSize(8).fillColor(INK).text(value || '-', 82, y, { width: contentWidth - 66, align: 'right' });
}

function dashedLine(doc: any, y: number, start: number, end: number) {
  doc.moveTo(start, y).lineTo(end, y).dash(3, { space: 3 }).lineWidth(0.6).strokeColor('#8f9b93').stroke().undash();
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 }).format(value);
}

function getLogoBuffer() {
  if (cachedLogo !== undefined) return cachedLogo;
  const filename = join('public', 'brand', 'agroplastic-logo.png');
  const candidates = [
    join(process.cwd(), filename),
    join(process.cwd(), 'backend', filename),
    join(__dirname, '..', '..', '..', filename),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  cachedLogo = logoPath ? readFileSync(logoPath) : null;
  return cachedLogo;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
