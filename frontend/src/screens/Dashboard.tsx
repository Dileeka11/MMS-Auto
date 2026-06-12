/* MMS-Auto — Dashboard, ported from dashboard.jsx */
import { Card, PageHead, Btn, Badge } from '../components/ui'
import { Icon } from '../components/Icon'
import { AreaChart, Donut, Spark, ProgressRow } from '../components/charts'
import DB from '../data'
import type { Go } from './types'

function KPI({ icon, label, value, delta, up, spark, sparkColor, tone = 'blue' }: { icon: string; label: string; value: string; delta?: string; up?: boolean; spark?: number[]; sparkColor?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const tc = { blue: 'var(--ac-bright)', green: 'var(--ok)', amber: 'var(--warn)', red: 'var(--bad)' }[tone]
  const td = { blue: 'var(--ac-dim)', green: 'var(--ok-dim)', amber: 'var(--warn-dim)', red: 'var(--bad-dim)' }[tone]
  return (
    <Card pad={18} className="mms-card">
      <div className="row between" style={{ marginBottom: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: td, display: 'grid', placeItems: 'center', color: tc }}><Icon n={icon} s={20} /></div>
        {delta != null && (
          <span className="row gap-1" style={{ fontSize: 12, fontWeight: 600, color: up ? 'var(--ok)' : 'var(--bad)', fontFamily: 'JetBrains Mono' }}>
            <Icon n={up ? 'arrowUp' : 'arrowDown'} s={13} />{delta}
          </span>
        )}
      </div>
      <div className="num" style={{ fontSize: 25, fontWeight: 700, fontFamily: 'Saira', letterSpacing: '-0.01em' }}>{value}</div>
      <div className="row between" style={{ marginTop: 4 }}>
        <span className="t-2" style={{ fontSize: 12 }}>{label}</span>
        {spark && <Spark data={spark} color={sparkColor || tc} w={72} h={26} />}
      </div>
    </Card>
  )
}

export default function DashScreen({ go }: { go: Go }) {
  const D = DB
  const lowStock = D.items.filter((i) => i.status !== 'in').slice(0, 6)
  const topItems = [...D.items].sort((a, b) => b.price * b.qty - a.price * a.qty).slice(0, 5)
  const recent = [
    { t: 'Sales Invoice INV-5511 created', who: 'R. Fernando', tone: 'blue', icon: 'receipt', time: '12m' },
    { t: 'GRN-7703 posted against PO-4403', who: 'Store Keeper', tone: 'green', icon: 'truck', time: '48m' },
    { t: 'Sales Return SR-3301 awaiting approval', who: 'S. Perera', tone: 'amber', icon: 'refund', time: '1h' },
    { t: 'Payment RCP-6604 received — Rs 145,000', who: 'Cashier', tone: 'green', icon: 'wallet', time: '2h' },
    { t: 'Quotation QT-9108 converted to invoice', who: 'M. Iqbal', tone: 'blue', icon: 'doc', time: '3h' },
  ]
  return (
    <div>
      <PageHead crumbs="Overview" title="Dashboard" sub="Wednesday, 09 June 2026 · Main Store"
        actions={<><Btn variant="solid" size="md" icon="download">Export</Btn><Btn variant="primary" size="md" icon="plus" onClick={() => go('dc/invoice')}>New Invoice</Btn></>} />

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KPI icon="coins" label="Sales · this month" value="Rs 7.8M" delta="14.2%" up tone="blue" spark={D.dailyTrend.slice(-14)} />
        <KPI icon="chart" label="Gross profit" value="Rs 2.8M" delta="9.1%" up tone="green" spark={D.dailyTrend.slice(-14).map((v) => v * 0.4)} />
        <KPI icon="wallet" label="Receivables" value="Rs 3.1M" delta="2.4%" up={false} tone="amber" spark={D.dailyTrend.slice(-14).map((v) => v * 0.6)} />
        <KPI icon="box" label="Stock value" value="Rs 11.4M" delta="3.7%" up tone="blue" spark={D.dailyTrend.slice(-14).map((v) => v * 0.9)} />
      </div>

      <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div className="row between" style={{ marginBottom: 18 }}>
            <div><div className="eyebrow">Performance</div><h3 style={{ fontSize: 18, marginTop: 3 }}>Sales vs Purchase vs Profit</h3></div>
            <div className="row gap-3" style={{ fontSize: 12 }}>
              {([['Sales', 'var(--ac)'], ['Purchase', 'var(--tx-3)'], ['Profit', 'var(--ok)']] as [string, string][]).map(([l, c]) => (
                <span key={l} className="row gap-2"><span style={{ width: 9, height: 9, borderRadius: 2, background: c }} /><span className="t-1">{l}</span></span>
              ))}
            </div>
          </div>
          <AreaChart height={250} labels={D.monthlySales.map((m) => m.m)} format={(v) => 'Rs ' + v.toFixed(1) + 'M'}
            series={[
              { data: D.monthlySales.map((m) => m.sales), color: 'var(--ac)' },
              { data: D.monthlySales.map((m) => m.purchase), color: 'var(--tx-3)' },
              { data: D.monthlySales.map((m) => m.profit), color: 'var(--ok)' },
            ]} />
        </Card>
        <Card>
          <div className="eyebrow">Inventory mix</div><h3 style={{ fontSize: 18, marginTop: 3, marginBottom: 18 }}>Stock by Category</h3>
          <Donut center="8" data={D.categoryShare.slice(0, 6).map((c, i) => ({ label: c.label, value: c.value, color: ['var(--ac)', 'var(--ok)', 'var(--warn)', 'var(--info)', '#8b5cf6', 'var(--tx-3)'][i] }))} />
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--line)' }}>
            <div className="row between"><span className="t-2" style={{ fontSize: 12 }}>Total SKUs</span><span className="num" style={{ fontWeight: 700 }}>{D.items.length}</span></div>
            <div className="row between" style={{ marginTop: 8 }}><span className="t-2" style={{ fontSize: 12 }}>Out of stock</span><span className="num" style={{ fontWeight: 700, color: 'var(--bad)' }}>{D.items.filter((i) => i.status === 'out').length}</span></div>
          </div>
        </Card>
      </div>

      <div className="dash-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16 }}>Sales Reps</h3><Btn variant="plain" size="sm" iconR="chev" onClick={() => go('ad/reps')}>View</Btn></div>
          {D.reps.map((r) => <ProgressRow key={r.id} label={r.name} value={r.achieved} max={r.target} color={r.achieved >= r.target ? 'var(--ok)' : 'var(--ac)'} right={Math.round((r.achieved / r.target) * 100) + '%'} />)}
        </Card>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16 }}>Low / Out of Stock</h3><Badge tone="red">{lowStock.length} alerts</Badge></div>
          <div className="col gap-2">
            {lowStock.map((i) => (
              <div key={i.id} className="row between mms-row" style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg-0)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                  <div className="mono t-3" style={{ fontSize: 11 }}>{i.code}</div>
                </div>
                <Badge tone={i.status === 'out' ? 'red' : 'amber'}>{i.qty} {i.unit}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16 }}>Top Value Items</h3><Btn variant="plain" size="sm" iconR="chev" onClick={() => go('m/item')}>All</Btn></div>
          {topItems.map((i, n) => (
            <div key={i.id} className="row gap-3" style={{ padding: '8px 0', borderBottom: n < 4 ? '1px solid var(--line-soft)' : 'none' }}>
              <span className="num t-3" style={{ fontSize: 13, width: 18 }}>{n + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div className="t-3" style={{ fontSize: 11 }}>{i.brand} · {i.category}</div>
              </div>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>{D.moneyK(i.price * i.qty)}</span>
            </div>
          ))}
        </Card>
      </div>

      <Card>
        <div className="row between" style={{ marginBottom: 8 }}><h3 style={{ fontSize: 16 }}>Recent Activity</h3><Btn variant="plain" size="sm">Today</Btn></div>
        <div>
          {recent.map((r, i) => (
            <div key={i} className="row gap-3" style={{ padding: '12px 0', borderBottom: i < recent.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, display: 'grid', placeItems: 'center', background: `var(--${r.tone === 'blue' ? 'ac' : r.tone === 'green' ? 'ok' : 'warn'}-dim)`, color: `var(--${r.tone === 'blue' ? 'ac-bright' : r.tone === 'green' ? 'ok' : 'warn'})` }}><Icon n={r.icon} s={16} /></div>
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5 }}>{r.t}</div><div className="t-3" style={{ fontSize: 11.5 }}>by {r.who}</div></div>
              <span className="t-3 mono" style={{ fontSize: 11.5 }}>{r.time} ago</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
