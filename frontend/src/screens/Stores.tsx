/* NMS-Auto — Stores: Transfer, Adjustment, BIN Card, Live Stock, Price Control (API-backed) */
import { useEffect, useMemo, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { LineEditor } from '../components/doc'
import { api } from '../api'
import { branches as branchSeed, fmtDate } from '../data'
import type { EditorLine, Item } from '../types'
import type { Go } from './types'

export function LiveStockScreen({ go }: { go: Go }) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(''); const [stat, setStat] = useState('')

  useEffect(() => { api.items.list().then((d) => setItems(d as any)).finally(() => setLoading(false)) }, [])

  const f = items.filter((i) => (!q || (i.name + i.code).toLowerCase().includes(q.toLowerCase())) && (!stat || i.status === stat))
  return (
    <div>
      <PageHead crumbs="Stores" title="Live Stock" icon="box" sub="Real-time stock position across all branches"
        actions={<><Btn variant="solid" icon="excel">Export</Btn><Btn variant="primary" icon="swap" onClick={() => go('st/transfer')}>Transfer</Btn></>} />
      <div className="stat-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        {([
          { icon: 'box', label: 'Total SKUs', value: items.length, c: 'ac' },
          { icon: 'check', label: 'In Stock', value: items.filter((i) => i.status === 'in').length, c: 'green' },
          { icon: 'clock', label: 'Low Stock', value: items.filter((i) => i.status === 'low').length, c: 'warn' },
          { icon: 'x', label: 'Out of Stock', value: items.filter((i) => i.status === 'out').length, c: 'red' },
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
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Code' }, { label: 'Item' }, { label: 'Rack' }, ...branchSeed.map((b) => ({ label: b, align: 'right' as const })), { label: 'Total', align: 'right' }, { label: 'Reorder', align: 'right' }, { label: 'Status', align: 'center' }]}
          rows={f}
          render={(i) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
            <Td mono align="left">{i.rack}</Td>
            {(i.stockByBranch || [0, 0, 0]).map((s: number, bi: number) => <Td key={bi} align="right" mono c={s === 0 ? 'var(--tx-3)' : 'var(--tx-1)'}>{s}</Td>)}
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{i.qty}</Td>
            <Td align="right" mono c="var(--tx-3)">{i.reorder}</Td>
            <Td align="center"><Badge tone={i.status === 'out' ? 'red' : i.status === 'low' ? 'amber' : 'green'} dot>{i.status === 'out' ? 'Out' : i.status === 'low' ? 'Low' : 'In Stock'}</Badge></Td>
          </>} />}
      </Card>
    </div>
  )
}

export function TransferScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [lines, setLines] = useState<EditorLine[]>([]); const [from, setFrom] = useState('Main Store'); const [to, setTo] = useState('City Branch')

  const refresh = () => { setLoading(true); api.stockTransfers.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const create = async () => {
    await api.stockTransfers.create({ from, to, date: new Date().toISOString().slice(0, 10), items: lines.length, qty: lines.reduce((a, l) => a + l.qty, 0), status: 'In Transit', lines } as any)
    setModal(false); setLines([]); refresh()
  }
  return (
    <div>
      <PageHead crumbs="Stores" title="Stock Transfer" icon="swap" sub="Move stock between branches"
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Transfer</Btn>} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Transfer No' }, { label: 'From' }, { label: 'To' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Qty', align: 'right' }, { label: 'Status', align: 'center' }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)">{r.from}</Td>
            <Td><span className="row gap-2"><Icon n="chev" s={13} c="var(--tx-3)" />{r.to}</span></Td>
            <Td mono>{fmtDate(r.date)}</Td><Td align="right" mono>{r.items}</Td><Td align="right" mono>{r.qty}</Td>
            <Td align="center"><Badge tone={r.status === 'Completed' ? 'green' : 'amber'} dot>{r.status}</Badge></Td>
          </>} />}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={720} title="New Stock Transfer"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={create} disabled={!lines.length || from === to}>Create Transfer</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 40px 1fr', gap: 12, alignItems: 'end', marginBottom: 18 }}>
          <Field label="From Branch"><Select value={from} onChange={(e) => setFrom(e.target.value)}>{branchSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <div className="center" style={{ height: 38, color: 'var(--ac-bright)' }}><Icon n="swap" s={20} /></div>
          <Field label="To Branch"><Select value={to} onChange={(e) => setTo(e.target.value)}>{branchSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        </div>
        {from === to && <div style={{ fontSize: 12, color: 'var(--warn)', marginBottom: 12 }}>Source and destination must differ.</div>}
        <div className="eyebrow" style={{ marginBottom: 10 }}>Items to Transfer</div>
        <LineEditor lines={lines} setLines={setLines} mode="buy" />
      </Modal>
    </div>
  )
}

