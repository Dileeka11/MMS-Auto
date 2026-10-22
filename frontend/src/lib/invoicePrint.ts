/* NMS-Auto — printable Sales Invoice / Tax Invoice (shared by Sales + Dispatch) */
import { api, company as companyApi } from '../api'
import { money, fmtDate } from '../data'
import type { Invoice } from '../types'

const esc = (v: any) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as any)[c])
const num = (n: number) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
function words(n: number): string {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : '')
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + words(n % 100) : '')
  for (const [size, name] of [[1e9, 'Billion'], [1e6, 'Million'], [1e3, 'Thousand']] as [number, string][]) {
    if (n >= size) return words(Math.floor(n / size)) + ' ' + name + (n % size ? ' ' + words(n % size) : '')
  }
  return ''
}
/** 17110.5 → "Seventeen Thousand One Hundred Ten Rupees and Fifty Cents Only" */
export function amountInWords(amount: number): string {
  const rs = Math.floor(Math.abs(amount))
  const cts = Math.round((Math.abs(amount) - rs) * 100)
  return (rs ? words(rs) : 'Zero') + ' Rupees' + (cts ? ' and ' + words(cts) + ' Cents' : '') + ' Only'
}

const NORMAL_CSS = `
  *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
  body{margin:32px;color:#111}
  h1{margin:0;font-size:22px}
  .muted{color:#666;font-size:12px}
  .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:12px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:13px}
  th,td{padding:8px 10px;border-bottom:1px solid #ddd;text-align:left}
  th{background:#f4f4f4;text-transform:uppercase;font-size:11px;letter-spacing:.5px}
  .r{text-align:right}
  .totals{margin-top:16px;width:280px;margin-left:auto;font-size:13px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .totals .grand{font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:6px;padding-top:8px}`

function normalHtml(r: Invoice, co: any) {
  const no = r.code || r.id
  const items = (r.lines || []).map((l) => `<tr><td>${esc(l.code)}</td><td>${esc(l.name)}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.qty * l.rate)}</td></tr>`).join('')
  return `<style>${NORMAL_CSS}</style>
    <div class="head">
      <div><h1>${esc(co.name || 'NMS-Auto')}</h1><div class="muted">${esc(co.tagline || '')}</div></div>
      <div class="r"><h1 style="font-size:16px">SALES INVOICE</h1><div class="muted">${esc(no)}</div><div class="muted">${fmtDate(r.date)}</div></div>
    </div>
    <div><strong>Bill To:</strong> ${esc(r.customer)}${r.rep ? ` &nbsp;·&nbsp; <span class="muted">Rep: ${esc(r.rep)}</span>` : ''}${r.terms ? ` &nbsp;·&nbsp; <span class="muted">Terms: ${esc(r.terms)}</span>` : ''}</div>
    <table><thead><tr><th>Code</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${items || '<tr><td colspan="5" class="muted">No line items</td></tr>'}</tbody></table>
    <div class="totals">
      <div><span>Total</span><span>${money(r.total || 0)}</span></div>
      <div><span>Paid</span><span>${money(r.paid || 0)}</span></div>
      <div class="grand"><span>Balance Due</span><span>${money(r.due || 0)}</span></div>
    </div>`
}

const TAX_CSS = `
  *{box-sizing:border-box;font-family:'Segoe UI',Arial,Helvetica,sans-serif}
  body{margin:24px;color:#111;font-size:12.5px}
  .brand{display:flex;align-items:center;gap:16px;margin-bottom:12px}
  .brand img{height:60px;max-width:160px;object-fit:contain}
  .brand h1{flex:1;text-align:center;margin:0;font-size:26px;letter-spacing:.5px}
  .box{border:1.5px solid #111}
  .sec{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #111}
  .sec>div{padding:6px 8px}
  .sec>div+div{border-left:1px solid #111}
  .title{text-align:center;font-weight:700;font-size:16px;letter-spacing:2px;padding:6px}
  .kv{display:grid;grid-template-columns:120px 1fr;line-height:1.55}
  .kv span:nth-child(even)::before{content:': '}
  .one{border-top:1px solid #111;padding:6px 8px}
  table{width:100%;border-collapse:collapse}
  th,td{border-top:1px solid #111;padding:5px 8px;text-align:left}
  th+th,td+td{border-left:1px solid #111}
  th{font-weight:700}
  .r{text-align:right}
  tr.sum td{font-weight:600}
  tr.grand td{font-weight:700}
  .sign{display:flex;justify-content:space-between;gap:40px;margin-top:56px}
  .sign div{flex:1;border-top:1px solid #111;text-align:center;padding-top:6px}`

