import ExcelJS from 'exceljs';
import { numberToWords, formatMoney } from '../utils/num2words';

type ClientLike = {
  name: string;
  inn?: string;
  kpp?: string;
  address?: string;
  phone?: string;
};

type CompanyLike = {
  name: string;
  short_name?: string;
  inn?: string;
  kpp?: string;
  address?: string;
};

type InvoiceItemLike = {
  name: string;
  unit: string;
  quantity: number;
  price: number;
  sum: number;
};

type InvoiceLike = {
  invoice_number: string;
  invoice_date: string;
  vat_mode: string;
  vat_rate: number;
  subtotal: number;
  vat_amount: number;
  total: number;
  comment?: string;
};

type PlaceholderMap = Record<string, string>;

const ITEM_PLACEHOLDERS = [
  '{{row_no}}', '{{item_name}}', '{{item_qty}}', '{{item_unit}}', '{{item_price}}', '{{item_amount}}',
  '{row_no}', '{item_name}', '{item_qty}', '{item_unit}', '{item_price}', '{item_amount}',
];

function cloneStyle<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function cellValueAsString(value: any): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object' && value) {
    if ('richText' in value && Array.isArray((value as any).richText)) {
      return ((value as any).richText as Array<{ text?: string }>).map((x) => x?.text || '').join('');
    }
    if ('formula' in value || 'sharedFormula' in value) {
      const res = (value as any).result;
      if (typeof res === 'string') return res;
      if (typeof res === 'number') return String(res);
    }
  }
  return '';
}

function replaceText(text: string, map: PlaceholderMap): string {
  let out = text;
  for (const [k, v] of Object.entries(map)) {
    out = out.split(`{{${k}}}`).join(v ?? '');
    out = out.split(`{${k}}`).join(v ?? '');
  }
  return out;
}

function replaceCellPlaceholders(cell: ExcelJS.Cell, map: PlaceholderMap) {
  if (typeof cell.value === 'string') {
    cell.value = replaceText(cell.value, map);
    return;
  }
  const rich = (cell.value as any)?.richText;
  if (Array.isArray(rich)) {
    (cell.value as any).richText = rich.map((chunk: any) => ({
      ...chunk,
      text: replaceText(String(chunk?.text ?? ''), map),
    }));
    return;
  }
  // Handle formula cells: if formula text contains placeholders, convert to plain string value
  const v = cell.value as any;
  if (v && typeof v === 'object' && ('formula' in v || 'sharedFormula' in v)) {
    const formula: string = v.formula || v.sharedFormula || '';
    if (Object.keys(map).some(k => formula.includes(`{{${k}}}`) || formula.includes(`{${k}}`))) {
      cell.value = replaceText(formula, map);
    }
  }
}

function getItemTemplateMaxCol(ws: ExcelJS.Worksheet, rowIdx: number): number {
  const row = ws.getRow(rowIdx);
  const scanMax = Math.max(row.cellCount, ws.columnCount || 1);
  let maxCol = 0;
  for (let c = 1; c <= scanMax; c++) {
    const t = cellValueAsString(row.getCell(c).value);
    if (t && ITEM_PLACEHOLDERS.some((p) => t.includes(p))) {
      maxCol = Math.max(maxCol, c);
    }
  }
  if (maxCol > 0) return maxCol;
  // Fallback: keep prior behavior if placeholders are in rich/formula-only cells not detected above
  return Math.max(row.cellCount, 1);
}

