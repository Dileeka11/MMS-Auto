/* NMS-Auto — Stores: Transfer, Adjustment, BIN Card, Live Stock, Price Control, ported from stores.jsx */
import { useState, useMemo } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { LineEditor } from '../components/doc'
import DB from '../data'
import type { EditorLine, Item } from '../types'
import type { Go } from './types'

const D = DB

export function LiveStockScreen({ go }: { go: Go }) {
  const [q, setQ] = useState(''); const [stat, setStat] = useState('')
  const f = D.items.filter((i) => (!q || (i.name + i.code).toLowerCase().includes(q.toLowerCase())) && (!stat || i.status === stat))
  return (
    <div>
      <PageHead crumbs="Stores" title="Live Stock" icon="box" sub="Real-time stock position across all branches"
        actions={<><Btn variant="solid" icon="excel">Export</Btn><Btn variant="primary" icon="swap" onClick={() => go('st/transfer')}>Transfer</Btn></>} />
      <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {([
          { icon: 'box', label: 'Total SKUs', value: D.items.length, c: 'ac' },
          { icon: 'check', label: 'In Stock', value: D.items.filter((i) => i.status === 'in').length, c: 'green' },
          { icon: 'clock', label: 'Low Stock', value: D.items.filter((i) => i.status === 'low').length, c: 'warn' },
          { icon: 'x', label: 'Out of Stock', value: D.items.filter((i) => i.status === 'out').length, c: 'red' },
        ]).map((s, i) => (
          <Card key={i} pad={16}>
            <div className="row gap-2" style={{ marginBottom: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: `var(--${s.c}-dim)`, display: 'grid', placeItems: 'center', color: `var(--${s.c === 'ac' ? 'ac-bright' : s.c})` }}><Icon n={s.icon} s={16} /></div>
              <span className="eyebrow" style={{ fontSize: 10 }}>{s.label}</span>
            </div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira' }}>{s.value}</div>
          </Card>
        ))}
      </div>
      <Card pad={0}>
        <div className="row between wrap gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 300, maxWidth: '55vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search stock…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
          <div style={{ width: 130 }}><Select value={stat} onChange={(e) => setStat(e.target.value)}><option value="">All Status</option><option value="in">In Stock</option><option value="low">Low</option><option value="out">Out</option></Select></div>
        </div>
        <Table cols={[{ label: 'Code' }, { label: 'Item' }, { label: 'Rack' }, ...D.branches.map((b) => ({ label: b, align: 'right' as const })), { label: 'Total', align: 'right' }, { label: 'Reorder', align: 'right' }, { label: 'Status', align: 'center' }]}
          rows={f}
          render={(i) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
            <Td mono align="left">{i.rack}</Td>
            {i.stockByBranch.map((s, bi) => <Td key={bi} align="right" mono c={s === 0 ? 'var(--tx-3)' : 'var(--tx-1)'}>{s}</Td>)}
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{i.qty}</Td>
            <Td align="right" mono c="var(--tx-3)">{i.reorder}</Td>
            <Td align="center"><Badge tone={i.status === 'out' ? 'red' : i.status === 'low' ? 'amber' : 'green'} dot>{i.status === 'out' ? 'Out' : i.status === 'low' ? 'Low' : 'In Stock'}</Badge></Td>
          </>} />
      </Card>
    </div>
  )
}

export function TransferScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState([
    { id: 'TRF-201', from: 'Main Store', to: 'City Branch', date: '2026-06-08', items: 4, qty: 38, status: 'Completed' },
    { id: 'TRF-202', from: 'Main Store', to: 'Highway Depot', date: '2026-06-07', items: 2, qty: 15, status: 'In Transit' },
    { id: 'TRF-203', from: 'City Branch', to: 'Main Store', date: '2026-06-05', items: 6, qty: 52, status: 'Completed' },
  ])
  const [modal, setModal] = useState(false); const [lines, setLines] = useState<EditorLine[]>([]); const [from, setFrom] = useState('Main Store'); const [to, setTo] = useState('City Branch')
  const create = () => { setRows((r) => [{ id: 'TRF-' + (204 + r.length), from, to, date: '2026-06-09', items: lines.length, qty: lines.reduce((a, l) => a + l.qty, 0), status: 'In Transit' }, ...r]); setModal(false); setLines([]) }
  return (
    <div>
      <PageHead crumbs="Stores" title="Stock Transfer" icon="swap" sub="Move stock between branches"
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Transfer</Btn>} />
      <Card pad={0}>
        <Table cols={[{ label: 'Transfer No' }, { label: 'From' }, { label: 'To' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Qty', align: 'right' }, { label: 'Status', align: 'center' }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)">{r.from}</Td>
            <Td><span className="row gap-2"><Icon n="chev" s={13} c="var(--tx-3)" />{r.to}</span></Td>
            <Td mono>{r.date}</Td><Td align="right" mono>{r.items}</Td><Td align="right" mono>{r.qty}</Td>
            <Td align="center"><Badge tone={r.status === 'Completed' ? 'green' : 'amber'} dot>{r.status}</Badge></Td>
          </>} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={720} title="New Stock Transfer"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={create} disabled={!lines.length || from === to}>Create Transfer</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 12, alignItems: 'end', marginBottom: 18 }}>
          <Field label="From Branch"><Select value={from} onChange={(e) => setFrom(e.target.value)}>{D.branches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <div className="center" style={{ height: 38, color: 'var(--ac-bright)' }}><Icon n="swap" s={20} /></div>
          <Field label="To Branch"><Select value={to} onChange={(e) => setTo(e.target.value)}>{D.branches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        </div>
        {from === to && <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 12 }}>Source and destination must differ.</div>}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Items to Transfer</div>
        <LineEditor lines={lines} setLines={setLines} mode="buy" />
      </Modal>
    </div>
  )
}

