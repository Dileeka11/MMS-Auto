/* Excel parsing helpers. Uses SheetJS (xlsx) in the browser.
   Three flavours used by Procurement:
     - parsePoExcel       : item list (PART NO / DESCRIPTION / HS CODE / QTY / FOB USD).
     - parseCostingExcel  : same item lines but with the per-line allocation columns
                            from the costing template (returns ParsedCostingLine).
                            Also picks up any "extra" label+amount rows below for
                            backward compat. */
// Types only — erased at build time, so importing them costs nothing.
import type * as XLSXType from 'xlsx'

// The xlsx library is ~900KB raw / ~330KB gzipped. Load it on demand (first time
// a user actually imports/parses a spreadsheet) instead of on initial page load.
let _xlsx: typeof import('xlsx') | null = null
async function loadXlsx(): Promise<typeof import('xlsx')> {
  return (_xlsx ??= await import('xlsx'))
}

export interface ParsedLine {
  code: string
  hsCode?: string
  item: string
  qty: number
  cost: number
  total: number
}
export interface ParsedCostingLine extends ParsedLine {
  // Per-line allocation columns, read verbatim from the costing template
  // (no recalculation — whatever the Excel says is what we show/store).
  fobLkr?: number
  freightLkr?: number
  insuranceLkr?: number
  cid?: number
  pal?: number
  cess?: number
  vat?: number
  sscl?: number
  other1?: number
  other2?: number
  other3?: number
  banking?: number
  clearance?: number
  slpa?: number
  demurrage?: number
  totalPriceWoVat?: number
  totalPriceWithVat?: number
  unitCostWithVat?: number
  unitCostWoVat?: number
  sellingPriceWoVat?: number
  sellingPriceWithVat?: number
}
export interface ParsedCosting {
  lines: ParsedCostingLine[]
  extras: { label: string; amount: number }[]
}

const lower = (s: any) => String(s ?? '').trim().toLowerCase()

function rowsFromSheet(sheet: XLSXType.WorkSheet): any[][] {
  // _xlsx is always populated by readWorkbook() before this runs.
  return _xlsx!.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as any[][]
}

interface HeaderIdx {
  code?: number
  hsCode?: number
  item?: number
  qty?: number
  cost?: number
  total?: number
  sellingWo?: number
  sellingWith?: number
  // Costing-template allocation columns (all optional).
  fobLkr?: number
  freightLkr?: number
  insuranceLkr?: number
  cid?: number
  pal?: number
  cess?: number
  vat?: number
  sscl?: number
  other1?: number
  other2?: number
  other3?: number
  banking?: number
  clearance?: number
  slpa?: number
  demurrage?: number
  totalPriceWoVat?: number
  totalPriceWithVat?: number
  unitCostWithVat?: number
  unitCostWoVat?: number
}

