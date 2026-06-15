/* NMS-Auto — Sales: Quotation + Sales Invoice (FIFO/Average per line), ported from sales.jsx */
import { useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, statusTone } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow, LineEditor } from '../components/doc'
import DB from '../data'
import type { EditorLine, Quotation, Invoice } from '../types'
import type { Go } from './types'

const D = DB

export function QuoteScreen({ go }: { go: Go }) {
  const [rows, setRows] = useState<Quotation[]>(D.quotations)
  const [modal, setModal] = useState(false)
  const [cust, setCust] = useState(''); const [lines, setLines] = useState<EditorLine[]>([])
  const create = () => {
    const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
    setRows((r) => [{ id: 'QT-' + (9200 + r.length), customer: cust, rep: 'R. Fernando', date: '2026-06-09', total, items: lines.length, status: 'Open', cost: '-' }, ...r])
    setModal(false); setLines([]); setCust('')
  }
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Quotation" icon="doc" sub={`${rows.length} quotations · ${rows.filter((r) => r.status === 'Open').length} open`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Quotation</Btn>} />
      <StatRow items={[
        { icon: 'doc', label: 'Open Quotations', value: rows.filter((r) => r.status === 'Open').length, c: 'ac' },
        { icon: 'check', label: 'Converted', value: rows.filter((r) => r.status === 'Converted').length, c: 'green' },
        { icon: 'clock', label: 'Expired', value: rows.filter((r) => r.status === 'Expired').length, c: 'warn' },
        { icon: 'coins', label: 'Pipeline Value', value: D.moneyK(rows.filter((r) => r.status === 'Open').reduce((a, r) => a + r.total, 0)), c: 'ac' },
      ]} />
      <Card pad={0}>
        <Table cols={[{ label: 'Quote No' }, { label: 'Customer' }, { label: 'Rep' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Total', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 120 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.rep}</Td><Td mono>{r.date}</Td>
            <Td align="right" mono>{r.items}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{D.money(r.total)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right">{r.status === 'Open' && <Btn variant="ghost" size="sm" iconR="chev" onClick={() => go('dc/invoice')}>Convert</Btn>}</Td>
          </>} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={760} title="New Quotation" sub="Prepare a price quote for a customer"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={create} disabled={!cust || !lines.length}>Save Quotation</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <Field label="Customer"><Select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Select customer…</option>{D.customers.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
          <Field label="Valid Until"><Input type="date" defaultValue="2026-06-23" /></Field>
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Quote Lines</div>
        <LineEditor lines={lines} setLines={setLines} mode="sell" />
      </Modal>
    </div>
  )
}

function InvoiceBuilder({ src, cust, setCust, lines, setLines, total, cogs, profit, post, back }: { src: Quotation | null; cust: string; setCust: (v: string) => void; lines: EditorLine[]; setLines: (fn: (l: EditorLine[]) => EditorLine[]) => void; total: number; cogs: number; profit: number; post: () => void; back: () => void }) {
  return (
    <div>
      <PageHead crumbs="Data Capture · Sales Invoice" title={src ? 'Invoice from ' + src.id : 'New Sales Invoice'} icon="receipt"
        sub="Choose FIFO or Average costing per line — profit recalculates instantly"
        actions={<><Btn variant="plain" icon="x" onClick={back}>Discard</Btn><Btn variant="primary" icon="check" onClick={post} disabled={!cust || !lines.length}>Post Invoice</Btn></>} />
      <div className="inv-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 16, alignItems: 'start' }}>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 18 }}>
            <Field label="Customer"><Select value={cust} onChange={(e) => setCust(e.target.value)}><option value="">Select…</option>{D.customers.map((c) => <option key={c.id}>{c.name}</option>)}</Select></Field>
            <Field label="Invoice Date"><Input type="date" defaultValue="2026-06-09" /></Field>
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
                <span className="t-2">{l}</span><span className="num">{D.money(v)}</span>
              </div>
            ))}
            <div className="row between" style={{ paddingTop: 12, marginTop: 6, borderTop: '1px solid var(--line)' }}>
              <span style={{ fontWeight: 700, fontFamily: 'Saira', fontSize: 16 }}>Total</span>
              <span className="num" style={{ fontWeight: 700, fontFamily: 'Saira', fontSize: 20, color: 'var(--ac-bright)' }}>{D.money(total)}</span>
            </div>
          </Card>
          <Card style={{ background: 'linear-gradient(160deg, var(--bg-1), oklch(0.22 0.04 155 / 0.4))', border: '1px solid var(--ok)' }}>
            <div className="row between" style={{ marginBottom: 12 }}><span className="eyebrow" style={{ color: 'var(--ok)' }}>Costing &amp; Margin</span><Icon n="chart" s={16} c="var(--ok)" /></div>
            <div className="row between" style={{ marginBottom: 8, fontSize: 13 }}><span className="t-2">Cost of goods</span><span className="num">{D.money(cogs)}</span></div>
            <div className="row between" style={{ marginBottom: 12, fontSize: 13 }}><span className="t-2">Gross profit</span><span className="num" style={{ color: 'var(--ok)', fontWeight: 700 }}>{D.money(profit)}</span></div>
            <div style={{ height: 7, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: Math.min(100, (profit / (total || 1)) * 100) + '%', background: 'var(--ok)', borderRadius: 6, transition: 'width .4s' }} />
            </div>
            <div className="t-2" style={{ fontSize: 11.5, marginTop: 8 }}>Margin <b className="num" style={{ color: 'var(--ok)' }}>{total ? Math.round((profit / total) * 100) : 0}%</b> · changes live as you switch FIFO ↔ Average per line</div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function InvoiceScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Invoice[]>(D.invoices)
  const [step, setStep] = useState(0) // 0 list, 1 pick quote, 2 build
  const [src, setSrc] = useState<Quotation | null>(null); const [lines, setLines] = useState<EditorLine[]>([]); const [cust, setCust] = useState('')
  const openQuotes = D.quotations.filter((q) => q.status === 'Open')
  const fromQuote = (q: Quotation) => {
    setSrc(q); setCust(q.customer)
    const picks: EditorLine[] = D.items.slice(0, q.items || 3).map((it) => ({ id: it.id, code: it.code, name: it.name, qty: 1 + Math.floor(Math.random() * 4), rate: it.price, fifo: it.fifoCost, avg: it.avgCost, method: 'FIFO', cost: it.avgCost }))
    setLines(picks); setStep(2)
  }
  const blank = () => { setSrc(null); setCust(''); setLines([]); setStep(2) }
  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const cogs = lines.reduce((a, l) => a + l.qty * (l.method === 'FIFO' ? l.fifo : l.avg), 0)
  const profit = total - cogs
  const post = () => {
    setRows((r) => [{ id: 'INV-' + (5600 + r.length), customer: cust, rep: 'R. Fernando', date: '2026-06-09', total, paid: 0, due: total, items: lines.length, cost: 'Mixed', status: 'Unpaid' }, ...r])
    setStep(0); setLines([])
  }

  if (step === 2) return <InvoiceBuilder {...{ src, cust, setCust, lines, setLines, total, cogs, profit, post, back: () => setStep(0) }} />
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Sales Invoice" icon="receipt" sub={`${rows.length} invoices · ${D.money(rows.reduce((a, r) => a + r.due, 0))} receivable`}
        actions={<><Btn variant="solid" icon="doc" onClick={() => setStep(1)}>From Quotation</Btn><Btn variant="primary" icon="plus" onClick={blank}>New Invoice</Btn></>} />
      <StatRow items={[
        { icon: 'receipt', label: 'Invoices (MTD)', value: rows.length, c: 'ac' },
        { icon: 'check', label: 'Paid', value: rows.filter((r) => r.status === 'Paid').length, c: 'green' },
        { icon: 'clock', label: 'Partial / Unpaid', value: rows.filter((r) => r.status !== 'Paid').length, c: 'warn' },
        { icon: 'coins', label: 'Sales Value', value: D.moneyK(rows.reduce((a, r) => a + r.total, 0)), c: 'green' },
      ]} />
      <Card pad={0}>
        <Table cols={[{ label: 'Invoice No' }, { label: 'Customer' }, { label: 'Rep' }, { label: 'Date' }, { label: 'Costing', align: 'center' }, { label: 'Total', align: 'right' }, { label: 'Due', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 60 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.rep}</Td><Td mono>{r.date}</Td>
            <Td align="center"><Badge tone="blue">{r.cost}</Badge></Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{D.money(r.total)}</Td>
            <Td align="right" mono c={r.due > 0 ? 'var(--warn)' : 'var(--tx-3)'}>{r.due > 0 ? D.money(r.due) : '—'}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><button className="mms-act"><Icon n="print" s={15} /></button></Td>
          </>} />
      </Card>
      <Modal open={step === 1} onClose={() => setStep(0)} width={680} title="Select Quotation to Invoice" sub="Convert an open quotation into a sales invoice">
        <div className="col gap-2">
          {openQuotes.map((q) => (
            <button key={q.id} onClick={() => fromQuote(q)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
              <div className="row gap-3">
                <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="doc" s={17} /></div>
                <div><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{q.id}</span><div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{q.customer} · {q.items} items · {q.date}</div></div>
              </div>
              <div className="row gap-3"><span className="num" style={{ fontWeight: 600 }}>{D.money(q.total)}</span><Icon n="chev" s={16} c="var(--tx-3)" /></div>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  )
}
