/* NMS-Auto — Sales: Quotation + Sales Invoice (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, DateInput, Select, Modal, Table, Td, statusTone } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow, LineEditor } from '../components/doc'
import { api } from '../api'
import { money, moneyK, fmtDate } from '../data'
import type { EditorLine, Quotation, Invoice } from '../types'
import type { Go } from './types'

export function QuoteScreen({ go }: { go: Go }) {
  const [rows, setRows] = useState<Quotation[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [cust, setCust] = useState(''); const [lines, setLines] = useState<EditorLine[]>([])
  const [saving, setSaving] = useState(false)

  const refresh = () => { setLoading(true); api.quotations.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh(); api.customers.list().then((d) => setCustomers(d as any)).catch(() => {}) }, [])

  const create = async () => {
    setSaving(true)
    try {
      const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
      await api.quotations.create({
        customer: cust, rep: 'R. Fernando', date: new Date().toISOString().slice(0, 10),
        total, items: lines.length, status: 'Open', lines,
      } as any)
      setModal(false); setLines([]); setCust(''); refresh()
    } finally { setSaving(false) }
  }
  const remove = async (id: any) => { if (!confirm('Delete this quotation?')) return; await api.quotations.remove(id); refresh() }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Quotation" icon="doc" sub={`${rows.length} quotations · ${rows.filter((r) => r.status === 'Open').length} open`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Quotation</Btn>} />
      <StatRow items={[
        { icon: 'doc', label: 'Open Quotations', value: rows.filter((r) => r.status === 'Open').length, c: 'ac' },
        { icon: 'check', label: 'Converted', value: rows.filter((r) => r.status === 'Converted').length, c: 'green' },
        { icon: 'clock', label: 'Expired', value: rows.filter((r) => r.status === 'Expired').length, c: 'warn' },
        { icon: 'coins', label: 'Pipeline Value', value: moneyK(rows.filter((r) => r.status === 'Open').reduce((a, r) => a + (r.total || 0), 0)), c: 'ac' },
      ]} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Quote No' }, { label: 'Customer' }, { label: 'Rep' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Total', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 140 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.rep}</Td><Td mono>{fmtDate(r.date)}</Td>
            <Td align="right" mono>{r.items}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.total || 0)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              {r.status === 'Open' && <Btn variant="ghost" size="sm" iconR="chev" onClick={() => go('dc/invoice')}>Convert</Btn>}
              <button className="mms-act" onClick={() => remove(r.id)}><Icon n="trash" s={15} /></button>
            </div></Td>
          </>} />}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={760} title="New Quotation" sub="Prepare a price quote for a customer"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={create} disabled={!cust || !lines.length || saving}>{saving ? 'Saving…' : 'Save Quotation'}</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <Field label="Customer"><Select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Select customer…</option>{customers.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Valid Until"><DateInput /></Field>
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Quote Lines</div>
        <LineEditor lines={lines} setLines={setLines} mode="sell" />
      </Modal>
    </div>
  )
}

function InvoiceBuilder({ src, cust, setCust, lines, setLines, total, cogs, profit, post, back, customers, saving }: { src: any | null; cust: string; setCust: (v: string) => void; lines: EditorLine[]; setLines: (fn: (l: EditorLine[]) => EditorLine[]) => void; total: number; cogs: number; profit: number; post: () => void; back: () => void; customers: any[]; saving: boolean }) {
  return (
    <div>
      <PageHead crumbs="Data Capture · Sales Invoice" title={src ? 'Invoice from ' + src.id : 'New Sales Invoice'} icon="receipt"
        sub="Choose FIFO or Average costing per line — profit recalculates instantly"
        actions={<><Btn variant="plain" icon="x" onClick={back}>Discard</Btn><Btn variant="primary" icon="check" onClick={post} disabled={!cust || !lines.length || saving}>{saving ? 'Posting…' : 'Post Invoice'}</Btn></>} />
      <div className="inv-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
            <Field label="Customer"><Select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Select…</option>{customers.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Invoice Date"><DateInput value={new Date().toISOString().slice(0, 10)} /></Field>
            <Field label="Payment"><Select defaultValue="Credit Sale">{['Cash', 'Credit Sale', 'Card', 'Bank Transfer'].map((p) => <option key={p}>{p}</option>)}</Select></Field>
          </div>
          <div className="row between" style={{ marginBottom: 10 }}>
            <div className="eyebrow">Invoice Lines</div>
            <div className="row gap-2"><Badge tone="blue" dot>FIFO</Badge><Badge tone="green" dot>Average Cost</Badge></div>
          </div>
          <LineEditor lines={lines} setLines={setLines} mode="sell" perLineCost />
        </Card>
        <div className="col gap-4" style={{ position: 'sticky', top: 80 }}>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Invoice Summary</div>
            {([['Sub-total', total], ['Discount', 0], ['Tax (0%)', 0]] as [string, number][]).map(([l, v]) => (
              <div key={l} className="row between" style={{ marginBottom: 9, fontSize: 13 }}>
                <span className="t-2">{l}</span><span className="num">{money(v)}</span>
              </div>
            ))}
            <div className="row between" style={{ paddingTop: 12, marginTop: 6, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 700, fontFamily: 'Saira', fontSize: 16 }}>Total</span>
              <span className="num" style={{ fontWeight: 700, fontFamily: 'Saira', fontSize: 20, color: 'var(--ac-bright)' }}>{money(total)}</span>
            </div>
          </Card>
          <Card style={{ background: 'linear-gradient(160deg, var(--bg-1), oklch(0.22 0.04 155 / 0.4))', border: '1px solid var(--ok)' }}>
            <div className="row between" style={{ marginBottom: 12 }}><span className="eyebrow" style={{ color: 'var(--ok)' }}>Costing &amp; Margin</span><Icon n="chart" s={16} c="var(--ok)" /></div>
            <div className="row between" style={{ marginBottom: 8, fontSize: 13 }}><span className="t-2">Cost of goods</span><span className="num">{money(cogs)}</span></div>
            <div className="row between" style={{ marginBottom: 12, fontSize: 13 }}><span className="t-2">Gross profit</span><span className="num" style={{ color: 'var(--ok)', fontWeight: 700 }}>{money(profit)}</span></div>
            <div style={{ height: 7, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.min(100, (profit / (total || 1)) * 100) + '%', background: 'var(--ok)', borderRadius: 6, transition: 'width .4s' }} />
            </div>
            <div className="t-2" style={{ fontSize: 11.5, marginTop: 8 }}>Margin <b className="num" style={{ color: 'var(--ok)' }}>{total ? Math.round((profit / total) * 100) : 0}%</b></div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function InvoiceScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Invoice[]>([])
  const [openQuotes, setOpenQuotes] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState(0)
  const [src, setSrc] = useState<any>(null); const [lines, setLines] = useState<EditorLine[]>([]); const [cust, setCust] = useState('')
  const [saving, setSaving] = useState(false)
  const [payFor, setPayFor] = useState<Invoice | null>(null)
  const [payAmt, setPayAmt] = useState(''); const [payMode, setPayMode] = useState('Cash'); const [payRef, setPayRef] = useState(''); const [paying, setPaying] = useState(false)
  const [tab, setTab] = useState<'web' | 'app'>('web')

  const refresh = () => { setLoading(true); api.invoices.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => {
    refresh()
    api.customers.list().then((d) => setCustomers(d as any)).catch(() => {})
    api.quotations.list().then((d: any[]) => setOpenQuotes(d.filter((q) => q.status === 'Open'))).catch(() => {})
  }, [])

  const openPay = (r: Invoice) => { setPayFor(r); setPayAmt(String(r.due || 0)); setPayMode('Cash'); setPayRef('') }
  const submitPay = async () => {
    if (!payFor) return
    const amt = parseFloat(payAmt)
    if (!amt || amt <= 0) return
    setPaying(true)
    try {
      await api.invoices.pay(payFor.id, { amount: amt, mode: payMode, reference: payRef || undefined })
      setPayFor(null); refresh()
    } finally { setPaying(false) }
  }

  const printInvoice = (r: Invoice) => {
    const no = r.code || r.id
    const items = (r.lines || []).map((l) => `<tr><td>${l.code || ''}</td><td>${l.name}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.qty * l.rate)}</td></tr>`).join('')
    const w = window.open('', '_blank', 'width=800,height=900')
    if (!w) return
    w.document.write(`<!doctype html><html><head><title>Invoice ${no}</title><meta charset="utf-8">
      <style>
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
        .totals .grand{font-weight:700;font-size:15px;border-top:2px solid #111;margin-top:6px;padding-top:8px}
      </style></head><body>
      <div class="head">
        <div><h1>NMS-Auto</h1><div class="muted">Spare Parts Distribution</div></div>
        <div class="r"><h1 style="font-size:16px">SALES INVOICE</h1><div class="muted">${no}</div><div class="muted">${fmtDate(r.date)}</div></div>
      </div>
      <div><strong>Bill To:</strong> ${r.customer || ''}${r.rep ? ` &nbsp;·&nbsp; <span class="muted">Rep: ${r.rep}</span>` : ''}</div>
      <table><thead><tr><th>Code</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${items || '<tr><td colspan="5" class="muted">No line items</td></tr>'}</tbody></table>
      <div class="totals">
        <div><span>Total</span><span>${money(r.total || 0)}</span></div>
        <div><span>Paid</span><span>${money(r.paid || 0)}</span></div>
        <div class="grand"><span>Balance Due</span><span>${money(r.due || 0)}</span></div>
      </div>
      </body></html>`)
    w.document.close(); w.focus(); w.print()
  }

  const fromQuote = (q: any) => {
    setSrc(q); setCust(q.customer)
    const picks: EditorLine[] = (q.lines || []).map((l: any) => ({ id: l.id || l.itemId, code: l.code, name: l.name, qty: l.qty, rate: l.rate, fifo: l.fifo || l.rate, avg: l.avg || l.rate, method: 'FIFO', cost: l.avg || l.rate }))
    setLines(picks); setStep(2)
  }
  const blank = () => { setSrc(null); setCust(''); setLines([]); setStep(2) }
  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const cogs = lines.reduce((a, l) => a + l.qty * (l.method === 'FIFO' ? l.fifo : l.avg), 0)
  const profit = total - cogs
  const post = async () => {
    setSaving(true)
    try {
      await api.invoices.create({
        customer: cust, rep: 'R. Fernando', date: new Date().toISOString().slice(0, 10),
        total, paid: 0, due: total, items: lines.length, cost: 'Mixed', status: 'Unpaid', lines,
      } as any)
      setStep(0); setLines([]); refresh()
    } finally { setSaving(false) }
  }

  if (step === 2) return <InvoiceBuilder {...{ src, cust, setCust, lines, setLines, total, cogs, profit, post, back: () => setStep(0), customers, saving }} />
  const appRows = rows.filter((r) => r.source === 'app')
  const shown = tab === 'app' ? appRows : rows.filter((r) => r.source !== 'app')
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Sales Invoice" icon="receipt" sub={`${shown.length} invoices · ${money(shown.reduce((a, r) => a + (r.due || 0), 0))} receivable`}
        actions={<><Btn variant="solid" icon="doc" onClick={() => setStep(1)}>From Quotation</Btn><Btn variant="primary" icon="plus" onClick={blank}>New Invoice</Btn></>} />
      <div className="row gap-2" style={{ marginBottom: 14 }}>
        <Btn variant={tab === 'web' ? 'primary' : 'ghost'} icon="receipt" onClick={() => setTab('web')}>Sales Invoice</Btn>
        <Btn variant={tab === 'app' ? 'primary' : 'ghost'} icon="phone" onClick={() => setTab('app')}>App Invoice{appRows.length ? ` (${appRows.length})` : ''}</Btn>
      </div>
      <StatRow items={[
        { icon: 'receipt', label: 'Invoices (MTD)', value: shown.length, c: 'ac' },
        { icon: 'check', label: 'Paid', value: shown.filter((r) => r.status === 'Paid').length, c: 'green' },
        { icon: 'clock', label: 'Partial / Unpaid', value: shown.filter((r) => r.status !== 'Paid').length, c: 'warn' },
        { icon: 'coins', label: 'Sales Value', value: moneyK(shown.reduce((a, r) => a + (r.total || 0), 0)), c: 'green' },
      ]} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Invoice No' }, { label: 'Customer' }, { label: 'Rep' }, { label: 'Date' }, { label: 'Costing', align: 'center' }, { label: 'Total', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 60 }]}
          rows={shown}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.code || r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.rep}</Td><Td mono>{fmtDate(r.date)}</Td>
            <Td align="center"><Badge tone="blue">{r.cost}</Badge></Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.total || 0)}</Td>
            <Td align="right" mono c={(r.due || 0) > 0 ? 'var(--warn)' : 'var(--tx-3)'}>{(r.due || 0) > 0 ? money(r.due) : '—'}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
              {(r.due || 0) > 0 && <button className="mms-act" title="Add payment" onClick={() => openPay(r)}><Icon n="coins" s={15} /></button>}
              <button className="mms-act" title="Print invoice" onClick={() => printInvoice(r)}><Icon n="print" s={15} /></button>
            </div></Td>
          </>} />}
      </Card>
      <Modal open={step === 1} onClose={() => setStep(0)} width={680} title="Select Quotation to Invoice" sub="Convert an open quotation into a sales invoice">
        <div className="col gap-2">
          {openQuotes.length === 0 && <div className="t-3" style={{ padding: 20, textAlign: 'center' }}>No open quotations</div>}
          {openQuotes.map((q) => (
            <button key={q.id} onClick={() => fromQuote(q)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
              <div className="row gap-3">
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="doc" s={17} /></div>
                <div><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{q.id}</span><div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{q.customer} · {q.items} items · {fmtDate(q.date)}</div></div>
              </div>
              <div className="row gap-3"><span className="num" style={{ fontWeight: 600 }}>{money(q.total)}</span><Icon n="chev" s={16} c="var(--tx-3)" /></div>
            </button>
          ))}
        </div>
      </Modal>
      <Modal open={!!payFor} onClose={() => setPayFor(null)} width={440} title="Add Payment" sub={payFor ? `${payFor.code || payFor.id} · ${payFor.customer}` : ''}>
        {payFor && (
          <div className="col gap-3">
            <div className="row between" style={{ padding: '10px 12px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <span className="t-2">Balance Due</span>
              <span className="num" style={{ fontWeight: 700, color: 'var(--warn)' }}>{money(payFor.due || 0)}</span>
            </div>
            <Field label="Amount"><Input type="number" value={payAmt} onChange={(e: any) => setPayAmt(e.target.value)} placeholder="0.00" /></Field>
            <Field label="Mode">
              <Select value={payMode} onChange={(e: any) => setPayMode(e.target.value)}>
                <option>Cash</option><option>Cheque</option><option>Bank Transfer</option><option>Card</option>
              </Select>
            </Field>
            <Field label="Reference (optional)"><Input value={payRef} onChange={(e: any) => setPayRef(e.target.value)} placeholder="Cheque / txn no." /></Field>
            <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
              <Btn onClick={() => setPayFor(null)}>Cancel</Btn>
              <Btn variant="primary" icon="check" onClick={submitPay} disabled={paying || !parseFloat(payAmt)}>{paying ? 'Saving…' : 'Record Payment'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