export function AdjustScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<any[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({ type: 'Increase' })

  const refresh = () => { setLoading(true); api.stockAdjustments.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh(); api.items.list().then((d) => setItems(d as any)).catch(() => {}) }, [])

  const save = async () => {
    const it = items.find((i) => i.id === form.item)
    await api.stockAdjustments.create({ item: it?.name || '', code: it?.code || '', type: form.type, qty: +form.qty || 0, reason: form.reason || '', date: new Date().toISOString().slice(0, 10), by: 'K. Bandara' } as any)
    setModal(false); setForm({ type: 'Increase' }); refresh()
  }
  return (
    <div>
      <PageHead crumbs="Stores" title="Stock Adjustment" icon="adjust" sub="Correct stock for counts, damage or write-offs"
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Adjustment</Btn>} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Ref' }, { label: 'Item' }, { label: 'Type', align: 'center' }, { label: 'Qty', align: 'right' }, { label: 'Reason' }, { label: 'By' }, { label: 'Date' }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.item}<span className="mono t-3" style={{ fontSize: 11, marginLeft: 8 }}>{r.code}</span></Td>
            <Td align="center"><Badge tone={r.type === 'Increase' ? 'green' : 'red'}>{r.type === 'Increase' ? '+ Increase' : '− Decrease'}</Badge></Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.qty}</Td>
            <Td>{r.reason}</Td><Td>{r.by}</Td><Td mono>{fmtDate(r.date)}</Td>
          </>} />}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={560} title="New Stock Adjustment"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save} disabled={!form.item}>Save Adjustment</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Item" full><Select value={form.item || ''} onChange={(e) => setForm((s: any) => ({ ...s, item: e.target.value }))}><option value="">Select item…</option>{items.map((i) => <option key={i.id} value={i.id}>{i.code} · {i.name}</option>)}</Select></Field>
          <Field label="Adjustment Type"><Select value={form.type} onChange={(e) => setForm((s: any) => ({ ...s, type: e.target.value }))}><option>Increase</option><option>Decrease</option></Select></Field>
          <Field label="Quantity"><Input type="number" value={form.qty || ''} onChange={(e) => setForm((s: any) => ({ ...s, qty: e.target.value }))} /></Field>
          <Field label="Reason" full><Select value={form.reason || ''} onChange={(e) => setForm((s: any) => ({ ...s, reason: e.target.value }))}><option value="">Select…</option>{['Stock count correction', 'Damaged', 'Expired', 'Sample issue', 'Theft / loss', 'Found stock'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        </div>
      </Modal>
    </div>
  )
}

export function BinCardScreen({ go: _go }: { go: Go }) {
  const [items, setItems] = useState<Item[]>([])
  const [sel, setSel] = useState<Item | null>(null)

  useEffect(() => { api.items.list().then((d: any[]) => { setItems(d); if (d.length) setSel(d[0]) }).catch(() => {}) }, [])

  const ledger = useMemo(() => {
    if (!sel) return []
    const start = sel.qty
    return [{ date: '', ref: 'Current', type: 'Opening', in: 0, out: 0, bal: start }]
  }, [sel])

  if (!sel) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div>
  return (
    <div>
      <PageHead crumbs="Stores" title="BIN Card" icon="list" sub="Item-wise stock movement ledger"
        actions={<Btn variant="solid" icon="print">Print BIN Card</Btn>} />
      <div className="bin-grid" style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
        <Card pad={0}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Select Item</div>
          <div style={{ maxHeight: 520, overflowY: 'auto' }}>
            {items.slice(0, 30).map((i) => (
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
              <Td mono>{fmtDate(r.date) || '—'}</Td>
              <Td mono c="var(--tx-3)">{r.ref}</Td>
              <Td><Badge tone="neutral">{r.type}</Badge></Td>
              <Td align="right" mono c="var(--tx-3)">{r.in || '—'}</Td>
              <Td align="right" mono c="var(--tx-3)">{r.out || '—'}</Td>
              <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 700 }}>{r.bal}</Td>
            </>} />
        </Card>
      </div>
    </div>
  )
}

export function PriceScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [edit, setEdit] = useState<Record<string, string>>({})

  const refresh = () => { setLoading(true); api.items.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const setP = (id: string, v: string) => setEdit((s) => ({ ...s, [id]: v }))
  const apply = async (id: string) => {
    const row = rows.find((r) => r.id === id)
    if (!row) return
    await api.items.update(id, { ...row, price: +edit[id] || row.price } as any)
    setEdit((s) => { const n = { ...s }; delete n[id]; return n })
    refresh()
  }
  return (
    <div>
      <PageHead crumbs="Stores" title="Price Control" icon="tag" sub="Manage selling prices and margins"
        actions={<Btn variant="solid" icon="excel">Export Price List</Btn>} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Code' }, { label: 'Item' }, { label: 'Avg Cost', align: 'right' }, { label: 'FIFO Cost', align: 'right' }, { label: 'Selling Price', align: 'right' }, { label: 'Margin', align: 'right' }, { label: '', align: 'right', w: 100 }]}
          rows={rows}
          render={(i) => {
            const np = edit[i.id] != null ? +edit[i.id] : i.price
            const margin = np ? Math.round(((np - i.avgCost) / np) * 100) : 0
            return <>
              <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
              <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
              <Td align="right" mono>{(i.avgCost || 0).toLocaleString()}</Td>
              <Td align="right" mono>{(i.fifoCost || 0).toLocaleString()}</Td>
              <Td align="right"><input type="number" value={edit[i.id] != null ? edit[i.id] : i.price} onChange={(e) => setP(i.id, e.target.value)} style={{ ...inputStyle, width: 110, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono', fontWeight: 600, borderColor: edit[i.id] != null ? 'var(--ac)' : 'var(--line)' }} /></Td>
              <Td align="right"><Badge tone={margin < 10 ? 'red' : margin < 20 ? 'amber' : 'green'}>{margin}%</Badge></Td>
              <Td align="right">{edit[i.id] != null && <Btn variant="primary" size="sm" icon="check" onClick={() => apply(i.id)}>Apply</Btn>}</Td>
            </>
          }} />}
      </Card>
    </div>
  )
}
