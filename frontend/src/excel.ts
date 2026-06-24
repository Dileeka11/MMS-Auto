/* Excel parsing helpers. Uses SheetJS (xlsx) in the browser.
   Three flavours used by Procurement:
     - parsePoExcel       : item list (PART NO / DESCRIPTION / HS CODE / QTY / FOB USD).
     - parseCostingExcel  : same item lines but with the per-line allocation columns
                            from the costing template (returns ParsedCostingLine).
                            Also picks up any "extra" label+amount rows below for
                            backward compat. */
import * as XLSX from 'xlsx'

export interface ParsedLine {
  code: string
  hsCode?: string
  item: string
  qty: number
  cost: number
  total: number
}
export interface ParsedCostingLine extends ParsedLine {
  sellingPriceWoVat?: number
  sellingPriceWithVat?: number
}
export interface ParsedCosting {
  lines: ParsedCostingLine[]
  extras: { label: string; amount: number }[]
}

const lower = (s: any) => String(s ?? '').trim().toLowerCase()

function rowsFromSheet(sheet: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as any[][]
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
        if (idx.code == null && /(^|\b)(code|part\s*no|part\s*number|part)\b/.test(c)) idx.code = j
        if (idx.hsCode == null && /hs\s*code|h\.s\.?\s*code/.test(c)) idx.hsCode = j
        if (idx.item == null && /description|particular|^item$|name/.test(c)) idx.item = j
        if (idx.qty == null && /qty|quantity/.test(c)) idx.qty = j
        if (idx.cost == null && /unit\s*price|fob.*usd|price|rate|unit\s*cost|^cost/.test(c)) idx.cost = j
        if (idx.total == null && /total\s*amount|^total\b|amount/.test(c)) idx.total = j
        if (idx.sellingWo == null && /selling.*w\/?o.*vat/.test(c)) idx.sellingWo = j
        if (idx.sellingWith == null && /selling.*with.*vat/.test(c)) idx.sellingWith = j
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
    lines.push({
      code,
      // HS codes are codes, not numbers — preserve as text (Excel may have stripped leading zeros).
      hsCode: idx.hsCode != null ? String(r[idx.hsCode] ?? '').trim() : undefined,
      item,
      qty,
      cost,
      total: total || qty * cost,
      sellingPriceWoVat: idx.sellingWo != null ? num(r[idx.sellingWo]) : undefined,
      sellingPriceWithVat: idx.sellingWith != null ? num(r[idx.sellingWith]) : undefined,
    })
  }
  return { lines, end }
}

export async function readWorkbook(file: File): Promise<XLSX.WorkBook> {
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
function pickSheet(wb: XLSX.WorkBook, prefer: RegExp): XLSX.WorkSheet {
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
