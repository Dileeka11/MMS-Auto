/* NMS-Auto — Dashboard (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge } from '../components/ui'
import { Icon } from '../components/Icon'
import { AreaChart, Donut, Spark, ProgressRow } from '../components/charts'
import { api } from '../api'
import { moneyK } from '../data'
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
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.dashboard().then((d) => { setData(d); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading dashboard…</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--bad)' }}>Failed to load dashboard.</div>

  const kpis = data.kpis || {}
  const lowStock = data.lowStock || []
  const topItems = data.topItems || []
  const reps = data.reps || []
  const trend = (data.salesTrend || []) as { label: string; value: number }[]

  const catPalette = ['var(--ac)', 'var(--ok)', 'var(--warn)', 'var(--info)', '#8b5cf6', '#ec4899', '#14b8a6', 'var(--tx-3)']
  const catData = ((data.stockByCategory || []) as { label: string; value: number | string }[])
    .map((c, i) => ({ label: c.label || 'Uncategorized', value: Number(c.value) || 0, color: catPalette[i % catPalette.length] }))
    .filter((c) => c.value > 0)

  const now = new Date()
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' })
  const today = `${weekday}, ${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getFullYear()).slice(-2)}`

  return (
    <div>
      <PageHead crumbs="Overview" title="Dashboard" sub={`${today} · Main Store`}
        actions={<><Btn variant="solid" size="md" icon="download">Export</Btn><Btn variant="primary" size="md" icon="plus" onClick={() => go('dc/invoice')}>New Invoice</Btn></>} />

      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
        <KPI icon="coins" label="Sales · this month" value={moneyK(kpis.salesMonth || 0)} tone="blue" />
        <KPI icon="chart" label="Gross profit · this month" value={moneyK(kpis.grossProfit || 0)} tone="green" />
        <KPI icon="wallet" label="Receivables" value={moneyK(kpis.receivables || 0)} tone="amber" />
        <KPI icon="box" label="Stock value" value={moneyK(kpis.stockValue || 0)} tone="blue" />
      </div>

      <div className="dash-2col" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div className="row between" style={{ marginBottom: 18 }}>
            <div><div className="eyebrow">Performance</div><h3 style={{ fontSize: 18, marginTop: 3 }}>Sales overview · 12 months</h3></div>
          </div>
          {trend.length > 0 && trend.some((t) => t.value > 0) ? (
            <AreaChart
              height={180}
              labels={trend.map((t) => t.label)}
              series={[{ data: trend.map((t) => t.value), color: 'var(--ac-bright)' }]}
              format={(v) => moneyK(v)}
            />
          ) : <div className="t-3" style={{ padding: 20 }}>No sales recorded yet</div>}
          <div style={{ marginTop: 12 }}>
            <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}><span className="t-2">Total SKUs</span><span className="num" style={{ fontWeight: 700 }}>{kpis.totalSkus || 0}</span></div>
            <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}><span className="t-2">Out of stock</span><span className="num" style={{ fontWeight: 700, color: 'var(--bad)' }}>{kpis.outOfStock || 0}</span></div>
            <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}><span className="t-2">Low stock</span><span className="num" style={{ fontWeight: 700, color: 'var(--warn)' }}>{kpis.lowStock || 0}</span></div>
            <div className="row between" style={{ padding: '10px 0', borderTop: '1px solid var(--line-soft)' }}><span className="t-2">Pending returns</span><span className="num" style={{ fontWeight: 700 }}>{data.pendingReturns || 0}</span></div>
          </div>
        </Card>
        <Card>
          <div className="eyebrow">Inventory mix</div><h3 style={{ fontSize: 18, marginTop: 3, marginBottom: 18 }}>Stock by Category</h3>
          {catData.length > 0 ? (
            <Donut center={catData.length} data={catData.slice(0, 6)} />
          ) : <div className="t-3" style={{ padding: 20 }}>No stock on hand</div>}
        </Card>
      </div>

      <div className="dash-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16 }}>Sales Reps</h3><Btn variant="plain" size="sm" iconR="chev" onClick={() => go('ad/reps')}>View</Btn></div>
          {reps.length === 0 && <div className="t-3" style={{ padding: 10 }}>No reps yet</div>}
          {reps.map((r: any) => <ProgressRow key={r.id} label={r.name} value={r.achieved || 0} max={r.target || 1} color={(r.achieved || 0) >= (r.target || 0) ? 'var(--ok)' : 'var(--ac)'} right={Math.round(((r.achieved || 0) / (r.target || 1)) * 100) + '%'} />)}
        </Card>
        <Card>
          <div className="row between" style={{ marginBottom: 16 }}><h3 style={{ fontSize: 16 }}>Low / Out of Stock</h3><Badge tone="red">{lowStock.length} alerts</Badge></div>
          <div className="col gap-2">
            {lowStock.length === 0 && <div className="t-3" style={{ padding: 10 }}>All stock OK</div>}
            {lowStock.map((i: any) => (
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
          {topItems.length === 0 && <div className="t-3" style={{ padding: 10 }}>No items yet</div>}
          {topItems.map((i: any, n: number) => (
            <div key={i.id} className="row gap-3" style={{ padding: '8px 0', borderBottom: n < topItems.length - 1 ? '1px solid var(--line-soft)' : 'none' }}>
              <span className="num t-3" style={{ fontSize: 13, width: 18 }}>{n + 1}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                <div className="t-3" style={{ fontSize: 11 }}>{i.brand} · {i.category}</div>
              </div>
              <span className="num" style={{ fontSize: 12.5, fontWeight: 600 }}>{moneyK((i.price || 0) * (i.qty || 0))}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}
