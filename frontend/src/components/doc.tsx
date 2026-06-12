/* MMS-Auto — shared document helpers (StatRow, LineEditor), from procurement.jsx */
import { useState } from 'react'
import { Card, Badge, Select, inputStyle } from './ui'
import { Icon } from './Icon'
import DB from '../data'
import type { EditorLine } from '../types'

const D = DB

export interface Stat { icon: string; label: string; value: string | number; c?: string; sub?: string }

export function StatRow({ items }: { items: Stat[] }) {
  return (
    <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: `repeat(${items.length},1fr)`, gap: 14, marginBottom: 18 }}>
      {items.map((s, i) => (
        <Card key={i} pad={16}>
          <div className="row gap-2" style={{ marginBottom: 8 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: `var(--${s.c || 'ac'}-dim)`, display: 'grid', placeItems: 'center', color: `var(--${s.c === 'ac' ? 'ac-bright' : s.c || 'ac-bright'})` }}><Icon n={s.icon} s={16} /></div>
            <span className="eyebrow" style={{ fontSize: 10 }}>{s.label}</span>
          </div>
          <div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira' }}>{s.value}</div>
          {s.sub && <div className="t-2" style={{ fontSize: 11.5, marginTop: 2 }}>{s.sub}</div>}
        </Card>
      ))}
    </div>
  )
}

export function LineEditor({ lines, setLines, mode = 'buy', perLineCost }: { lines: EditorLine[]; setLines: (fn: (l: EditorLine[]) => EditorLine[]) => void; mode?: 'buy' | 'sell'; perLineCost?: boolean }) {
  const [search, setSearch] = useState('')
  const add = (it: typeof D.items[number]) => {
    if (lines.some((l) => l.id === it.id)) return
    setLines((l) => [...l, { id: it.id, code: it.code, name: it.name, qty: 1, rate: mode === 'buy' ? it.avgCost : it.price, cost: it.avgCost, fifo: it.fifoCost, avg: it.avgCost, method: 'FIFO', max: it.qty }])
    setSearch('')
  }
  const upd = (id: string, k: keyof EditorLine, v: any) => setLines((l) => l.map((x) => (x.id === id ? { ...x, [k]: v } : x)))
  const rm = (id: string) => setLines((l) => l.filter((x) => x.id !== id))
  const results = search ? D.items.filter((i) => (i.name + i.code).toLowerCase().includes(search.toLowerCase())).slice(0, 6) : []
  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  return (
    <div>
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '9px 12px' }}>
          <Icon n="search" s={16} c="var(--tx-2)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search part to add (code or name)…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
        </div>
        {results.length > 0 && (
          <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20, marginTop: 4, background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', boxShadow: 'var(--sh-2)', overflow: 'hidden' }}>
            {results.map((it) => (
              <button key={it.id} onClick={() => add(it)} className="row between" style={{ width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--line-soft)', padding: '9px 12px', textAlign: 'left', color: 'var(--tx-0)' }}>
                <span className="row gap-2"><span className="mono t-3" style={{ fontSize: 11, width: 64 }}>{it.code}</span><span style={{ fontSize: 13 }}>{it.name}</span></span>
                <span className="row gap-3"><Badge tone={it.status === 'out' ? 'red' : it.status === 'low' ? 'amber' : 'green'}>{it.qty} {it.unit}</Badge><span className="mono t-2" style={{ fontSize: 12 }}>{D.money(mode === 'buy' ? it.avgCost : it.price)}</span></span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ background: 'var(--bg-0)' }}>
            {['Code', 'Item', 'Qty', 'Rate'].concat(perLineCost ? ['Cost Method'] : []).concat(['Amount', '']).map((h, i) => (
              <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 && i < (perLineCost ? 5 : 4) ? 'right' : 'left', fontSize: 10.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {lines.length === 0 && <tr><td colSpan={perLineCost ? 7 : 6} style={{ padding: 28, textAlign: 'center', color: 'var(--tx-3)', fontSize: 12.5 }}>No items added — search above to add parts</td></tr>}
            {lines.map((l) => (
              <tr key={l.id}>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' }}><span className="mono t-2" style={{ fontSize: 12 }}>{l.code}</span></td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', fontWeight: 500 }}>{l.name}</td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                  <input type="number" value={l.qty} min={1} onChange={(e) => upd(l.id, 'qty', Math.max(1, +e.target.value))} style={{ ...inputStyle, width: 64, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                </td>
                <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                  <input type="number" value={l.rate} onChange={(e) => upd(l.id, 'rate', +e.target.value)} style={{ ...inputStyle, width: 90, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                </td>
                {perLineCost && (
                  <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                    <div style={{ width: 140, marginLeft: 'auto' }}>
                      <Select value={l.method} onChange={(e) => upd(l.id, 'method', e.target.value)} style={{ padding: '5px 8px', fontSize: 12 }}>
                        <option value="FIFO">FIFO · {D.money(l.fifo)}</option>
                        <option value="Average">Avg · {D.money(l.avg)}</option>
                      </Select>
                    </div>
                  </td>
                )}
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600 }}>{D.money(l.qty * l.rate)}</td>
                <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                  <button className="mms-act danger" onClick={() => rm(l.id)}><Icon n="x" s={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row between" style={{ marginTop: 14, padding: '10px 4px' }}>
        <span className="t-2" style={{ fontSize: 12.5 }}>{lines.length} line item{lines.length !== 1 ? 's' : ''}</span>
        <div className="row gap-4">
          <span className="t-2" style={{ fontSize: 13 }}>Sub-total</span>
          <span className="num" style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Saira' }}>{D.money(total)}</span>
        </div>
      </div>
    </div>
  )
}