function detectHeader(rows: any[][]) {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const r = rows[i].map(lower)
    const itemCol = r.findIndex((c) => /item|description|particular|name/.test(c))
    const qtyCol = r.findIndex((c) => /qty|quantity/.test(c))
    // Require the two keywords to live in distinct cells — otherwise a single
    // long note row containing both words can be misread as the header.
    if (itemCol >= 0 && qtyCol >= 0 && itemCol !== qtyCol) {
      const idx: HeaderIdx = {}
      r.forEach((c, j) => {
        // `cc` is the header text with all whitespace removed, for exact/robust
        // matching of the costing-template columns (which are split across two
        // lines in the template, e.g. "UNIT PRICE\nFOB-USD").
        const cc = c.replace(/\s+/g, '')
        if (idx.code == null && /(^|\b)(code|part\s*no|part\s*number|part)\b/.test(c)) idx.code = j
        if (idx.hsCode == null && /hs\s*code|h\.s\.?\s*code/.test(c)) idx.hsCode = j
        if (idx.item == null && /description|particular|^item$|name/.test(c)) idx.item = j
        if (idx.qty == null && /qty|quantity/.test(c)) idx.qty = j
        if (idx.cost == null && /unit\s*price|fob.*usd|price|rate|unit\s*cost|^cost/.test(c)) idx.cost = j
        if (idx.total == null && /total\s*amount|^total\b|amount/.test(c)) idx.total = j
        if (idx.sellingWo == null && /selling.*w\/?o.*vat/.test(c)) idx.sellingWo = j
        if (idx.sellingWith == null && /selling.*with.*vat/.test(c)) idx.sellingWith = j
        // Costing allocation columns — matched verbatim, no computation.
        if (idx.fobLkr == null && /fob-?lkr|amountfob/.test(cc)) idx.fobLkr = j
        if (idx.freightLkr == null && /^freight/.test(cc)) idx.freightLkr = j
        if (idx.insuranceLkr == null && /^insur/.test(cc)) idx.insuranceLkr = j
        if (idx.cid == null && cc === 'cid') idx.cid = j
        if (idx.pal == null && cc === 'pal') idx.pal = j
        if (idx.cess == null && cc === 'cess') idx.cess = j
        if (idx.vat == null && cc === 'vat') idx.vat = j
        if (idx.sscl == null && cc === 'sscl') idx.sscl = j
        if (idx.other1 == null && cc === 'other1') idx.other1 = j
        if (idx.other2 == null && cc === 'other2') idx.other2 = j
        if (idx.other3 == null && cc === 'other3') idx.other3 = j
        if (idx.banking == null && cc === 'banking') idx.banking = j
        if (idx.clearance == null && cc === 'clearance') idx.clearance = j
        if (idx.slpa == null && cc === 'slpa') idx.slpa = j
        if (idx.demurrage == null && cc === 'demurrage') idx.demurrage = j
        if (idx.totalPriceWithVat == null && /totalpricewithvat/.test(cc)) idx.totalPriceWithVat = j
        if (idx.totalPriceWoVat == null && /totalpricew\/?ovat/.test(cc)) idx.totalPriceWoVat = j
        if (idx.unitCostWithVat == null && /unitcostwithvat/.test(cc)) idx.unitCostWithVat = j
        if (idx.unitCostWoVat == null && /unitcostw\/?ovat/.test(cc)) idx.unitCostWoVat = j
      })
      // PART NO appears twice in the supplier template (numeric # + actual code).
      // Prefer the right-most non-numeric Part column as the code by re-scanning.
      const partCols: number[] = []
      r.forEach((c, j) => { if (/part\s*no/.test(c)) partCols.push(j) })
      if (partCols.length > 1) idx.code = partCols[partCols.length - 1]
      return { headerRow: i, idx }
    }
  }
  return null
}

function num(v: any): number {
  if (v == null || v === '') return 0
  const s = String(v).replace(/[$,\s]/g, '')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

function parseRows(rows: any[][]) {
  const h = detectHeader(rows)
  if (!h) return { lines: [] as ParsedCostingLine[], end: 0 }
  const { headerRow, idx } = h
  const lines: ParsedCostingLine[] = []
  let end = rows.length
  let skippedEmpty = 0
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]
    const isBlank = !r || r.every((c) => String(c ?? '').trim() === '')
    // "GRAND TOTAL" footer may live in any column (merged cells collapse to col A).
    if (r && r.some((c) => /grand\s*total/i.test(String(c ?? '')))) { end = i; break }
    const itemCell = idx.item != null ? r?.[idx.item] : ''
    const qtyCell = idx.qty != null ? r?.[idx.qty] : ''
    const item = String(itemCell ?? '').trim()
    const qty = num(qtyCell)
    // Tolerate up to 3 leading non-data rows after the detected header
    // (multi-line headers like "UNIT PRICE" / "FOB-USD" split across two rows).
    if ((isBlank || !item || qty <= 0) && lines.length === 0 && skippedEmpty < 3) {
      skippedEmpty++
      continue
    }
    if (isBlank) { end = i; break }
    if (!item) { end = i; break }
    const cost = idx.cost != null ? num(r[idx.cost]) : 0
    const total = idx.total != null ? num(r[idx.total]) : qty * cost
    const code = idx.code != null ? String(r[idx.code] ?? '').trim() : ''
    const col = (i?: number) => (i != null ? num(r[i]) : undefined)
    lines.push({
      code,
      // HS codes are codes, not numbers — preserve as text (Excel may have stripped leading zeros).
      hsCode: idx.hsCode != null ? String(r[idx.hsCode] ?? '').trim() : undefined,
      item,
      qty,
      cost,
      total: total || qty * cost,
      // Allocation columns, verbatim from the sheet (undefined when absent).
      fobLkr: col(idx.fobLkr),
      freightLkr: col(idx.freightLkr),
      insuranceLkr: col(idx.insuranceLkr),
      cid: col(idx.cid),
      pal: col(idx.pal),
      cess: col(idx.cess),
      vat: col(idx.vat),
      sscl: col(idx.sscl),
      other1: col(idx.other1),
      other2: col(idx.other2),
      other3: col(idx.other3),
      banking: col(idx.banking),
      clearance: col(idx.clearance),
      slpa: col(idx.slpa),
      demurrage: col(idx.demurrage),
      totalPriceWoVat: col(idx.totalPriceWoVat),
      totalPriceWithVat: col(idx.totalPriceWithVat),
      unitCostWithVat: col(idx.unitCostWithVat),
      unitCostWoVat: col(idx.unitCostWoVat),
      sellingPriceWoVat: idx.sellingWo != null ? num(r[idx.sellingWo]) : undefined,
      sellingPriceWithVat: idx.sellingWith != null ? num(r[idx.sellingWith]) : undefined,
    })
  }
  return { lines, end }
}

