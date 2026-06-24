/* NMS-Auto — Reports (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, DateInput, Select, Table, Td } from '../components/ui'
import { Icon } from '../components/Icon'
import { Donut, ProgressRow } from '../components/charts'
import { api } from '../api'
import { branches as branchSeed, categories as catSeed, money, moneyK } from '../data'
import type { Go } from './types'

function SalesReport({ invoices }: { invoices: any[] }) {
  const total = invoices.reduce((a, r) => a + (r.total || 0), 0)
  const avg = invoices.length ? Math.round(total / invoices.length) : 0
  return (
    <Card>
      <div className="row between" style={{ marginBottom: 18 }}><h3 style={{ fontSize: 18 }}>Sales Summary</h3><Badge tone="blue">Current Period</Badge></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {([['Total Sales', moneyK(total), 'green'], ['Invoices', String(invoices.length), 'ac'], ['Avg Invoice', moneyK(avg), 'ac'], ['Receivables', moneyK(invoices.reduce((a, r) => a + (r.due || 0), 0)), 'green']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} style={{ padding: '14px', background: 'var(--bg-0)', borderRadius: 'var(--r-s)', border: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ fontSize: 9 }}>{l}</div><div className="num" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Saira', marginTop: 4, color: `var(--${c === 'green' ? 'ok' : 'ac-bright'})` }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}
function RepReport({ reps }: { reps: any[] }) {
  const totalT = reps.reduce((a, r) => a + (r.target || 0), 0)
  const totalA = reps.reduce((a, r) => a + (r.achieved || 0), 0)
  return (
    <Card>
      <h3 style={{ fontSize: 18, marginBottom: 18 }}>Sales by Representative</h3>
      {reps.length === 0 && <div className="t-3" style={{ padding: 10 }}>No reps</div>}
      {reps.map((r) => <ProgressRow key={r.id} label={`${r.name} · ${r.zone}`} value={r.achieved || 0} max={r.target || 1} color={(r.achieved || 0) >= (r.target || 0) ? 'var(--ok)' : 'var(--ac)'} right={moneyK(r.achieved || 0) + ' / ' + moneyK(r.target || 0)} />)}
      {reps.length > 0 && <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }} className="row between">
        <span className="t-2">Team achievement</span><span className="num" style={{ fontWeight: 700, color: 'var(--ok)' }}>{totalT ? Math.round((totalA / totalT) * 100) : 0}%</span>
      </div>}
    </Card>
  )
}
function AgeingReport({ customers }: { customers: any[] }) {
  return (
    <Card>
      <h3 style={{ fontSize: 18, marginBottom: 18 }}>Receivables Ageing</h3>
      <Table cols={[{ label: 'Customer' }, { label: 'Current', align: 'right' }, { label: '1-30', align: 'right' }, { label: '31-60', align: 'right' }, { label: '60+', align: 'right' }, { label: 'Total', align: 'right' }]}
        rows={customers.filter((c) => (c.outstanding || 0) > 0).slice(0, 30)}
        render={(c) => { const o = c.outstanding || 0; return <>
          <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{c.name}</Td>
          <Td align="right" mono>{moneyK(o * 0.4)}</Td><Td align="right" mono>{moneyK(o * 0.3)}</Td>
          <Td align="right" mono c="var(--warn)">{moneyK(o * 0.2)}</Td><Td align="right" mono c={c.status === 'risk' ? 'var(--bad)' : 'var(--tx-1)'}>{moneyK(o * 0.1)}</Td>
          <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{moneyK(o)}</Td>
        </> }} />
    </Card>
  )
}
function StockValReport({ items }: { items: any[] }) {
  const byCat = catSeed.map((c) => ({ label: c, value: items.filter((i) => i.category === c).reduce((a, i) => a + (i.avgCost || 0) * (i.qty || 0), 0) }))
  const total = byCat.reduce((a, c) => a + c.value, 0)
  return (
    <Card>
      <div className="row between" style={{ marginBottom: 18 }}><h3 style={{ fontSize: 18 }}>Stock Valuation</h3><span className="num" style={{ fontWeight: 700, fontSize: 18, color: 'var(--ac-bright)' }}>{money(total)}</span></div>
      <Donut center={catSeed.length} data={byCat.filter((c) => c.value > 0).map((c, i) => ({ label: c.label, value: c.value, color: ['var(--ac)', 'var(--ok)', 'var(--warn)', 'var(--info)', '#8b5cf6', '#ec4899', '#14b8a6', 'var(--tx-3)'][i] }))} />
    </Card>
  )
}

export default function ReportsScreen({ go: _go }: { go: Go }) {
  const [active, setActive] = useState('sales')
  const [invoices, setInvoices] = useState<any[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [items, setItems] = useState<any[]>([])

  useEffect(() => {
    api.invoices.list().then((d) => setInvoices(d as any)).catch(() => {})
    api.reps.list().then((d) => setReps(d as any)).catch(() => {})
    api.customers.list().then((d) => setCustomers(d as any)).catch(() => {})
    api.items.list().then((d) => setItems(d as any)).catch(() => {})
  }, [])

  const cats: { g: string; items: [string, string, string][] }[] = [
    { g: 'Sales', items: [['sales', 'Sales Summary', 'chart'], ['salesRep', 'Sales by Rep', 'target']] },
    { g: 'Inventory', items: [['stockVal', 'Stock Valuation', 'box']] },
    { g: 'Finance', items: [['receivable', 'Receivables Ageing', 'wallet']] },
  ]
  return (
    <div>
      <PageHead crumbs="Analytics" title="Reports" icon="chart" sub="Performance, sales, stock & finance reports"
        actions={<><Btn variant="solid" icon="excel">Export</Btn><Btn variant="solid" icon="print">Print</Btn></>} />
      <div className="rep-grid" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
        <Card pad={0}>
          {cats.map((c) => (
            <div key={c.g}>
              <div style={{ padding: '12px 16px 6px' }} className="eyebrow">{c.g}</div>
              {c.items.map(([id, label, icon]) => (
                <button key={id} onClick={() => setActive(id)} className="mms-nav" style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '9px 16px', background: active === id ? 'var(--ac-dim)' : 'transparent', border: 'none', borderLeft: '3px solid ' + (active === id ? 'var(--ac)' : 'transparent'), color: active === id ? 'var(--ac-bright)' : 'var(--tx-1)', fontSize: 13, fontWeight: active === id ? 600 : 500, textAlign: 'left' }}>
                  <Icon n={icon} s={16} c={active === id ? 'var(--ac-bright)' : 'var(--tx-2)'} />{label}
                </button>
              ))}
            </div>
          ))}
        </Card>
        <div>
          <Card style={{ marginBottom: 16 }}>
            <div className="row between wrap gap-3" style={{ marginBottom: 8 }}>
              <div className="row gap-2">
                <Field label="From" style={{ width: 150 }}><DateInput /></Field>
                <Field label="To" style={{ width: 150 }}><DateInput /></Field>
                <Field label="Branch" style={{ width: 160 }}><Select defaultValue="All">{['All', ...branchSeed].map((b) => <option key={b}>{b}</option>)}</Select></Field>
              </div>
              <Btn variant="primary" icon="filter" style={{ alignSelf: 'flex-end' }}>Run Report</Btn>
            </div>
          </Card>
          {active === 'sales' && <SalesReport invoices={invoices} />}
          {active === 'salesRep' && <RepReport reps={reps} />}
          {active === 'receivable' && <AgeingReport customers={customers} />}
          {active === 'stockVal' && <StockValReport items={items} />}
        </div>
      </div>
    </div>
  )
}
