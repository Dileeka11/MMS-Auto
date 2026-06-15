/* Excel parsing helpers. Uses SheetJS (xlsx) in the browser.
   Two flavours used by Procurement:
     - parsePoExcel       : item list + qty + price (+ optional total)
     - parseCostingExcel  : same item lines plus a 'costing figures' block
                            below (Freight, Duty, VAT…) which becomes extras */
import * as XLSX from 'xlsx'

export interface ParsedLine { code: string; item: string; qty: number; cost: number; total: number }
export interface ParsedCosting { lines: ParsedLine[]; extras: { label: string; amount: number }[] }

const lower = (s: any) => String(s ?? '').trim().toLowerCase()

function rowsFromSheet(sheet: XLSX.WorkSheet): any[][] {
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' }) as any[][]
}

function detectHeader(rows: any[][]) {
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const r = rows[i].map(lower)
    const hasItem = r.some((c) => /item|description|particular|name/.test(c))
    const hasQty = r.some((c) => /^qty$|quantity/.test(c))
    if (hasItem && hasQty) {
      const idx: Record<string, number> = {}
      r.forEach((c, j) => {
        if (/^code|item code|part/.test(c) && idx.code == null) idx.code = j
        if (/^item$|description|particular|name/.test(c) && idx.item == null) idx.item = j
        if (/^qty$|quantity/.test(c) && idx.qty == null) idx.qty = j
        if (/price|rate|unit cost|^cost/.test(c) && idx.cost == null) idx.cost = j
        if (/^total|amount/.test(c) && idx.total == null) idx.total = j
      })
      return { headerRow: i, idx }
    }
  }
  return null
}

function parseRows(rows: any[][]) {
  const h = detectHeader(rows)
  if (!h) return { lines: [] as ParsedLine[], end: 0 }
  const { headerRow, idx } = h
  const lines: ParsedLine[] = []
  let end = rows.length
  for (let i = headerRow + 1; i < rows.length; i++) {
    const r = rows[i]
    const itemCell = r[idx.item ?? -1]
    const qtyCell = r[idx.qty ?? -1]
    const isBlank = r.every((c) => String(c ?? '').trim() === '')
    if (isBlank) { end = i; break }
    if (idx.qty != null && (qtyCell === '' || qtyCell == null)) { end = i; break }
    const qty = Number(qtyCell) || 0
    const cost = Number(r[idx.cost ?? -1]) || 0
    const total = Number(r[idx.total ?? -1]) || qty * cost
    const item = String(itemCell ?? '').trim()
    if (!item) { end = i; break }
    lines.push({
      code: String(r[idx.code ?? -1] ?? '').trim(),
      item,
      qty,
      cost,
      total,
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

export async function parsePoExcel(file: File): Promise<ParsedLine[]> {
  const wb = await readWorkbook(file)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = rowsFromSheet(sheet)
  return parseRows(rows).lines
}

export async function parseCostingExcel(file: File): Promise<ParsedCosting> {
  const wb = await readWorkbook(file)
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = rowsFromSheet(sheet)
  const { lines, end } = parseRows(rows)

  // Anything after the line block that has a label + numeric amount is an "extra"
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
