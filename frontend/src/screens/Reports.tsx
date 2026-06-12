/* MMS-Auto — Reports, ported from reports.jsx */
import { useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Table, Td } from '../components/ui'
import { Icon } from '../components/Icon'
import { BarChart, Donut, ProgressRow } from '../components/charts'
import DB from '../data'
import type { Go } from './types'

const D = DB

function SalesReport() {
  return (
    <Card>
      <div className="row between" style={{ marginBottom: 18 }}><h3 style={{ fontSize: 18 }}>Sales Summary</h3><Badge tone="blue">Jun 2026</Badge></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 22 }}>
        {([['Total Sales', 'Rs 7.8M', 'green'], ['Invoices', '142', 'ac'], ['Avg Invoice', 'Rs 54.9K', 'ac'], ['Gross Profit', 'Rs 2.8M', 'green']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} style={{ padding: '14px', background: 'var(--bg-0)', borderRadius: 'var(--r-s)', border: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ fontSize: 9 }}>{l}</div><div className="num" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Saira', marginTop: 4, color: `var(--${c === 'green' ? 'ok' : 'ac-bright'})` }}>{v}</div>
          </div>
        ))}
      </div>
      <BarChart height={240} data={D.monthlySales} keys={['sales', 'purchase', 'profit']} colors={['var(--ac)', 'var(--tx-3)', 'var(--ok)']} format={(v) => 'Rs ' + v.toFixed(0) + 'M'} />
    </Card>
  )
}
function RepReport() {
  return (
    <Card>
      <h3 style={{ fontSize: 18, marginBottom: 18 }}>Sales by Representative</h3>
      {D.reps.map((r) => <ProgressRow key={r.id} label={`${r.name} · ${r.zone}`} value={r.achieved} max={r.target} color={r.achieved >= r.target ? 'var(--ok)' : 'var(--ac)'} right={D.moneyK(r.achieved) + ' / ' + D.moneyK(r.target)} />)}
      <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--line)' }} className="row between">
        <span className="t-2">Team achievement</span><span className="num" style={{ fontWeight: 700, color: 'var(--ok)' }}>{Math.round((D.reps.reduce((a, r) => a + r.achieved, 0) / D.reps.reduce((a, r) => a + r.target, 0)) * 100)}%</span>
      </div>
    </Card>
  )
}
function AgeingReport() {
  return (
    <Card>
      <h3 style={{ fontSize: 18, marginBottom: 18 }}>Receivables Ageing</h3>
      <Table cols={[{ label: 'Customer' }, { label: 'Current', align: 'right' }, { label: '1-30', align: 'right' }, { label: '31-60', align: 'right' }, { label: '60+', align: 'right' }, { label: 'Total', align: 'right' }]}
        rows={D.customers.filter((c) => c.outstanding > 0).slice(0, 8)}
        render={(c) => { const o = c.outstanding; return <>
          <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{c.name}</Td>
          <Td align="right" mono>{D.moneyK(o * 0.4)}</Td><Td align="right" mono>{D.moneyK(o * 0.3)}</Td>
          <Td align="right" mono c="var(--warn)">{D.moneyK(o * 0.2)}</Td><Td align="right" mono c={c.status === 'risk' ? 'var(--bad)' : 'var(--tx-1)'}>{D.moneyK(o * 0.1)}</Td>
          <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{D.moneyK(o)}</Td>
        </> }} />
    </Card>
  )
}
function StockValReport() {
  const byCat = D.categories.map((c) => ({ label: c, value: D.items.filter((i) => i.category === c).reduce((a, i) => a + i.avgCost * i.qty, 0) }))
  const total = byCat.reduce((a, c) => a + c.value, 0)
  return (
    <Card>
      <div className="row between" style={{ marginBottom: 18 }}><h3 style={{ fontSize: 18 }}>Stock Valuation</h3><span className="num" style={{ fontWeight: 700, fontSize: 18, color: 'var(--ac-bright)' }}>{D.money(total)}</span></div>
      <Donut center={D.categories.length} data={byCat.map((c, i) => ({ label: c.label, value: c.value, color: ['var(--ac)', 'var(--ok)', 'var(--warn)', 'var(--info)', '#8b5cf6', '#ec4899', '#14b8a6', 'var(--tx-3)'][i] }))} />
    </Card>
  )
}

export default function ReportsScreen({ go: _go }: { go: Go }) {
  const [active, setActive] = useState('sales')
  const cats: { g: string; items: [string, string, string][] }[] = [
    { g: 'Sales', items: [['sales', 'Sales Summary', 'chart'], ['salesRep', 'Sales by Rep', 'target'], ['salesItem', 'Item-wise Sales', 'pkg'], ['salesCust', 'Customer-wise Sales', 'users']] },
    { g: 'Inventory', items: [['stockVal', 'Stock Valuation', 'box'], ['reorder', 'Reorder Report', 'clock'], ['movement', 'Stock Movement', 'swap'], ['dead', 'Dead Stock', 'adjust']] },
    { g: 'Finance', items: [['receivable', 'Receivables Ageing', 'wallet'], ['profit', 'Profit & Margin', 'coins'], ['expense', 'Expense Report', 'coins'], ['purchase', 'Purchase Report', 'cart']] },
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
                <Field label="From" style={{ width: 150 }}><Input type="date" defaultValue="2026-06-01" /></Field>
                <Field label="To" style={{ width: 150 }}><Input type="date" defaultValue="2026-06-09" /></Field>
                <Field label="Branch" style={{ width: 160 }}><Select defaultValue="All">{['All', ...D.branches].map((b) => <option key={b}>{b}</option>)}</Select></Field>
              </div>
              <Btn variant="primary" icon="filter" style={{ alignSelf: 'flex-end' }}>Run Report</Btn>
            </div>
          </Card>
          {active === 'sales' && <SalesReport />}
          {active === 'salesRep' && <RepReport />}
          {active === 'receivable' && <AgeingReport />}
          {active === 'stockVal' && <StockValReport />}
          {!['sales', 'salesRep', 'receivable', 'stockVal'].includes(active) && (
            <Card>
              <div className="col center" style={{ padding: '80px 20px', textAlign: 'center' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-3)', display: 'grid', placeItems: 'center', color: 'var(--tx-3)', marginBottom: 14 }}><Icon n="chart" s={28} /></div>
                <h3 style={{ fontSize: 18 }}>Report ready to run</h3><div className="t-2" style={{ marginTop: 6 }}>Set your filters above and click Run Report to generate this report.</div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
