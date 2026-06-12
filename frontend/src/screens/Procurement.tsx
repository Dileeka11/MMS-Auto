/* MMS-Auto — Procurement (Purchase Order + GRN), ported from procurement.jsx */
import { useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, statusTone, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow, LineEditor } from '../components/doc'
import DB from '../data'
import type { EditorLine, PurchaseOrder } from '../types'
import type { Go } from './types'

const D = DB

export function POScreen({ go }: { go: Go }) {
  const [rows, setRows] = useState<PurchaseOrder[]>(D.purchaseOrders)
  const [modal, setModal] = useState(false); const [view, setView] = useState<PurchaseOrder | null>(null)
  const [supplier, setSupplier] = useState(''); const [lines, setLines] = useState<EditorLine[]>([])
  const create = () => {
    const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
    setRows((r) => [{ id: 'PO-' + (4500 + r.length), supplier, date: '2026-06-09', lines: lines.map((l) => ({ item: l.name, code: l.code, qty: l.qty, cost: l.rate, total: l.qty * l.rate })), total, status: 'Pending' }, ...r])
    setModal(false); setLines([]); setSupplier('')
  }
  const pending = rows.filter((r) => r.status === 'Pending').length
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Purchase Order" icon="cart" sub={`${rows.length} orders · ${pending} pending approval`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Purchase Order</Btn>} />
      <StatRow items={[
        { icon: 'cart', label: 'Open Orders', value: rows.filter((r) => r.status !== 'Completed').length, c: 'ac' },
        { icon: 'clock', label: 'Pending Approval', value: pending, c: 'warn', sub: 'awaiting authorisation' },
        { icon: 'truck', label: 'Partial GRN', value: rows.filter((r) => r.status === 'Partial GRN').length, c: 'ac' },
        { icon: 'coins', label: 'Order Value', value: D.moneyK(rows.reduce((a, r) => a + r.total, 0)), c: 'green' },
      ]} />
      <Card pad={0}>
        <Table cols={[{ label: 'PO No' }, { label: 'Supplier' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Total', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 120 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.supplier}</Td>
            <Td mono>{r.date}</Td>
            <Td align="right" mono>{r.lines.length}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{D.money(r.total)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" onClick={() => setView(r)}><Icon n="eye" s={15} /></button>
              {r.status !== 'Completed' && <Btn variant="ghost" size="sm" onClick={() => go('dc/grn')}>Make GRN</Btn>}
            </div></Td>
          </>} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} width={760} title="New Purchase Order" sub="Raise an order to a supplier"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={create} disabled={!supplier || !lines.length}>Create PO</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
          <Field label="Supplier"><Select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Select supplier…</option>{D.suppliers.map((s) => <option key={s}>{s}</option>)}</Select></Field>
          <Field label="Expected Date"><Input type="date" defaultValue="2026-06-16" /></Field>
        </div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Order Lines</div>
        <LineEditor lines={lines} setLines={setLines} mode="buy" />
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} width={620} title={view?.id} sub={view?.supplier + ' · ' + view?.date}
        footer={<><Badge tone={statusTone(view?.status || '')}>{view?.status}</Badge><Btn variant="primary" icon="print">Print PO</Btn></>}>
        {view && (
          <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ background: 'var(--bg-0)' }}>{['Code', 'Item', 'Qty', 'Cost', 'Total'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
              <tbody>{view.lines.map((l, i) => (
                <tr key={i}>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono t-2">{l.code}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' }}>{l.item}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }} className="mono">{l.qty}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }} className="mono">{D.money(l.cost)}</td>
                  <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right', fontWeight: 600 }} className="mono">{D.money(l.total)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}

export function GRNScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState(D.grns)
  const [modal, setModal] = useState(false); const [step, setStep] = useState(1)
  const [po, setPo] = useState<PurchaseOrder | null>(null); const [recv, setRecv] = useState<Record<number, number>>({})
  const openPOs = D.purchaseOrders.filter((p) => p.status !== 'Completed')
  const choose = (p: PurchaseOrder) => { setPo(p); const r: Record<number, number> = {}; p.lines.forEach((l, i) => (r[i] = l.qty)); setRecv(r); setStep(2) }
  const post = () => {
    const total = po!.lines.reduce((a, l, i) => a + (recv[i] || 0) * l.cost, 0)
    setRows((r) => [{ id: 'GRN-' + (7800 + r.length), po: po!.id, supplier: po!.supplier, date: '2026-06-09', items: po!.lines.length, total, status: 'Posted' }, ...r])
    setModal(false); setStep(1); setPo(null)
  }
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Goods Received Note" icon="truck" sub={`${rows.length} GRNs · select a Purchase Order to receive stock`}
        actions={<Btn variant="primary" icon="plus" onClick={() => { setModal(true); setStep(1) }}>Add GRN</Btn>} />
      <StatRow items={[
        { icon: 'truck', label: 'GRNs Posted', value: rows.filter((r) => r.status === 'Posted').length, c: 'green' },
        { icon: 'doc', label: 'Draft', value: rows.filter((r) => r.status === 'Draft').length, c: 'warn' },
        { icon: 'cart', label: 'POs Awaiting Receipt', value: openPOs.length, c: 'ac' },
        { icon: 'box', label: 'Received Value', value: D.moneyK(rows.reduce((a, r) => a + r.total, 0)), c: 'green' },
      ]} />
      <Card pad={0}>
        <Table cols={[{ label: 'GRN No' }, { label: 'Against PO' }, { label: 'Supplier' }, { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Value', align: 'right' }, { label: 'Status', align: 'center' }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td mono>{r.po}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.supplier}</Td>
            <Td mono>{r.date}</Td>
            <Td align="right" mono>{r.items}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{D.money(r.total)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
          </>} />
      </Card>

      <Modal open={modal} onClose={() => { setModal(false); setStep(1) }} width={760}
        title={step === 1 ? 'Add GRN — Select Purchase Order' : 'Receive Goods · ' + po?.id}
        sub={step === 1 ? 'Choose an open PO to receive against' : po?.supplier}
        footer={step === 2 ? <><Btn variant="plain" onClick={() => setStep(1)} icon="chev" style={{ flexDirection: 'row-reverse' }}>Back</Btn><Btn variant="primary" icon="check" onClick={post}>Post GRN &amp; Update Stock</Btn></> : <Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn>}>
        {step === 1 ? (
          <div className="col gap-2">
            {openPOs.map((p) => (
              <button key={p.id} onClick={() => choose(p)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
                <div className="row gap-3">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="cart" s={17} /></div>
                  <div>
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{p.id}</span><Badge tone={statusTone(p.status)}>{p.status}</Badge></div>
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{p.supplier} · {p.lines.length} items · {p.date}</div>
                  </div>
                </div>
                <div className="row gap-3"><span className="num" style={{ fontWeight: 600 }}>{D.money(p.total)}</span><Icon n="chev" s={16} c="var(--tx-3)" /></div>
              </button>
            ))}
          </div>
        ) : (
          <div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg-0)' }}>{['Code', 'Item', 'Ordered', 'Receiving Now'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
                <tbody>{po!.lines.map((l, i) => (
                  <tr key={i}>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono t-2">{l.code}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', fontWeight: 500 }}>{l.item}</td>
                    <td style={{ padding: '8px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }} className="mono">{l.qty}</td>
                    <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                      <input type="number" value={recv[i] || 0} max={l.qty} onChange={(e) => setRecv((s) => ({ ...s, [i]: Math.min(l.qty, Math.max(0, +e.target.value)) }))} style={{ ...inputStyle, width: 80, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="info-banner row gap-2" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--ok-dim)', border: '1px solid var(--ok)', borderRadius: 'var(--r-s)', fontSize: 12.5, color: 'var(--ok)' }}>
              <Icon n="check" s={16} /><span>Posting will increase stock and recalculate <b>Average Cost</b> automatically.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