export function AdjustScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState([
    { id: 'ADJ-101', item: 'Brake Pad Set Front', code: 'BP-2201', type: 'Increase', qty: 5, reason: 'Stock count correction', date: '2026-06-08', by: 'K. Bandara' },
    { id: 'ADJ-102', item: 'Oil Filter', code: 'OF-1120', type: 'Decrease', qty: 3, reason: 'Damaged', date: '2026-06-06', by: 'K. Bandara' },
    { id: 'ADJ-103', item: 'Spark Plug Iridium', code: 'SP-7781', type: 'Decrease', qty: 2, reason: 'Sample issue', date: '2026-06-04', by: 'K. Bandara' },
  ])
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({ type: 'Increase' })
  const save = () => { const it = D.items.find((i) => i.id === form.item); setRows((r) => [{ id: 'ADJ-' + (104 + r.length), item: it?.name || '', code: it?.code || '', type: form.type, qty: +form.qty || 0, reason: form.reason || '', date: '2026-06-09', by: 'K. Bandara' }, ...r]); setModal(false); setForm({ type: 'Increase' }) }
  return (
    <div>
      <PageHead crumbs="Stores" title="Stock Adjustment" icon="adjust" sub="Correct stock for counts, damage or write-offs"
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Adjustment</Btn>} />
      <Card pad={0}>
        <Table cols={[{ label: 'Ref' }, { label: 'Item' }, { label: 'Type', align: 'center' }, { label: 'Qty', align: 'right' }, { label: 'Reason' }, { label: 'By' }, { label: 'Date' }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.item}<span className="mono t-3" style={{ fontSize: 11, marginLeft: 8 }}>{r.code}</span></Td>
            <Td align="center"><Badge tone={r.type === 'Increase' ? 'green' : 'red'}>{r.type === 'Increase' ? '+ Increase' : '− Decrease'}</Badge></Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.qty}</Td>
            <Td>{r.reason}</Td><Td>{r.by}</Td><Td mono>{r.date}</Td>
          </>} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={560} title="New Stock Adjustment"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save} disabled={!form.item}>Save Adjustment</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Item" full><Select value={form.item || ''} onChange={(e) => setForm((s: any) => ({ ...s, item: e.target.value }))}><option value="">Select item…</option>{D.items.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</Select></Field>
          <Field label="Adjustment Type"><Select value={form.type} onChange={(e) => setForm((s: any) => ({ ...s, type: e.target.value }))}><option>Increase</option><option>Decrease</option></Select></Field>
          <Field label="Quantity"><Input type="number" value={form.qty || ''} onChange={(e) => setForm((s: any) => ({ ...s, qty: e.target.value }))} /></Field>
          <Field label="Reason" full><Select value={form.reason || ''} onChange={(e) => setForm((s: any) => ({ ...s, reason: e.target.value }))}><option value="">Select…</option>{['Stock count correction', 'Damaged', 'Expired', 'Sample issue', 'Theft / loss', 'Found stock'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        </div>
      </Modal>
    </div>
  )
}