export async function readWorkbook(file: File): Promise<XLSXType.WorkBook> {
  const XLSX = await loadXlsx()
  const buf = await file.arrayBuffer()
  return XLSX.read(buf, { type: 'array' })
}

export async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer()
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** Pick the sheet whose name best matches `prefer` (e.g. "PO"), else first sheet. */
function pickSheet(wb: XLSXType.WorkBook, prefer: RegExp): XLSXType.WorkSheet {
  const match = wb.SheetNames.find((n) => prefer.test(n))
  return wb.Sheets[match || wb.SheetNames[0]]
}

export interface ParsedItem {
  code: string
  hsCode?: string
  name: string
}

/** Parse an Item Master sheet — picks up code + description + hs code from any
 *  sheet that has those columns (handles the "PO" tab in the supplier template). */
export async function parseItemMasterExcel(file: File): Promise<ParsedItem[]> {
  const wb = await readWorkbook(file)
  const sheet = pickSheet(wb, /^po\b|item|master/i)
  const rows = rowsFromSheet(sheet)
  const h = detectHeader(rows)
  if (!h) return []
  const { headerRow, idx } = h
  if (idx.code == null || idx.item == null) return []
  const items: ParsedItem[] = []
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]
    if (!r) continue
    if (r.some((c) => /grand\s*total/i.test(String(c ?? '')))) break
    const code = String(r[idx.code] ?? '').trim()
    const name = String(r[idx.item] ?? '').trim()
    if (!code || !name) continue
    const hsCode = idx.hsCode != null ? String(r[idx.hsCode] ?? '').trim() : ''
    items.push({ code, name, hsCode: hsCode || undefined })
  }
  return items
}

export async function parsePoExcel(file: File): Promise<ParsedLine[]> {
  const wb = await readWorkbook(file)
  const sheet = pickSheet(wb, /^po\b|purchase/i)
  const rows = rowsFromSheet(sheet)
  return parseRows(rows).lines.map(({ sellingPriceWoVat, sellingPriceWithVat, ...l }) => l)
}

export async function parseCostingExcel(file: File): Promise<ParsedCosting> {
  const wb = await readWorkbook(file)
  const sheet = pickSheet(wb, /costing|landed/i)
  const rows = rowsFromSheet(sheet)
  const { lines, end } = parseRows(rows)

  // Backward compat: pick up label+amount rows after the item block.
  const extras: { label: string; amount: number }[] = []
  for (let i = end; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.every((c) => String(c ?? '').trim() === '')) continue
    let label = ''
    let amount = 0
    let foundNum = false
    for (const c of r) {
      const s = String(c ?? '').trim()
      if (s === '') continue
      const n = Number(s.replace(/[, ]/g, ''))
      if (!Number.isNaN(n) && /^-?[\d.,]+$/.test(s)) {
        amount = n
        foundNum = true
      } else if (!label) {
        label = s
      }
    }
    if (foundNum && label && !/^total|grand total/i.test(label)) {
      extras.push({ label, amount })
    }
  }
  return { lines, extras }
}
