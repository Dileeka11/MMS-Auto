/* NMS-Auto — Dispatch Notes + Outstanding Settlement (API-backed) */
import { useEffect, useMemo, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, statusTone } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow } from '../components/doc'
import { api } from '../api'
import { money, moneyK, fmtDate } from '../data'
import type { SalesOrder, Invoice } from '../types'
import type { Go } from './types'

const TERMS = ['Cash', 'Cheque', 'Credit (30 days)']

/** Open a printable invoice window (shared by dispatch → invoice flow). */
function printInvoice(r: Invoice) {
  const no = r.code || r.id
  const items = (r.lines || [])
    .map((l) => `<tr><td>${l.code || ''}</td><td>${l.name}</td><td class="r">${l.qty}</td><td class="r">${money(l.rate)}</td><td class="r">${money(l.qty * l.rate)}</td></tr>`)
    .join('')
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
    <div><strong>Bill To:</strong> ${r.customer || ''}${r.rep ? ` &nbsp;·&nbsp; <span class="muted">Rep: ${r.rep}</span>` : ''}${r.terms ? ` &nbsp;·&nbsp; <span class="muted">Terms: ${r.terms}</span>` : ''}</div>
    <table><thead><tr><th>Code</th><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead><tbody>${items || '<tr><td colspan="5" class="muted">No line items</td></tr>'}</tbody></table>
    <div class="totals">
      <div><span>Total</span><span>${money(r.total || 0)}</span></div>
      <div><span>Paid</span><span>${money(r.paid || 0)}</span></div>
      <div class="grand"><span>Balance Due</span><span>${money(r.due || 0)}</span></div>
    </div>
    </body></html>`)
  w.document.close(); w.focus(); w.print()
}

type EditLine = { id?: number; code?: string; name: string; qty: number; rate: number; method?: string }

export function DispatchScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<SalesOrder[]>([])
  const [avail, setAvail] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'dispatched'>('pending')

  // dispatch modal
  const [disp, setDisp] = useState<SalesOrder | null>(null)
  const [dispLines, setDispLines] = useState<EditLine[]>([])
  const [dispatching, setDispatching] = useState(false)

  // invoice modal
  const [inv, setInv] = useState<SalesOrder | null>(null)
  const [terms, setTerms] = useState(TERMS[0])
  const [invoicing, setInvoicing] = useState(false)

  const refresh = () => {
    setLoading(true)
    api.salesOrders.list().then((d) => setRows(d as SalesOrder[])).finally(() => setLoading(false))
  }
  useEffect(() => {
    refresh()
    // Available = on-hand − reserved, keyed by item code (for over-sell warnings).
    api.items.list().then((d: any[]) => {
      const m: Record<string, number> = {}
      for (const it of d) m[it.code] = Math.max(0, (it.qty || 0) - (it.reserved || 0))
      setAvail(m)
    }).catch(() => {})
  }, [])

  const openDispatch = (o: SalesOrder) => {
    setDisp(o)
    setDispLines((o.lines || []).map((l) => ({ id: l.id, code: l.code, name: l.name, qty: l.qty, rate: l.rate, method: l.method })))
  }
  const setLineQty = (i: number, qty: number) => setDispLines((ls) => ls.map((l, ix) => ix === i ? { ...l, qty } : l))
  const submitDispatch = async () => {
    if (!disp) return
    if (dispLines.some((l) => !l.qty || l.qty < 1)) return
    setDispatching(true)
    try {
      await api.salesOrders.dispatch(disp.id, { lines: dispLines })
      setDisp(null); refresh()
    } finally { setDispatching(false) }
  }

  const openInvoice = (o: SalesOrder) => { setInv(o); setTerms(TERMS[0]) }
  const submitInvoice = async () => {
    if (!inv) return
    setInvoicing(true)
    try {
      const created = await api.salesOrders.invoice(inv.id, { terms }) as Invoice
      setInv(null); refresh()
      printInvoice(created)
    } finally { setInvoicing(false) }
  }

  const remove = async (o: SalesOrder) => {
    if (!confirm(`Cancel order ${o.code}?${o.status === 'dispatched' ? ' Its reserved stock will be released.' : ''}`)) return
    await api.salesOrders.remove(o.id); refresh()
  }

  const pending = rows.filter((r) => r.status === 'pending')
  const dispatched = rows.filter((r) => r.status === 'dispatched')
  const shown = tab === 'pending' ? pending : dispatched

  const dispTotal = useMemo(() => dispLines.reduce((a, l) => a + l.qty * l.rate, 0), [dispLines])

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Dispatch Notes" icon="truck"
        sub={`${pending.length} pending · ${dispatched.length} dispatched`} />
      <StatRow items={[
        { icon: 'clock', label: 'Pending Orders', value: pending.length, c: 'warn' },
        { icon: 'truck', label: 'Dispatched', value: dispatched.length, c: 'ac' },
        { icon: 'coins', label: 'Pending Value', value: moneyK(pending.reduce((a, r) => a + (r.total || 0), 0)), c: 'ac' },
        { icon: 'box', label: 'Dispatched Value', value: moneyK(dispatched.reduce((a, r) => a + (r.total || 0), 0)), c: 'green' },
      ]} />
      <div className="row gap-2" style={{ marginBottom: 14 }}>
        <Btn variant={tab === 'pending' ? 'primary' : 'ghost'} icon="clock" onClick={() => setTab('pending')}>Pending{pending.length ? ` (${pending.length})` : ''}</Btn>
        <Btn variant={tab === 'dispatched' ? 'primary' : 'ghost'} icon="truck" onClick={() => setTab('dispatched')}>Dispatched{dispatched.length ? ` (${dispatched.length})` : ''}</Btn>
      </div>
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: tab === 'pending' ? 'Order No' : 'Dispatch No' }, { label: 'Customer' }, { label: 'Rep' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Total', align: 'right' }, { label: '', align: 'right', w: 220 }]}
          rows={shown}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{tab === 'pending' ? r.code : (r.dispatchNo || r.code)}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.rep}</Td><Td mono>{fmtDate(tab === 'pending' ? r.date : (r.dispatchDate || r.date))}</Td>
            <Td align="right" mono>{r.items}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.total || 0)}</Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              {r.status === 'pending' && <Btn variant="primary" size="sm" icon="truck" onClick={() => openDispatch(r)}>Dispatch</Btn>}
              {r.status === 'dispatched' && <Btn variant="solid" size="sm" icon="receipt" onClick={() => openInvoice(r)}>Create Invoice</Btn>}
              <button className="mms-act" title="Cancel order" onClick={() => remove(r)}><Icon n="trash" s={15} /></button>
            </div></Td>
          </>} />}
      </Card>

      {/* Dispatch modal — edit qty against available stock */}
      <Modal open={!!disp} onClose={() => setDisp(null)} width={680}
        title="Generate Dispatch Note" sub={disp ? `${disp.code} · ${disp.customer}` : ''}
        footer={<><Btn variant="plain" onClick={() => setDisp(null)}>Cancel</Btn>
          <Btn variant="primary" icon="truck" onClick={submitDispatch} disabled={dispatching || !dispLines.length}>{dispatching ? 'Dispatching…' : 'Reserve & Dispatch'}</Btn></>}>
        {disp && (
          <div className="col gap-2">
            {dispLines.map((l, i) => {
              const av = l.code ? (avail[l.code] ?? 0) : 0
              const over = !!l.code && l.qty > av
              return (
                <div key={i} className="row between" style={{ padding: '10px 12px', background: 'var(--bg-0)', border: `1px solid ${over ? 'var(--danger)' : 'var(--line)'}`, borderRadius: 'var(--r-s)', gap: 12 }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 600, color: 'var(--tx-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                    <div className="t-2" style={{ fontSize: 12, color: over ? 'var(--danger)' : 'var(--tx-2)' }}>
                      {l.code || '—'} · {l.code ? `${av} available` : 'no stock link'}{over ? ' · exceeds stock' : ''}
                    </div>
                  </div>
                  <div style={{ width: 90 }}>
                    <Input type="number" value={String(l.qty)} onChange={(e: any) => setLineQty(i, parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="num" style={{ width: 90, textAlign: 'right', fontWeight: 600 }}>{money(l.qty * l.rate)}</div>
                </div>
              )
            })}
            <div className="row between" style={{ marginTop: 6, padding: '4px 4px' }}>
              <span className="t-2">Dispatch Total</span>
              <span className="num" style={{ fontWeight: 700, fontSize: 16 }}>{money(dispTotal)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* Invoice modal — pick terms */}
      <Modal open={!!inv} onClose={() => setInv(null)} width={440}
        title="Create Sales Invoice" sub={inv ? `${inv.dispatchNo || inv.code} · ${inv.customer}` : ''}
        footer={<><Btn variant="plain" onClick={() => setInv(null)}>Cancel</Btn>
          <Btn variant="primary" icon="receipt" onClick={submitInvoice} disabled={invoicing}>{invoicing ? 'Posting…' : 'Invoice & Print'}</Btn></>}>
        {inv && (
          <div className="col gap-3">
            <div className="row between" style={{ padding: '10px 12px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <span className="t-2">Invoice Total</span>
              <span className="num" style={{ fontWeight: 700 }}>{money(inv.total || 0)}</span>
            </div>
            <Field label="Payment Terms">
              <Select value={terms} onChange={(e: any) => setTerms(e.target.value)}>
                {TERMS.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
            <div className="t-2" style={{ fontSize: 12 }}>Stock will be reduced and the balance posted to outstanding. Settle it later from Outstanding Settlement.</div>
          </div>
        )}
      </Modal>
    </div>
  )
}

const METHODS = ['Cash', 'Cheque', 'Bank Transfer']

export function SettlementScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [payFor, setPayFor] = useState<Invoice | null>(null)
  const [amt, setAmt] = useState(''); const [method, setMethod] = useState('Cash')
  const [chequeNo, setChequeNo] = useState(''); const [bankAcc, setBankAcc] = useState('')
  const [paying, setPaying] = useState(false)

  const refresh = () => { setLoading(true); api.invoices.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const outstanding = rows.filter((r) => (r.due || 0) > 0)

  const open = (r: Invoice) => { setPayFor(r); setAmt(String(r.due || 0)); setMethod('Cash'); setChequeNo(''); setBankAcc('') }
  const submit = async () => {
    if (!payFor) return
    const a = parseFloat(amt)
    if (!a || a <= 0) return
    setPaying(true)
    try {
      await api.invoices.pay(payFor.id, {
        amount: a, mode: method,
        chequeNo: method === 'Cheque' ? chequeNo || undefined : undefined,
        bankAcc: method === 'Bank Transfer' ? bankAcc || undefined : undefined,
      })
      setPayFor(null); refresh()
    } finally { setPaying(false) }
  }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Outstanding Settlement" icon="wallet"
        sub={`${outstanding.length} unsettled · ${money(outstanding.reduce((a, r) => a + (r.due || 0), 0))} receivable`} />
      <StatRow items={[
        { icon: 'receipt', label: 'Outstanding Invoices', value: outstanding.length, c: 'warn' },
        { icon: 'coins', label: 'Total Receivable', value: moneyK(outstanding.reduce((a, r) => a + (r.due || 0), 0)), c: 'warn' },
        { icon: 'clock', label: 'Partly Paid', value: outstanding.filter((r) => (r.paid || 0) > 0).length, c: 'ac' },
        { icon: 'check', label: 'Fully Settled', value: rows.filter((r) => r.status === 'Paid').length, c: 'green' },
      ]} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Invoice No' }, { label: 'Customer' }, { label: 'Terms', align: 'center' }, { label: 'Date' }, { label: 'Total', align: 'right' }, { label: 'Paid', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 120 }]}
          rows={outstanding}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.code || r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td align="center"><Badge tone="blue">{r.terms || 'Cash'}</Badge></Td>
            <Td mono>{fmtDate(r.date)}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.total || 0)}</Td>
            <Td align="right" mono>{money(r.paid || 0)}</Td>
            <Td align="right" mono c="var(--warn)" style={{ fontWeight: 600 }}>{money(r.due || 0)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><Btn variant="primary" size="sm" icon="coins" onClick={() => open(r)}>Settle</Btn></Td>
          </>} />}
      </Card>

      <Modal open={!!payFor} onClose={() => setPayFor(null)} width={440}
        title="Settle Outstanding" sub={payFor ? `${payFor.code || payFor.id} · ${payFor.customer}` : ''}>
        {payFor && (
          <div className="col gap-3">
            <div className="row between" style={{ padding: '10px 12px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <span className="t-2">Balance Due</span>
              <span className="num" style={{ fontWeight: 700, color: 'var(--warn)' }}>{money(payFor.due || 0)}</span>
            </div>
            <Field label="Amount"><Input type="number" value={amt} onChange={(e: any) => setAmt(e.target.value)} placeholder="0.00" /></Field>
            <Field label="Method">
              <Select value={method} onChange={(e: any) => setMethod(e.target.value)}>
                {METHODS.map((m) => <option key={m}>{m}</option>)}
              </Select>
            </Field>
            {method === 'Cheque' && <Field label="Cheque No"><Input value={chequeNo} onChange={(e: any) => setChequeNo(e.target.value)} placeholder="Cheque number" /></Field>}
            {method === 'Bank Transfer' && <Field label="Bank Account No"><Input value={bankAcc} onChange={(e: any) => setBankAcc(e.target.value)} placeholder="Account number" /></Field>}
            <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
              <Btn onClick={() => setPayFor(null)}>Cancel</Btn>
              <Btn variant="primary" icon="check" onClick={submit} disabled={paying || !parseFloat(amt)}>{paying ? 'Saving…' : 'Record Settlement'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
