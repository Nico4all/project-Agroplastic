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
  voidReason?: string;
};

export type OrderTicketData = {
  number: string;
  date: string;
  clientName: string;
  clientDocument: string;
  deliveryAddress: string;
  clientPhone: string;
  paymentMethod: string;
  observations: string;
  userName: string;
  invoiced: boolean;
  voided: boolean;
  voidReason?: string;
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
const THERMAL_INK = '#000000';

let cachedLogo: Buffer | null | undefined;
let cachedThermalLogo: Buffer | null | undefined;

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
  const pageWidth = 226.77;
  const layout = measureCashReceipt(data, pageWidth);
  const { doc, done } = createDocument({ size: [pageWidth, layout.pageHeight], margin: 0 });
  const left = 16;
  const width = pageWidth - 32;
  const receiptTitle = data.kind === 'income' ? 'RECIBO DE INGRESO' : 'RECIBO DE EGRESO';
  const logo = getThermalLogoBuffer();

  if (logo) doc.image(logo, left, 16, { fit: [width, 66], align: 'center', valign: 'center' });
  else doc.font('Helvetica-Bold').fontSize(20).fillColor(THERMAL_INK).text('AgroPlastick', left, 30, { width, align: 'center' });
  let y = 91;
  dashedLine(doc, y, left, pageWidth - left);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(THERMAL_INK).text(receiptTitle, left, y, { width, align: 'center' });
  y += 18;
  doc.font('Helvetica-Bold').fontSize(16).fillColor(THERMAL_INK).text(data.number, left, y, { width, align: 'center' });
  y += 25;
  ticketPair(doc, 'Fecha', data.date, y, width);
  y += 15;
  dashedLine(doc, y, left, pageWidth - left);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(data.partyLabel.toUpperCase(), left, y, { width });
  y += 11;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(THERMAL_INK).text(data.party, left, y, { width });
  y += layout.partyHeight + 5;
  if (data.document) {
    ticketPair(doc, 'Documento', data.document, y, width);
    y += layout.documentHeight;
  }
  dashedLine(doc, y, left, pageWidth - left);
  y += 12;

  doc.roundedRect(left, y, width, 58, 5).lineWidth(1).fillAndStroke('#ffffff', THERMAL_INK);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text('VALOR', left + 10, y + 9, { width: width - 20, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(20).fillColor(THERMAL_INK).text(formatMoney(data.amount), left + 6, y + 25, {
    width: width - 12,
    align: 'center',
  });
  y += 70;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text('CONCEPTO', left, y, { width });
  y += 12;
  doc.roundedRect(left, y, width, layout.conceptHeight + 10, 3).lineWidth(0.8).fillAndStroke('#ffffff', THERMAL_INK);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(data.concept || '-', left + 5, y + 5, {
    width: width - 10,
    height: layout.conceptHeight,
  });
  y += layout.conceptHeight + 22;

  data.details.forEach((detail, index) => {
    ticketPair(doc, detail.label, detail.value || '-', y, width);
    y += layout.detailHeights[index];
  });
  if (data.paymentMethod) {
    ticketPair(doc, 'Forma de pago', data.paymentMethod, y, width);
    y += layout.paymentHeight;
  }

  if (data.voidReason) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(DANGER).text('MOTIVO DE ANULACION', left, y, { width });
    y += 12;
    doc.roundedRect(left, y, width, layout.voidReasonHeight + 10, 3).fillAndStroke('#fff1f0', '#f5b7b1');
    doc.font('Helvetica').fontSize(8).fillColor(DANGER).text(data.voidReason, left + 5, y + 5, {
      width: width - 10,
      height: layout.voidReasonHeight,
    });
    y += layout.voidReasonHeight + 22;
  }

  dashedLine(doc, y, left, pageWidth - left);
  y += 12;
  ticketPair(doc, 'Elaborado por', data.preparedBy, y, width);
  y += layout.preparedHeight + 27;
  doc.moveTo(left, y).lineTo(pageWidth - left, y).lineWidth(1).strokeColor(THERMAL_INK).stroke();
  doc
    .font('Helvetica-Bold')
    .fontSize(7.5)
    .fillColor(THERMAL_INK)
    .text(data.kind === 'income' ? 'RECIBIDO DE / FIRMA' : 'APROBADO POR', left, y + 7, { width, align: 'center' });
  if (data.approvedBy) {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(data.approvedBy, left, y - 14, { width, align: 'center' });
  }
  y += 35;
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(THERMAL_INK).text('AgroPlastick', left, y + 8, { width, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).fillColor(THERMAL_INK).text('Empaques, amarres y proteccion para el agro', left, y + 22, {
    width,
    align: 'center',
  });

  if (data.voidReason) {
    doc.save();
    doc.rotate(-22, { origin: [pageWidth / 2, layout.pageHeight / 2] });
    doc.font('Helvetica-Bold').fontSize(38).fillColor(DANGER).opacity(0.14).text('ANULADO', 16, layout.pageHeight / 2 - 20, {
      width: pageWidth - 32,
      align: 'center',
      lineBreak: false,
    });
    doc.restore();
    doc.opacity(1);
  }

  doc.end();
  return done;
}

function measureCashReceipt(data: CashReceiptData, pageWidth: number) {
  const width = pageWidth - 32;
  const valueWidth = width - 66;
  const measureDoc = new PDFDocument({ size: [pageWidth, 14400], margin: 0 });
  measureDoc.on('data', () => undefined);
  measureDoc.font('Helvetica').fontSize(8);

  const pairHeight = (value: string) => Math.max(15, measureDoc.heightOfString(value || '-', { width: valueWidth }));
  const partyHeight = Math.max(11, measureDoc.font('Helvetica-Bold').fontSize(9).heightOfString(data.party, { width }));
  const documentHeight = data.document ? pairHeight(data.document) : 0;
  const conceptHeight = Math.max(
    10,
    measureDoc.font('Helvetica-Bold').fontSize(8).heightOfString(data.concept || '-', { width: width - 10 }),
  );
  const detailHeights = data.details.map((detail) => pairHeight(detail.value || '-'));
  const paymentHeight = data.paymentMethod ? pairHeight(data.paymentMethod) : 0;
  const preparedHeight = pairHeight(data.preparedBy);
  const voidReasonHeight = data.voidReason
    ? Math.max(10, measureDoc.heightOfString(data.voidReason, { width: width - 10 }))
    : 0;

  let y = 91 + 12 + 18 + 25 + 15 + 12;
  y += 11 + partyHeight + 5;
  y += documentHeight;
  y += 12;
  y += 70;
  y += 12 + conceptHeight + 22;
  detailHeights.forEach((height) => {
    y += height;
  });
  y += paymentHeight;
  if (data.voidReason) y += 12 + voidReasonHeight + 22;
  y += 12;
  y += preparedHeight + 27;
  y += 35;
  y += 42;

  measureDoc.end();
  return {
    pageHeight: Math.max(500, Math.ceil(y + 18)),
    partyHeight,
    documentHeight,
    conceptHeight,
    detailHeights,
    paymentHeight,
    preparedHeight,
    voidReasonHeight,
  };
}

export async function buildOrderTicketPdf(data: OrderTicketData) {
  const pageWidth = 226.77;
  const layout = measureOrderTicket(data, pageWidth);
  const { doc, done } = createDocument({ size: [pageWidth, layout.pageHeight], margin: 0 });
  const contentWidth = pageWidth - 32;
  const logo = getThermalLogoBuffer();

  if (logo) doc.image(logo, 16, 16, { fit: [contentWidth, 66], align: 'center', valign: 'center' });
  else doc.font('Helvetica-Bold').fontSize(20).fillColor(THERMAL_INK).text('AgroPlastick', 16, 30, { width: contentWidth, align: 'center' });
  let y = 91;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(12).fillColor(THERMAL_INK).text('PEDIDO', 16, y, { width: contentWidth, align: 'center' });
  y += 18;
  doc.font('Helvetica-Bold').fontSize(15).fillColor(THERMAL_INK).text(data.number, 16, y, { width: contentWidth, align: 'center' });
  y += 25;
  ticketPair(doc, 'Fecha', data.date, y, contentWidth);
  y += 15;
  ticketPair(doc, 'Cliente', data.clientName, y, contentWidth);
  y += Math.max(18, doc.heightOfString(data.clientName, { width: 124 }));
  ticketPair(doc, 'Documento', data.clientDocument, y, contentWidth);
  y += 17;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text('Direccion', 16, y, { width: contentWidth });
  y += 11;
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(data.deliveryAddress || 'No registrada', 16, y, { width: contentWidth });
  y += doc.heightOfString(data.deliveryAddress || 'No registrada', { width: contentWidth }) + 4;
  ticketPair(doc, 'Telefono', data.clientPhone || 'No registrado', y, contentWidth);
  y += 15;
  ticketPair(doc, 'Forma de pago', data.paymentMethod, y, contentWidth);
  y += layout.paymentHeight;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text('PRODUCTOS', 16, y);
  y += 14;
  const quantityWidth = 45;
  const unitPriceWidth = 72;
  const totalWidth = contentWidth - quantityWidth - unitPriceWidth;
  ticketTableCell(doc, 'CANTIDAD', 16, y, quantityWidth, 20, { header: true, align: 'center', fontSize: 6.2 });
  ticketTableCell(doc, 'VALOR UNITARIO', 16 + quantityWidth, y, unitPriceWidth, 20, { header: true, align: 'center', fontSize: 6.2 });
  ticketTableCell(doc, 'VALOR TOTAL', 16 + quantityWidth + unitPriceWidth, y, totalWidth, 20, { header: true, align: 'center', fontSize: 6.2 });
  y += 20;
  data.items.forEach((item, itemIndex) => {
    const descriptionHeight = layout.descriptionHeights[itemIndex];
    ticketTableCell(doc, item.description, 16, y, contentWidth, descriptionHeight, { font: 'Helvetica-Bold', fontSize: 8 });
    y += descriptionHeight;
    ticketTableCell(doc, formatQuantity(item.quantity), 16, y, quantityWidth, 22, { align: 'center', fontSize: 7.5 });
    ticketTableCell(doc, formatMoney(item.unitPrice), 16 + quantityWidth, y, unitPriceWidth, 22, { align: 'right', fontSize: 7.2 });
    ticketTableCell(doc, formatMoney(item.lineTotal), 16 + quantityWidth + unitPriceWidth, y, totalWidth, 22, {
      align: 'right',
      font: 'Helvetica-Bold',
      fontSize: 7.2,
    });
    y += 22;
  });

  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor(THERMAL_INK).text('TOTAL', 16, y);
  doc.font('Helvetica-Bold').fontSize(14).fillColor(THERMAL_INK).text(formatMoney(data.total), 80, y - 2, { width: 130, align: 'right' });
  y += 28;
  dashedLine(doc, y, 16, pageWidth - 16);
  y += 12;

  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text('OBSERVACIONES', 16, y, { width: contentWidth });
  y += 12;
  doc.roundedRect(16, y, contentWidth, layout.observationsHeight + 10, 3).lineWidth(0.8).fillAndStroke('#ffffff', THERMAL_INK);
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(data.observations || 'Sin observaciones', 21, y + 5, {
    width: contentWidth - 10,
    height: layout.observationsHeight,
  });
  y += layout.observationsHeight + 22;

  ticketPair(doc, 'Estado', data.voided ? 'Anulado' : data.invoiced ? 'Facturado' : 'Pendiente', y, contentWidth);
  y += 16;
  if (data.voided) {
    ticketPair(doc, 'Motivo', data.voidReason || 'Sin motivo', y, contentWidth);
    y += layout.voidReasonHeight;
  }
  ticketPair(doc, 'Atendido por', data.userName, y, contentWidth);
  y += Math.max(20, doc.heightOfString(data.userName, { width: 124 }));
  doc.font('Helvetica-Bold').fontSize(9).fillColor(THERMAL_INK).text('Gracias por su pedido', 16, y + 10, { width: contentWidth, align: 'center' });
  doc.font('Helvetica-Bold').fontSize(7).fillColor(THERMAL_INK).text('Empaques, amarres y proteccion para el agro', 16, y + 26, {
    width: contentWidth,
    align: 'center',
  });

  doc.end();
  return done;
}

function measureOrderTicket(data: OrderTicketData, pageWidth: number) {
  const contentWidth = pageWidth - 32;
  const measureDoc = new PDFDocument({ size: [pageWidth, 14400], margin: 0 });
  measureDoc.on('data', () => undefined);
  let y = 146;

  measureDoc.font('Helvetica').fontSize(8);
  const clientHeight = Math.max(18, measureDoc.heightOfString(data.clientName, { width: 124 }));
  const addressHeight = Math.max(10, measureDoc.heightOfString(data.deliveryAddress || 'No registrada', { width: contentWidth }));
  const paymentHeight = Math.max(
    19,
    measureDoc.font('Helvetica-Bold').fontSize(8).heightOfString(data.paymentMethod || '-', { width: contentWidth - 66 }) + 4,
  );
  const observationsHeight = Math.max(
    10,
    measureDoc.font('Helvetica-Bold').fontSize(8).heightOfString(data.observations || 'Sin observaciones', { width: contentWidth - 10 }) + 2,
  );
  const userHeight = Math.max(20, measureDoc.heightOfString(data.userName, { width: 124 }));
  const voidReasonHeight = data.voided
    ? Math.max(16, measureDoc.heightOfString(data.voidReason || 'Sin motivo', { width: 124 }))
    : 0;
  const descriptionHeights = data.items.map((item) => {
    measureDoc.font('Helvetica-Bold').fontSize(8);
    return Math.max(24, measureDoc.heightOfString(item.description, { width: contentWidth - 12 }) + 10);
  });

  y += 15;
  y += clientHeight;
  y += 17;
  y += 11 + addressHeight + 4;
  y += 15;
  y += paymentHeight;
  y += 12;
  y += 14;
  y += 20;
  descriptionHeights.forEach((descriptionHeight) => {
    y += descriptionHeight + 22;
  });
  y += 12;
  y += 28;
  y += 12;
  y += 12;
  y += observationsHeight + 22;
  y += 16;
  y += voidReasonHeight;
  y += userHeight;

  measureDoc.end();
  return {
    pageHeight: Math.max(600, Math.ceil(y + 54)),
    descriptionHeights,
    paymentHeight,
    observationsHeight,
    voidReasonHeight,
  };
}

function ticketTableCell(
  doc: any,
  value: string,
  x: number,
  y: number,
  width: number,
  height: number,
  options: {
    header?: boolean;
    align?: 'left' | 'center' | 'right';
    font?: string;
    fontSize?: number;
  } = {},
) {
  const header = Boolean(options.header);
  doc.rect(x, y, width, height).lineWidth(header ? 1 : 0.8).fillAndStroke('#ffffff', THERMAL_INK);
  doc
    .font(options.font || 'Helvetica-Bold')
    .fontSize(options.fontSize || 7.5)
    .fillColor(THERMAL_INK)
    .text(value, x + 4, y + (header ? 7 : 6), {
      width: width - 8,
      height: height - 8,
      align: options.align || 'left',
      ellipsis: true,
    });
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

function ticketPair(doc: any, label: string, value: string, y: number, contentWidth: number) {
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(label, 16, y, { width: 65 });
  doc.font('Helvetica-Bold').fontSize(8).fillColor(THERMAL_INK).text(value || '-', 82, y, {
    width: contentWidth - 66,
    align: 'right',
  });
}

function dashedLine(doc: any, y: number, start: number, end: number) {
  doc.moveTo(start, y).lineTo(end, y).dash(3, { space: 3 }).lineWidth(0.8).strokeColor(THERMAL_INK).stroke().undash();
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

function getThermalLogoBuffer() {
  if (cachedThermalLogo !== undefined) return cachedThermalLogo;
  const filename = join('public', 'brand', 'agroplastic-logo-thermal.png');
  const candidates = [
    join(process.cwd(), filename),
    join(process.cwd(), 'backend', filename),
    join(__dirname, '..', '..', '..', filename),
  ];
  const logoPath = candidates.find((candidate) => existsSync(candidate));
  cachedThermalLogo = logoPath ? readFileSync(logoPath) : null;
  return cachedThermalLogo;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