function formatRussianDate(iso: string): string {
  const months = [
    'января','февраля','марта','апреля','мая','июня',
    'июля','августа','сентября','октября','ноября','декабря'
  ];
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} г.`;
}

export function buildInvoiceFileName(invoiceNumber: string, invoiceDate: string, companyShortName: string): string {
  const d = new Date(invoiceDate);
  let datePart = invoiceDate;
  if (!isNaN(d.getTime())) {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    datePart = `${dd}.${mm}.${yyyy}`;
  }
  const safeName = (companyShortName || '').replace(/[\\/:*?"<>|]/g, '_').trim();
  return `Счет №${invoiceNumber} от ${datePart}${safeName ? ' ' + safeName : ''}.xlsx`;
}

function normalizeTemplatePath(p: string): string {
  if (!p) return p;
  if (p.startsWith('http://') || p.startsWith('https://')) return p;
  if (!p.startsWith('/')) return '/' + p;
  return p;
}

function declension(n: number, one: string, two: string, five: string): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}

function findItemTemplateRow(ws: ExcelJS.Worksheet): number {
  for (let r = 1; r <= Math.max(ws.rowCount, 1); r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= Math.max(row.cellCount, ws.columnCount || 1); c++) {
      const text = cellValueAsString(row.getCell(c).value);
      if (text && ITEM_PLACEHOLDERS.some((p) => text.includes(p))) {
        return r;
      }
    }
  }
  return -1;
}

function colLetterToIndex(col: string): number {
  let n = 0;
  for (let i = 0; i < col.length; i++) {
    n = n * 26 + col.toUpperCase().charCodeAt(i) - 64;
  }
  return n;
}

function getMergeNonFirstColsForRow(merges: string[], rowIdx: number): Set<number> {
  const nonFirst = new Set<number>();
  for (const m of merges) {
    const p = parseRange(m);
    if (!p) continue;
    if (p.r1 !== rowIdx) continue;
    const c1 = colLetterToIndex(p.c1);
    const c2 = colLetterToIndex(p.c2);
    for (let c = c1 + 1; c <= c2; c++) nonFirst.add(c);
  }
  return nonFirst;
}

function copyRowVisual(
  ws: ExcelJS.Worksheet,
  srcRowIdx: number,
  dstRowIdx: number,
  maxCol: number,
  skipCols: Set<number>
) {
  const srcRow = ws.getRow(srcRowIdx);
  const dstRow = ws.getRow(dstRowIdx);
  dstRow.height = srcRow.height;
  for (let c = 1; c <= maxCol; c++) {
    const src = ws.getCell(srcRowIdx, c);
    const dst = ws.getCell(dstRowIdx, c);
    if (!skipCols.has(c)) {
      dst.value = src.value as any;
    }
    dst.style = cloneStyle(src.style);
  }
}

function parseRange(range: string): { c1: string; r1: number; c2: string; r2: number } | null {
  const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range.trim());
  if (!m) return null;
  return { c1: m[1], r1: Number(m[2]), c2: m[3], r2: Number(m[4]) };
}

function applyMergedReplicas(
  ws: ExcelJS.Worksheet,
  templateRowIdx: number,
  extraRows: number,
  snapshotMerges: string[]
) {
  if (extraRows <= 0) return;
  for (const mergeRange of snapshotMerges) {
    const p = parseRange(mergeRange);
    if (!p) continue;
    if (p.r1 !== templateRowIdx || p.r2 !== templateRowIdx) continue;
    for (let i = 1; i <= extraRows; i++) {
      try {
        ws.mergeCells(`${p.c1}${templateRowIdx + i}:${p.c2}${templateRowIdx + i}`);
      } catch {
        // ignore if already merged
      }
    }
  }
}

function ensureWorkbookDateProps(wb: ExcelJS.Workbook) {
  const anyWb = wb as any;
  if (!anyWb.properties || typeof anyWb.properties !== 'object') {
    anyWb.properties = {};
  }
  if (typeof anyWb.properties.date1904 !== 'boolean') {
    anyWb.properties.date1904 = false;
  }
  if (!anyWb.model || typeof anyWb.model !== 'object') {
    anyWb.model = {};
  }
  if (!anyWb.model.properties || typeof anyWb.model.properties !== 'object') {
    anyWb.model.properties = {};
  }
  if (typeof anyWb.model.properties.date1904 !== 'boolean') {
    anyWb.model.properties.date1904 = false;
  }

  if (!anyWb.calcProperties || typeof anyWb.calcProperties !== 'object') {
    anyWb.calcProperties = {};
  }
  if (typeof anyWb.calcProperties.fullCalcOnLoad !== 'boolean') {
    anyWb.calcProperties.fullCalcOnLoad = true;
  }

  if (!anyWb.model.calcProperties || typeof anyWb.model.calcProperties !== 'object') {
    anyWb.model.calcProperties = {};
  }
  if (typeof anyWb.model.calcProperties.fullCalcOnLoad !== 'boolean') {
    anyWb.model.calcProperties.fullCalcOnLoad = true;
  }
}

async function tryLoadTemplate(templatePath: string) {
  try {
    const url = normalizeTemplatePath(templatePath);
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[excelGenerator] Template fetch failed: ${url} → HTTP ${res.status}`);
      return null;
    }
    const buf = await res.arrayBuffer();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    ensureWorkbookDateProps(wb);
    return wb;
  } catch {
    return null;
  }
}

