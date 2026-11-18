/* NMS-Auto — printable customer Payment Receipt */
import { company as companyApi } from '../api'
import { money, fmtDate } from '../data'
import { amountInWords } from './invoicePrint'

const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c])

const CSS = `
  *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
  body{margin:32px;color:#111}
  h1{margin:0;font-size:22px}
  .muted{color:#666;font-size:12px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left}
  th{background:#f4f4f4;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  .r{text-align:right}
  .total td{font-weight:700;font-size:15px;border-top:2px solid #111;border-bottom:none}
  .words{margin-top:10px;font-size:12px;font-style:italic}
  .sign{display:flex;justify-content:space-between;margin-top:70px;font-size:12px}
  .sign div{border-top:1px solid #111;padding-top:6px;width:30%;text-align:center}`

/**
 * Print one payment (one or more receipt rows posted together for the same
 * customer). Opens the window before any await so popup blockers allow it.
 */
export async function printReceipts(rows: any[]) {
  if (!rows.length) return
  const w = window.open('', '_blank', 'width=820,height=950')
  if (!w) return
  w.document.write('Loading…')
  const co: any = await companyApi.get().catch(() => ({}))
  const first = rows[0]
  const total = rows.reduce((a, r) => a + (+r.amount || 0), 0)
  const codes = rows.map((r) => r.code).join(', ')
  const cheque = /cheque/i.test(first.mode || '')
  const pay = [
    first.mode || 'Cash',
    cheque && first.chequeNo ? `Cheque #${first.chequeNo}` : '',
    cheque && first.chequeBankName ? first.chequeBankName : '',
    cheque && first.chequeDate ? `Dated ${fmtDate(first.chequeDate)}` : '',
    first.reference ? `Ref: ${first.reference}` : '',
  ].filter(Boolean).map(esc).join(' &nbsp;·&nbsp; ')
  const lines = rows.map((r) => `<tr><td>${esc(r.code)}</td><td>${esc(r.against || 'On Account')}</td><td class="r">${money(r.amount)}</td></tr>`).join('')

  w.document.open()
  w.document.write(`<!doctype html><html><head><title>Receipt ${esc(codes)}</title><meta charset="utf-8"><style>${CSS}</style></head><body>
    <div class="head">
      <div><h1>${esc(co.name || 'NMS-Auto')}</h1><div class="muted">${esc(co.address || '')}</div><div class="muted">${esc(co.phone || '')}</div></div>
      <div class="r"><h1 style="font-size:16px">PAYMENT RECEIPT</h1><div class="muted">${esc(codes)}</div><div class="muted">${fmtDate(first.date)}</div></div>
    </div>
    <div><strong>Received From:</strong> ${esc(first.customer)}</div>
    <div class="muted" style="margin-top:4px">Payment: ${pay}</div>
    <table><thead><tr><th>Receipt No</th><th>Against Invoice</th><th class="r">Amount</th></tr></thead>
      <tbody>${lines}<tr class="total"><td colspan="2">Total Received</td><td class="r">${money(total)}</td></tr></tbody></table>
    <div class="words">${esc(amountInWords(total))}</div>
    <div class="sign"><div>Received By</div><div>Checked By</div><div>Customer</div></div></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => { try { w.print() } catch { /* window closed */ } }, 300)
}