export function BinCardScreen({ go: _go }: { go: Go }) {
  const [sel, setSel] = useState<Item>(D.items[0])
  const ledger = useMemo(() => {
    const evs: [string, string, number, number][] = [['GRN-7700', 'GRN', 30, 0], ['INV-5501', 'Sales', 0, 8], ['INV-5503', 'Sales', 0, 5], ['TRF-202', 'Transfer Out', 0, 6], ['GRN-7702', 'GRN', 15, 0], ['ADJ-102', 'Adjustment', 0, 3], ['INV-5508', 'Sales', 0, 4]]
    const start = sel.qty - evs.reduce((a, e) => a + e[2] - e[3], 0)
    let run = start
    const rows = [{ date: '2026-06-01', ref: 'Opening', type: 'Opening', in: 0, out: 0, bal: run }]
    const dates = ['2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08']
    evs.forEach((e, i) => { run += e[2] - e[3]; rows.push({ date: dates[i], ref: e[0], type: e[1], in: e[2], out: e[3], bal: run }) })
    return rows
  }, [sel])
  return (
    <div>
      <PageHead crumbs="Stores" title="BIN Card" icon="list" sub="Item-wise stock movement ledger"
        actions={<Btn variant="solid" icon="print">Print BIN Card</Btn>} />
      <div className="bin-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        <Card pad={0}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Select Item</div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {D.items.slice(0, 14).map((i) => (
              <button key={i.id} onClick={() => setSel(i)} className="mms-row" style={{ display: 'block', width: '100%', padding: '11px 16px', background: sel.id === i.id ? 'var(--ac-dim)' : 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', borderLeft: '3px solid ' + (sel.id === i.id ? 'var(--ac)' : 'transparent'), textAlign: 'left', color: 'var(--tx-0)' }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{i.name}</div><div className="mono t-3" style={{ fontSize: 11 }}>{i.code} · {i.rack}</div>
              </button>
            ))}
          </div>
        </Card>
        <Card pad={0}>
          <div className="row between wrap gap-3" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
            <div><div className="eyebrow">BIN Card</div><h3 style={{ fontSize: 18, marginTop: 3 }}>{sel.name}</h3><div className="t-2 mono" style={{ fontSize: 12, marginTop: 2 }}>{sel.code} · Rack {sel.rack} · {sel.unit}</div></div>
            <div style={{ textAlign: 'right' }}><div className="t-2" style={{ fontSize: 11.5 }}>Current Balance</div><div className="num" style={{ fontSize: 26, fontWeight: 700, fontFamily: 'Saira', color: 'var(--ac-bright)' }}>{sel.qty}</div></div>
          </div>
          <Table cols={[{ label: 'Date' }, { label: 'Reference' }, { label: 'Type' }, { label: 'In', align: 'right' }, { label: 'Out', align: 'right' }, { label: 'Balance', align: 'right' }]}
            rows={ledger}
            render={(r) => <>
              <Td mono>{r.date}</Td>
              <Td mono c={r.ref === 'Opening' ? 'var(--tx-3)' : 'var(--ac-bright)'}>{r.ref}</Td>
              <Td><Badge tone={r.type === 'GRN' ? 'green' : r.type === 'Sales' ? 'blue' : r.type === 'Opening' ? 'neutral' : 'amber'}>{r.type}</Badge></Td>
              <Td align="right" mono c={r.in ? 'var(--ok)' : 'var(--tx-3)'} style={{ fontWeight: r.in ? 600 : 400 }}>{r.in || '—'}</Td>
              <Td align="right" mono c={r.out ? 'var(--bad)' : 'var(--tx-3)'} style={{ fontWeight: r.out ? 600 : 400 }}>{r.out || '—'}</Td>
              <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{r.bal}</Td>
            </>} />
        </Card>
      </div>
    </div>
  )
}

export function PriceScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Item[]>(D.items)
  const [edit, setEdit] = useState<Record<string, string>>({})
  const setP = (id: string, v: string) => setEdit((s) => ({ ...s, [id]: v }))
  const apply = (id: string) => { setRows((r) => r.map((x) => (x.id === id ? { ...x, price: +edit[id] || x.price } : x))); setEdit((s) => { const n = { ...s }; delete n[id]; return n }) }
  return (
    <div>
      <PageHead crumbs="Stores" title="Price Control" icon="tag" sub="Manage selling prices and margins"
        actions={<Btn variant="solid" icon="excel">Export Price List</Btn>} />
      <div className="info-banner row gap-2" style={{ padding: '10px 14px', background: 'var(--ac-dim)', border: '1px solid var(--ac-line)', borderRadius: 'var(--r-s)', marginBottom: 16, fontSize: 12.5, color: 'var(--ac-bright)' }}>
        <Icon n="bolt" s={16} /><span>Edit a selling price inline; margin recalculates against average cost. Click <b>Apply</b> to commit.</span>
      </div>
      <Card pad={0}>
        <Table cols={[{ label: 'Code' }, { label: 'Item' }, { label: 'Avg Cost', align: 'right' }, { label: 'FIFO Cost', align: 'right' }, { label: 'Selling Price', align: 'right' }, { label: 'Margin', align: 'right' }, { label: '', align: 'right', w: 100 }]}
          rows={rows}
          render={(i) => {
            const np = edit[i.id] != null ? +edit[i.id] : i.price
            const margin = np ? Math.round(((np - i.avgCost) / np) * 100) : 0
            return <>
              <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
              <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
              <Td align="right" mono>{i.avgCost.toLocaleString()}</Td>
              <Td align="right" mono>{i.fifoCost.toLocaleString()}</Td>
              <Td align="right"><input type="number" value={edit[i.id] != null ? edit[i.id] : i.price} onChange={(e) => setP(i.id, e.target.value)} style={{ ...inputStyle, width: 110, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600, borderColor: edit[i.id] != null ? 'var(--ac)' : 'var(--line)' }} /></Td>
              <Td align="right"><Badge tone={margin < 10 ? 'red' : margin < 20 ? 'amber' : 'green'}>{margin}%</Badge></Td>
              <Td align="right">{edit[i.id] != null && <Btn variant="primary" size="sm" icon="check" onClick={() => apply(i.id)}>Apply</Btn>}</Td>
            </>
          }} />
      </Card>
    </div>
  )
}