export async function generateInvoiceXlsx(
  invoice: InvoiceLike,
  company: CompanyLike,
  client: ClientLike,
  items: InvoiceItemLike[],
  templatePath: string
): Promise<Uint8Array> {
  const wb = (await tryLoadTemplate(templatePath)) ?? new ExcelJS.Workbook();
  ensureWorkbookDateProps(wb);
  const ws = wb.worksheets[0] ?? wb.addWorksheet('Счёт');

  // Snapshot column widths from template before any row manipulation
  const colWidths: Record<number, number | undefined> = {};
  const colCount = ws.columnCount || 20;
  for (let ci = 1; ci <= colCount; ci++) {
    colWidths[ci] = ws.getColumn(ci).width;
  }

  if (ws.rowCount === 0) {
    ws.getCell('A1').value = 'Счёт на оплату';
    ws.getCell('A1').font = { bold: true, size: 14 };
  }

  const itemsCountText = `${items.length} ${declension(items.length, 'наименование', 'наименования', 'наименований')}`;
  const commonMap: PlaceholderMap = {
    invoice_number: invoice.invoice_number || '',
    invoice_date: formatRussianDate(invoice.invoice_date || ''),
    invoice_date_iso: invoice.invoice_date || '',
    supplier_name: company.short_name || company.name || '',
    supplier_inn: company.inn || '',
    supplier_kpp: company.kpp || '',
    supplier_address: company.address || '',
    buyer_name: client.name || '',
    buyer_inn: client.inn || '',
    buyer_kpp: client.kpp || '',
    buyer_address: client.address || '',
    buyer_phone: client.phone || '',
    total_subtotal: formatMoney(invoice.subtotal || 0),
    total_vat: formatMoney(invoice.vat_amount || 0),
    total_with_vat: formatMoney(invoice.total || 0),
    items_count: String(items.length),
    items_count_words: itemsCountText,
    items_count_text: itemsCountText,
    total_words: numberToWords(invoice.total || 0),
    comment: invoice.comment || '',
  };

  const itemTemplateRow = findItemTemplateRow(ws);
  if (itemTemplateRow > 0) {
    const maxCol = getItemTemplateMaxCol(ws, itemTemplateRow);
    const extraRows = Math.max(items.length - 1, 0);
    // Snapshot merge structure BEFORE any row insertion (row numbers will shift after spliceRows)
    const mergeSnapshot = [...((ws as any).model?.merges ?? [])] as string[];

    if (extraRows > 0) {
      const skipCols = getMergeNonFirstColsForRow(mergeSnapshot, itemTemplateRow);

      // Insert all extra rows at once after template row
      for (let i = 0; i < extraRows; i++) {
        ws.spliceRows(itemTemplateRow + 1, 0, []);
      }
      // Apply merges to new rows FIRST (before copying values, so merged cells are set up)
      applyMergedReplicas(ws, itemTemplateRow, extraRows, mergeSnapshot);
      // Copy template row visuals — skipCols is the same for all item rows (same merge structure)
      for (let i = 1; i <= extraRows; i++) {
        copyRowVisual(ws, itemTemplateRow, itemTemplateRow + i, maxCol, skipCols);
      }
      // Also skip non-first merge cells when filling item placeholder values
      // (skipCols already computed from mergeSnapshot for itemTemplateRow)
    }

    const templateHeight = ws.getRow(itemTemplateRow).height;
    const safeItems = items.length > 0 ? items : [{ name: '', unit: '', quantity: 0, price: 0, sum: 0 } as InvoiceItemLike];
    for (let i = 0; i < safeItems.length; i++) {
      const rowIdx = itemTemplateRow + i;
      const row = ws.getRow(rowIdx);
      if (templateHeight !== undefined) {
        row.height = templateHeight;
      }
      const item = safeItems[i];
      const rowMap: PlaceholderMap = {
        ...commonMap,
        row_no: String(i + 1),
        item_name: item.name || '',
        item_qty: formatMoney(item.quantity || 0),
        item_unit: item.unit || '',
        item_price: formatMoney(item.price || 0),
        item_amount: formatMoney(item.sum || 0),
      };

      const itemSkipCols = extraRows > 0
        ? getMergeNonFirstColsForRow(mergeSnapshot!, itemTemplateRow)
        : new Set<number>();
      for (let c = 1; c <= Math.max(row.cellCount, ws.columnCount || 1); c++) {
        if (itemSkipCols.has(c)) continue;
        const cell = row.getCell(c);
        const raw = cellValueAsString(cell.value);
        const hadItemName = raw.includes('{{item_name}}');
        replaceCellPlaceholders(cell, rowMap);
        if (hadItemName) {
          cell.alignment = { ...(cell.alignment || {}), wrapText: true, vertical: 'top' };
        }
      }
    }
  } else {
    ws.getCell('A3').value = `Счёт № ${invoice.invoice_number} от ${invoice.invoice_date}`;
    ws.getCell('A5').value = `Поставщик: ${company.short_name || company.name}`;
    ws.getCell('A6').value = `ИНН ${company.inn || ''}${company.kpp ? ` КПП ${company.kpp}` : ''}`.trim();
    ws.getCell('A8').value = `Покупатель: ${client.name}`;
    ws.getCell('A9').value = `ИНН ${client.inn || ''}${client.kpp ? ` КПП ${client.kpp}` : ''}`.trim();

    const startRow = 11;
    const headers = ['№', 'Наименование', 'Ед.', 'Кол-во', 'Цена', 'Сумма'];
    headers.forEach((h, i) => {
      const cell = ws.getCell(startRow, 1 + i);
      cell.value = h;
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
      };
    });

    items.forEach((it, idx) => {
      const r = startRow + 1 + idx;
      ws.getCell(r, 1).value = idx + 1;
      ws.getCell(r, 2).value = it.name;
      ws.getCell(r, 3).value = it.unit;
      ws.getCell(r, 4).value = it.quantity;
      ws.getCell(r, 5).value = it.price;
      ws.getCell(r, 6).value = it.sum;

      for (let c = 1; c <= 6; c++) {
        ws.getCell(r, c).border = {
          top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
          right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
        };
      }
    });

    ws.getColumn(1).width = 5;
    ws.getColumn(2).width = 45;
    ws.getColumn(3).width = 8;
    ws.getColumn(4).width = 10;
    ws.getColumn(5).width = 12;
    ws.getColumn(6).width = 14;

    const totalsRow = startRow + 2 + items.length;
    ws.getCell(totalsRow, 5).value = 'Итого:';
    ws.getCell(totalsRow, 5).font = { bold: true };
    ws.getCell(totalsRow, 6).value = invoice.total;
    ws.getCell(totalsRow, 6).font = { bold: true };

    ws.getCell(totalsRow + 2, 1).value = `Сумма прописью: ${numberToWords(invoice.total)}`;
    ws.getCell(totalsRow + 3, 1).value = invoice.comment ? `Комментарий: ${invoice.comment}` : '';

    ws.getCell(totalsRow, 6).numFmt = '#,##0.00';
  }

  // Build mergeNonFirstByRow from the CURRENT ws.model.merges (after all spliceRows)
  // This correctly reflects the shifted row numbers for footer/totals rows
  const allMerges = ((ws as any).model?.merges ?? []) as string[];
  const mergeNonFirstByRow = new Map<number, Set<number>>();
  for (const m of allMerges) {
    const p = parseRange(m);
    if (!p) continue;
    // Only single-row merges matter for placeholder replacement (horizontal merges)
    if (p.r1 !== p.r2) continue;
    if (!mergeNonFirstByRow.has(p.r1)) mergeNonFirstByRow.set(p.r1, new Set());
    const c1 = colLetterToIndex(p.c1);
    const c2 = colLetterToIndex(p.c2);
    const set = mergeNonFirstByRow.get(p.r1)!;
    for (let c = c1 + 1; c <= c2; c++) set.add(c);
  }

  if (itemTemplateRow > 0) {
    const itemRowCount = Math.max(items.length, 1);
    ws.eachRow((row, rowNumber) => {
      if (rowNumber >= itemTemplateRow && rowNumber < itemTemplateRow + itemRowCount) return;
      const skipSet = mergeNonFirstByRow.get(rowNumber);
      row.eachCell((cell, colNumber) => {
        if (skipSet?.has(colNumber)) return;
        replaceCellPlaceholders(cell, commonMap);
      });
    });
  } else {
    ws.eachRow((row, rowNumber) => {
      const skipSet = mergeNonFirstByRow.get(rowNumber);
      row.eachCell((cell, colNumber) => {
        if (skipSet?.has(colNumber)) return;
        replaceCellPlaceholders(cell, commonMap);
      });
    });
  }

  // Restore column widths from template snapshot (prevents ExcelJS from auto-widening)
  for (let ci = 1; ci <= colCount; ci++) {
    const w = colWidths[ci];
    if (w !== undefined && w > 0) ws.getColumn(ci).width = w;
  }

  ensureWorkbookDateProps(wb);
  const bytes = await wb.xlsx.writeBuffer();
  return new Uint8Array(bytes);
}