function taxHtml(r: Invoice, co: any, cu: any) {
  const lines = r.lines || []
  const vat = r.vatAmount || 0
  const supply = (r.total || 0) - vat
  const gross = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const discount = Math.round((gross - supply) * 100) / 100
  const rows = lines.map((l, i) => `<tr><td>${i + 1}</td><td>${esc([l.code, l.name].filter(Boolean).join(' - '))}</td><td class="r">${num(l.rate)}</td><td class="r">${l.qty}</td><td class="r">${num(l.qty * l.rate)}</td></tr>`).join('')
  return `<style>${TAX_CSS}</style>
    <div class="brand">${co.logoUrl ? `<img src="${esc(co.logoUrl)}" alt="">` : ''}<h1>${esc((co.name || '').toUpperCase())}</h1></div>
    <div class="box">
      <div class="title">TAX INVOICE</div>
      <div class="sec"><div class="kv"><span>Invoice Date</span><span>${fmtDate(r.date)}</span></div><div class="kv"><span>Tax Invoice No</span><span>${esc(r.code || r.id)}</span></div></div>
      <div class="sec">
        <div class="kv"><span>Supplier's TIN</span><span>${esc(co.taxNo)}</span><span>Supplier's Name</span><span>${esc(co.name)}</span><span>Address</span><span>${esc(co.address)}</span><span>Telephone No</span><span>${esc(co.phone)}</span></div>
        <div class="kv"><span>Purchaser's TIN</span><span>${esc(cu?.taxNo)}</span><span>Purchaser's Name</span><span>${esc(r.customer)}</span><span>Address</span><span>${esc(cu?.address || cu?.city)}</span><span>Telephone No</span><span>${esc(cu?.contact)}</span></div>
      </div>
      <div class="sec"><div class="kv"><span>Date of Delivery</span><span>${fmtDate(r.date)}</span></div><div class="kv"><span>Place of Supply</span><span>${esc(co.address)}</span></div></div>
      <div class="sec" style="min-height:70px"><div>Additional Information if any:</div><div class="kv"><span>Saleman</span><span>${esc(r.rep)}</span><span>Po No</span><span></span><span>Vehicle No</span><span></span></div></div>
      <div class="one kv"><span>Remark</span><span>${esc(r.terms ? 'Terms: ' + r.terms : '')}</span></div>
      <table>
        <thead><tr><th style="width:40px">No</th><th>Item Description</th><th class="r" style="width:120px">Unit Price</th><th class="r" style="width:60px">Qty</th><th class="r" style="width:130px">Amount</th></tr></thead>
        <tbody>${rows || '<tr><td colspan="5">No line items</td></tr>'}
          ${discount > 0 ? `<tr class="sum"><td colspan="4">Discount${r.discountPct ? ` (${r.discountPct}%)` : ''}</td><td class="r">(${num(discount)})</td></tr>` : ''}
          <tr class="sum"><td colspan="4">Total Value of Supply</td><td class="r">${num(supply)}</td></tr>
          <tr class="sum"><td colspan="4">VAT Amount (Total Value of Supply @ ${r.vatPct || 0}%)</td><td class="r">${num(vat)}</td></tr>
          <tr class="grand"><td colspan="4">Total Amount including VAT</td><td class="r">${num(r.total || 0)}</td></tr>
        </tbody>
      </table>
      <div class="one"><b>Total Amount in words:</b> ${amountInWords(r.total || 0)}</div>
    </div>
    <div class="sign"><div>Prepared By</div><div>Approved By</div><div>Received By</div></div>`
}

/**
 * Open a printable invoice window. VAT invoices print in the Tax Invoice
 * layout (supplier/purchaser TIN, VAT breakdown, amount in words).
 * The window is opened before any await so popup blockers allow it.
 */
export async function printInvoice(r: Invoice) {
  const w = window.open('', '_blank', 'width=820,height=950')
  if (!w) return
  w.document.write('Loading…')
  const [co, customers] = await Promise.all([
    companyApi.get().catch(() => ({})),
    r.vatApplied ? api.customers.list().catch(() => []) : Promise.resolve([]),
  ])
  const cu = (customers as any[]).find((c) => c.name === r.customer)
  const body = r.vatApplied ? taxHtml(r, co, cu) : normalHtml(r, co)
  w.document.open()
  w.document.write(`<!doctype html><html><head><title>${r.vatApplied ? 'Tax Invoice' : 'Invoice'} ${esc(r.code || r.id)}</title><meta charset="utf-8"></head>
    <body>${body}<script>window.onload=function(){window.focus();window.print()}</script></body></html>`)
  w.document.close()
}
