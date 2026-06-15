/* NMS-Auto — Procurement
   Four screens that share the PO → Costing → GRN → Tracking flow:
     POScreen        : raise a PO (basic details + Excel upload of items)
     CostingScreen   : pick a PO, upload costing Excel, create a shipment
     GRNScreen       : pick PO + Shipment, receive items, update stock
     TrackingScreen  : balance + shipment status dashboard */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, PageHead, Btn, Badge, Field, Input, Select, Modal,
  Table, Td, statusTone, inputStyle,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow } from '../components/doc'
import DB from '../data'
import { api } from '../api'
import { parsePoExcel, parseCostingExcel, fileToBase64, type ParsedLine } from '../excel'
import type { PurchaseOrder, Shipment, ShipmentLine, GRN, TrackingRow } from '../types'
import type { Go } from './types'

const D = DB

const fmtMoney = (n: number) => D.money(n || 0)
const today = () => new Date().toISOString().slice(0, 10)

/* ============================================================== *
 *  1.  PURCHASE ORDER SCREEN                                     *
 * ============================================================== */

interface POForm {
  supplier: string
  supplierContact: string
  date: string
  piNumber: string
  piDate: string
  paymentTerms: string
  incoTerms: string
  currency: string
  notes: string
}
const blankPO = (): POForm => ({
  supplier: '', supplierContact: '', date: today(),
  piNumber: '', piDate: '', paymentTerms: '30 Days', incoTerms: 'FOB',
  currency: 'LKR', notes: '',
})

const PAYMENT_TERMS = ['Advance', 'CAD', 'LC at sight', 'LC 30 Days', '30 Days', '45 Days', '60 Days', '90 Days']
const INCO_TERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP']
const CURRENCIES = ['LKR', 'USD', 'EUR', 'JPY', 'GBP', 'CNY', 'INR']

export function POScreen({ go }: { go: Go }) {
  const [rows, setRows] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [view, setView] = useState<PurchaseOrder | null>(null)
  const [form, setForm] = useState<POForm>(blankPO())
  const [lines, setLines] = useState<ParsedLine[]>([])
  const [fileName, setFileName] = useState('')
  const [parsing, setParsing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    setLoading(true)
    try {
      const list = await api.purchaseOrders.list()
      setRows(list as any)
    } catch { /* offline fallback */ }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const onFile = async (f: File | null) => {
    if (!f) return
    setErr(''); setParsing(true); setFileName(f.name)
    try {
      const parsed = await parsePoExcel(f)
      if (!parsed.length) setErr('No item rows detected. Expecting columns like Code / Item / Qty / Price.')
      setLines(parsed)
    } catch (e: any) {
      setErr(e?.message || 'Could not read Excel')
    } finally {
      setParsing(false)
    }
  }

  const total = lines.reduce((a, l) => a + (l.total || l.qty * l.cost), 0)

  const closeModal = () => {
    setModal(false); setForm(blankPO()); setLines([]); setFileName(''); setErr('')
  }

  const submit = async () => {
    if (!form.supplier || !lines.length) return
    setSubmitting(true); setErr('')
    try {
      await api.purchaseOrders.create({
        ...form,
        lines: lines.map((l) => ({
          code: l.code, item: l.item, qty: l.qty, cost: l.cost,
        })),
      } as any)
      await reload()
      closeModal()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const pending = rows.filter((r) => r.status === 'Pending').length
  const orderValue = rows.reduce((a, r) => a + (r.total || 0), 0)

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Purchase Order" icon="cart"
        sub={`${rows.length} orders · ${pending} pending approval`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>New Purchase Order</Btn>} />

      <StatRow items={[
        { icon: 'cart', label: 'Open Orders', value: rows.filter((r) => r.status !== 'Completed').length, c: 'ac' },
        { icon: 'clock', label: 'Pending Approval', value: pending, c: 'warn', sub: 'awaiting authorisation' },
        { icon: 'truck', label: 'Partial GRN', value: rows.filter((r) => r.status === 'Partial GRN').length, c: 'ac' },
        { icon: 'coins', label: 'Order Value', value: D.moneyK(orderValue), c: 'green' },
      ]} />

      <Card pad={0}>
        <Table cols={[
          { label: 'PO No' }, { label: 'Supplier' }, { label: 'PI No' }, { label: 'Date' },
          { label: 'Items', align: 'right' }, { label: 'Total', align: 'right' },
          { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 150 },
        ]}
          rows={rows}
          empty={loading ? 'Loading…' : 'No POs yet — click "New Purchase Order".'}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.code || r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.supplier}</Td>
            <Td mono>{r.piNumber || '—'}</Td>
            <Td mono>{r.date}</Td>
            <Td align="right" mono>{r.lines?.length || 0}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{fmtMoney(r.total)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" onClick={() => setView(r)}><Icon n="eye" s={15} /></button>
              {r.status !== 'Completed' && <Btn variant="ghost" size="sm" onClick={() => go('dc/costing')}>Costing</Btn>}
            </div></Td>
          </>} />
      </Card>

      {/* ---------------- New PO Modal ---------------- */}
      <Modal open={modal} onClose={closeModal} width={920}
        title="New Purchase Order"
        sub="Raise an order — fill basic details, then upload your item Excel"
        footer={<>
          <Btn variant="plain" onClick={closeModal}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={submit}
            disabled={!form.supplier || !lines.length || submitting}>
            {submitting ? 'Saving…' : 'Save Purchase Order'}
          </Btn>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
          <Field label="Supplier *">
            <Input list="suppliers-list" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="Supplier name" />
            <datalist id="suppliers-list">{D.suppliers.map((s) => <option key={s} value={s} />)}</datalist>
          </Field>
          <Field label="Supplier Contact">
            <Input value={form.supplierContact} onChange={(e) => setForm({ ...form, supplierContact: e.target.value })} placeholder="Email / phone" />
          </Field>
          <Field label="PO Date">
            <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="PI Number">
            <Input value={form.piNumber} onChange={(e) => setForm({ ...form, piNumber: e.target.value })} placeholder="e.g. PI-2026-118" />
          </Field>
          <Field label="PI Date">
            <Input type="date" value={form.piDate} onChange={(e) => setForm({ ...form, piDate: e.target.value })} />
          </Field>
          <Field label="Currency">
            <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Payment Terms">
            <Select value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}>
              {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Inco Terms">
            <Select value={form.incoTerms} onChange={(e) => setForm({ ...form, incoTerms: e.target.value })}>
              {INCO_TERMS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Notes">
            <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" />
          </Field>
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Items · Excel Upload</div>
        <ExcelDrop onPick={onFile} fileName={fileName} parsing={parsing} fileRef={fileRef}
          hint="Drop an .xlsx with columns: Code · Item · Qty · Price · (Total)" />

        {err && <div className="row gap-2" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
          <Icon n="alert" s={15} />{err}
        </div>}

        {lines.length > 0 && (
          <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
            <div style={{ maxHeight: 280, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-0)' }}>
                  <tr>{['#', 'Code', 'Item', 'Qty', 'Price', 'Total'].map((h, i) => <th key={i} style={{ padding: '8px 12px', textAlign: i > 2 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td style={tdSty} className="mono t-3">{i + 1}</td>
                      <td style={tdSty} className="mono t-2">{l.code}</td>
                      <td style={tdSty}>{l.item}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.cost)}</td>
                      <td style={{ ...tdSty, textAlign: 'right', fontWeight: 600 }} className="mono">{fmtMoney(l.qty * l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-0)' }}>
                    <td colSpan={5} style={{ ...tdSty, textAlign: 'right', fontWeight: 700 }}>Total</td>
                    <td style={{ ...tdSty, textAlign: 'right', fontWeight: 700, color: 'var(--ac-bright)' }} className="mono">{fmtMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* ---------------- View Modal ---------------- */}
      <Modal open={!!view} onClose={() => setView(null)} width={780}
        title={view?.code || view?.id}
        sub={view && `${view.supplier} · ${view.date}${view.piNumber ? ' · PI ' + view.piNumber : ''}`}
        footer={<><Badge tone={statusTone(view?.status || '')}>{view?.status}</Badge><Btn variant="primary" icon="print">Print PO</Btn></>}>
        {view && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16, fontSize: 12.5 }}>
              <KV k="Payment" v={view.paymentTerms} />
              <KV k="Inco" v={view.incoTerms} />
              <KV k="Currency" v={view.currency} />
              <KV k="PI Date" v={view.piDate} />
              <KV k="Contact" v={view.supplierContact} />
              <KV k="Notes" v={view.notes} />
            </div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg-0)' }}>
                  {['Code', 'Item', 'Ordered', 'Received', 'Balance', 'Cost', 'Total'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                </tr></thead>
                <tbody>{view.lines?.map((l, i) => (
                  <tr key={i}>
                    <td style={tdSty} className="mono t-2">{l.code}</td>
                    <td style={tdSty}>{l.item}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.receivedQty ?? 0}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono" >{l.balanceQty ?? l.qty}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.cost)}</td>
                    <td style={{ ...tdSty, textAlign: 'right', fontWeight: 600 }} className="mono">{fmtMoney(l.total)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================== *
 *  2.  COSTING SCREEN                                            *
 * ============================================================== */

export function CostingScreen({ go }: { go: Go }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [date, setDate] = useState(today())
  const [vessel, setVessel] = useState('')
  const [bl, setBl] = useState('')
  const [eta, setEta] = useState('')
  const [lines, setLines] = useState<ParsedLine[]>([])
  const [extras, setExtras] = useState<{ label: string; amount: number }[]>([])
  const [fileName, setFileName] = useState('')
  const [fileBase64, setFileBase64] = useState('')
  const [parsing, setParsing] = useState(false)
  const [err, setErr] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<Shipment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const reload = async () => {
    setLoading(true)
    try {
      const [poList, shList] = await Promise.all([
        api.purchaseOrders.list(),
        api.shipments.list(),
      ])
      setPos(poList as any); setShipments(shList as any)
    } finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const openPOs = pos.filter((p) => p.status !== 'Completed')

  const reset = () => {
    setPo(null); setDate(today()); setVessel(''); setBl(''); setEta('')
    setLines([]); setExtras([]); setFileName(''); setFileBase64(''); setErr('')
  }

  const onFile = async (f: File | null) => {
    if (!f || !po) return
    setErr(''); setParsing(true); setFileName(f.name)
    try {
      const parsed = await parseCostingExcel(f)
      setLines(parsed.lines.length ? parsed.lines : po.lines.map((l) => ({
        code: l.code, item: l.item, qty: l.qty, cost: l.cost, total: l.qty * l.cost,
      })))
      setExtras(parsed.extras)
      setFileBase64(await fileToBase64(f))
    } catch (e: any) {
      setErr(e?.message || 'Could not read Excel')
    } finally {
      setParsing(false)
    }
  }

  const itemsTotal = lines.reduce((a, l) => a + l.qty * l.cost, 0)
  const extrasTotal = extras.reduce((a, e) => a + (Number(e.amount) || 0), 0)
  const landedTotal = itemsTotal + extrasTotal

  const submit = async () => {
    if (!po || !lines.length) return
    setSubmitting(true); setErr('')
    try {
      const out = await api.shipments.create({
        po: po.code || po.id, date, vessel, blNumber: bl, eta,
        costFileName: fileName || null, costFileData: fileBase64 || null,
        lines: lines.map((l) => ({ code: l.code, item: l.item, qty: l.qty, cost: l.cost })),
        extras,
      } as any)
      setCreated(out as any)
      await reload()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Save failed')
    } finally {
      setSubmitting(false)
    }
  }

  const closeAndReset = () => { setModal(false); reset(); setCreated(null) }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Costing & Shipment" icon="box"
        sub="Create a shipment against a Purchase Order with landed cost figures"
        actions={<Btn variant="primary" icon="plus" onClick={() => { setModal(true); reset() }}>New Costing</Btn>} />

      <StatRow items={[
        { icon: 'cart', label: 'POs Awaiting Costing', value: openPOs.length, c: 'ac' },
        { icon: 'truck', label: 'Shipments', value: shipments.length, c: 'green' },
        { icon: 'coins', label: 'Costed Value', value: D.moneyK(shipments.reduce((a, s) => a + (s.landedTotal || 0), 0)), c: 'green' },
        { icon: 'clock', label: 'Partial Receipt', value: shipments.filter((s) => s.status === 'Partially Received').length, c: 'warn' },
      ]} />

      <Card pad={0}>
        <Table cols={[
          { label: 'Shipment' }, { label: 'PO' }, { label: 'Date' },
          { label: 'Vessel / BL' }, { label: 'Items', align: 'right' },
          { label: 'Extras', align: 'right' }, { label: 'Landed', align: 'right' },
          { label: 'Status', align: 'center' },
        ]}
          rows={shipments}
          empty={loading ? 'Loading…' : 'No shipments yet — click "New Costing".'}
          render={(s) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{s.code}</Td>
            <Td mono>{s.poCode}</Td>
            <Td mono>{s.date}</Td>
            <Td>{[s.vessel, s.blNumber].filter(Boolean).join(' · ') || '—'}</Td>
            <Td align="right" mono>{fmtMoney(s.itemsTotal)}</Td>
            <Td align="right" mono>{fmtMoney(s.extrasTotal)}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{fmtMoney(s.landedTotal)}</Td>
            <Td align="center"><Badge tone={statusTone(s.status)} dot>{s.status}</Badge></Td>
          </>} />
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={closeAndReset} width={960}
        title={created ? 'Shipment Created' : (po ? `Costing for ${po.code || po.id}` : 'Select Purchase Order')}
        sub={created ? `Shipment number: ${created.code}` : (po ? `${po.supplier} · ${po.lines.length} items ordered` : 'Choose an open PO to cost')}
        footer={created ? (
          <>
            <Btn variant="plain" onClick={closeAndReset}>Close</Btn>
            <Btn variant="primary" icon="truck" onClick={() => { closeAndReset(); go('dc/grn') }}>Make GRN now</Btn>
          </>
        ) : po ? (
          <>
            <Btn variant="plain" onClick={() => { setPo(null); reset() }}>Back</Btn>
            <Btn variant="primary" icon="check" disabled={!lines.length || submitting} onClick={submit}>
              {submitting ? 'Saving…' : 'Save & Generate Shipment'}
            </Btn>
          </>
        ) : <Btn variant="plain" onClick={closeAndReset}>Cancel</Btn>}
      >
        {created ? (
          <div className="col gap-3">
            <div className="row gap-2" style={{ padding: '12px 14px', background: 'var(--ok-dim)', color: 'var(--ok)', border: '1px solid var(--ok)', borderRadius: 'var(--r-s)' }}>
              <Icon n="check" s={18} /><span><b>{created.code}</b> generated successfully · landed total {fmtMoney(created.landedTotal)}.</span>
            </div>
            <div className="t-2" style={{ fontSize: 12.5 }}>Track this shipment in the GRN screen or the Tracking Dashboard.</div>
          </div>
        ) : !po ? (
          <div className="col gap-2">
            {openPOs.length === 0 && <div className="t-2" style={{ padding: 20, textAlign: 'center' }}>No open POs.</div>}
            {openPOs.map((p) => (
              <button key={p.id} onClick={() => setPo(p)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
                <div className="row gap-3">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="cart" s={17} /></div>
                  <div>
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{p.code || p.id}</span><Badge tone={statusTone(p.status)}>{p.status}</Badge></div>
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{p.supplier} · {p.lines?.length || 0} items · {p.date}{p.piNumber ? ' · PI ' + p.piNumber : ''}</div>
                  </div>
                </div>
                <div className="row gap-3"><span className="num" style={{ fontWeight: 600 }}>{fmtMoney(p.total)}</span><Icon n="chev" s={16} c="var(--tx-3)" /></div>
              </button>
            ))}
          </div>
        ) : (
          <div className="col gap-3">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <Field label="Shipment Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
              <Field label="Vessel"><Input value={vessel} onChange={(e) => setVessel(e.target.value)} placeholder="e.g. MSC Mira" /></Field>
              <Field label="BL Number"><Input value={bl} onChange={(e) => setBl(e.target.value)} /></Field>
              <Field label="ETA"><Input value={eta} onChange={(e) => setEta(e.target.value)} placeholder="2026-06-30" /></Field>
            </div>

            <div className="eyebrow">Costing Excel (item lines + extras at the bottom)</div>
            <ExcelDrop onPick={onFile} fileName={fileName} parsing={parsing} fileRef={fileRef}
              hint="Excel should list items at top (Code/Item/Qty/Price), then label+amount rows for Freight, Duty, VAT, etc." />

            {err && <div className="row gap-2" style={{ padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
              <Icon n="alert" s={15} />{err}
            </div>}

            {lines.length > 0 && (
              <CostingPreview lines={lines} extras={extras} setExtras={setExtras}
                itemsTotal={itemsTotal} extrasTotal={extrasTotal} landedTotal={landedTotal} />
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

function CostingPreview({ lines, extras, setExtras, itemsTotal, extrasTotal, landedTotal }: {
  lines: ParsedLine[]; extras: { label: string; amount: number }[]
  setExtras: (e: { label: string; amount: number }[]) => void
  itemsTotal: number; extrasTotal: number; landedTotal: number
}) {
  const ratio = itemsTotal > 0 ? landedTotal / itemsTotal : 1
  const updExtra = (i: number, k: 'label' | 'amount', v: any) =>
    setExtras(extras.map((e, j) => j === i ? { ...e, [k]: k === 'amount' ? Number(v) || 0 : v } : e))
  const addExtra = () => setExtras([...extras, { label: '', amount: 0 }])
  const rmExtra = (i: number) => setExtras(extras.filter((_, j) => j !== i))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', background: 'var(--bg-0)', fontSize: 11.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)' }}>Items</div>
        <div style={{ maxHeight: 320, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-0)', position: 'sticky', top: 0 }}>
              {['Code', 'Item', 'Qty', 'Unit', 'Total', 'Landed/U'].map((h, i) => <th key={i} style={{ padding: '7px 10px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
            </tr></thead>
            <tbody>{lines.map((l, i) => (
              <tr key={i}>
                <td style={tdSty} className="mono t-2">{l.code}</td>
                <td style={tdSty}>{l.item}</td>
                <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.cost)}</td>
                <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.qty * l.cost)}</td>
                <td style={{ ...tdSty, textAlign: 'right', color: 'var(--ac-bright)' }} className="mono">{fmtMoney(l.cost * ratio)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </div>

      <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
        <div className="row between" style={{ padding: '8px 12px', background: 'var(--bg-0)', borderBottom: '1px solid var(--line)' }}>
          <span className="eyebrow" style={{ fontSize: 10 }}>Costing Figures</span>
          <button onClick={addExtra} style={{ background: 'none', border: '1px solid var(--line)', borderRadius: 6, padding: '2px 8px', color: 'var(--ac-bright)', fontSize: 11, cursor: 'pointer' }}>+ Add</button>
        </div>
        <div className="col" style={{ padding: 8 }}>
          {extras.length === 0 && <div className="t-3" style={{ fontSize: 12, padding: 12, textAlign: 'center' }}>Auto-detected from Excel rows below the items.</div>}
          {extras.map((e, i) => (
            <div key={i} className="row gap-1" style={{ padding: 4 }}>
              <input value={e.label} onChange={(ev) => updExtra(i, 'label', ev.target.value)} placeholder="Freight, Duty…" style={{ ...inputStyle, padding: '6px 10px', fontSize: 12.5, flex: 1 }} />
              <input type="number" value={e.amount} onChange={(ev) => updExtra(i, 'amount', ev.target.value)} style={{ ...inputStyle, padding: '6px 10px', fontSize: 12.5, width: 110, textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
              <button onClick={() => rmExtra(i)} style={{ background: 'none', border: 'none', color: 'var(--bad)', cursor: 'pointer', padding: 4 }}><Icon n="x" s={14} /></button>
            </div>
          ))}
          <div style={{ borderTop: '1px solid var(--line-soft)', marginTop: 6, padding: '10px 12px' }} className="col gap-1">
            <div className="row between" style={{ fontSize: 12.5 }}><span className="t-2">Items</span><span className="mono">{fmtMoney(itemsTotal)}</span></div>
            <div className="row between" style={{ fontSize: 12.5 }}><span className="t-2">Extras</span><span className="mono">{fmtMoney(extrasTotal)}</span></div>
            <div className="row between" style={{ fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: '1px dashed var(--line)' }}>
              <span>Landed</span><span className="mono" style={{ color: 'var(--ac-bright)' }}>{fmtMoney(landedTotal)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================== *
 *  3.  GRN SCREEN                                                *
 * ============================================================== */

export function GRNScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<GRN[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [allShipments, setAllShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [recv, setRecv] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [err, setErr] = useState('')

  const reload = async () => {
    setLoading(true)
    try {
      const [grns, poList, shList] = await Promise.all([
        api.grns.list(), api.purchaseOrders.list(), api.shipments.list(),
      ])
      setRows(grns as any); setPos(poList as any); setAllShipments(shList as any)
    } finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const openPOs = pos.filter((p) => p.status !== 'Completed')
  const shipmentsFor = (poCode: string) => allShipments.filter((s) => s.poCode === poCode && s.status !== 'Received')

  const choosePO = (p: PurchaseOrder) => { setPo(p); setStep(2) }
  const chooseShipment = async (s: Shipment) => {
    try {
      const full = await api.shipments.get(s.id!) as any
      setShipment(full)
      const r: Record<number, number> = {}
      ;(full.lines || []).forEach((l: ShipmentLine, i: number) => {
        const poLine = po?.lines.find((pl: any) => pl.id === l.purchaseOrderLineId)
        r[i] = Math.min(l.qty, poLine?.balanceQty ?? l.qty)
      })
      setRecv(r); setStep(3)
    } catch (e: any) {
      setErr(e?.message || 'Failed to load shipment')
    }
  }

  const post = async () => {
    if (!po || !shipment) return
    setSubmitting(true); setErr('')
    try {
      await api.grns.create({
        po: po.code || po.id,
        shipmentCode: shipment.code,
        date: today(),
        lines: (shipment.lines || []).map((l, i) => ({
          shipmentLineId: l.id,
          code: l.code,
          item: l.item,
          qty: recv[i] || 0,
          cost: l.landedCost || l.cost,
        })),
      } as any)
      await reload()
      reset()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Post failed')
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => { setModal(false); setStep(1); setPo(null); setShipment(null); setRecv({}); setErr('') }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Goods Received Note" icon="truck"
        sub={`${rows.length} GRNs · select PO → Shipment → receive`}
        actions={<Btn variant="primary" icon="plus" onClick={() => { setModal(true); setStep(1) }}>Add GRN</Btn>} />

      <StatRow items={[
        { icon: 'truck', label: 'GRNs Posted', value: rows.filter((r) => r.status === 'Posted').length, c: 'green' },
        { icon: 'cart', label: 'POs Awaiting Receipt', value: openPOs.length, c: 'ac' },
        { icon: 'box', label: 'Shipments to Receive', value: allShipments.filter((s) => s.status !== 'Received').length, c: 'warn' },
        { icon: 'coins', label: 'Received Value', value: D.moneyK(rows.reduce((a, r) => a + (r.total || 0), 0)), c: 'green' },
      ]} />

      <Card pad={0}>
        <Table cols={[
          { label: 'GRN No' }, { label: 'PO' }, { label: 'Shipment' }, { label: 'Supplier' },
          { label: 'Date' }, { label: 'Items', align: 'right' }, { label: 'Value', align: 'right' },
          { label: 'Status', align: 'center' },
        ]}
          rows={rows}
          empty={loading ? 'Loading…' : 'No GRNs yet.'}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td mono>{r.po}</Td>
            <Td mono>{r.shipmentCode || '—'}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.supplier}</Td>
            <Td mono>{r.date}</Td>
            <Td align="right" mono>{r.items}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{fmtMoney(r.total)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
          </>} />
      </Card>

      <Modal open={modal} onClose={reset} width={820}
        title={step === 1 ? 'GRN · Step 1 — Select PO' : step === 2 ? `GRN · Step 2 — Select Shipment for ${po?.code || po?.id}` : `Receive Goods · ${shipment?.code}`}
        sub={step === 3 ? `${po?.supplier} · ${(shipment?.lines || []).length} items in shipment` : undefined}
        footer={step === 3 ? <>
          <Btn variant="plain" icon="chev" style={{ flexDirection: 'row-reverse' }} onClick={() => setStep(2)}>Back</Btn>
          <Btn variant="primary" icon="check" disabled={submitting} onClick={post}>{submitting ? 'Posting…' : 'Post GRN & Update Stock'}</Btn>
        </> : step === 2 ? <Btn variant="plain" onClick={() => setStep(1)}>Back</Btn> : <Btn variant="plain" onClick={reset}>Cancel</Btn>}
      >
        {err && <div className="row gap-2" style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
          <Icon n="alert" s={15} />{err}
        </div>}

        {step === 1 && (
          <div className="col gap-2">
            {openPOs.length === 0 && <div className="t-2" style={{ padding: 20, textAlign: 'center' }}>No open POs.</div>}
            {openPOs.map((p) => (
              <button key={p.id} onClick={() => choosePO(p)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
                <div className="row gap-3">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="cart" s={17} /></div>
                  <div>
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{p.code || p.id}</span><Badge tone={statusTone(p.status)}>{p.status}</Badge></div>
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{p.supplier} · {shipmentsFor(p.code || p.id).length} open shipment(s)</div>
                  </div>
                </div>
                <Icon n="chev" s={16} c="var(--tx-3)" />
              </button>
            ))}
          </div>
        )}

        {step === 2 && po && (
          <div className="col gap-2">
            {shipmentsFor(po.code || po.id).length === 0 && (
              <div className="t-2" style={{ padding: 20, textAlign: 'center' }}>
                No open shipments for this PO. <Btn variant="ghost" size="sm" onClick={() => { reset(); _go('dc/costing') }}>Create costing →</Btn>
              </div>
            )}
            {shipmentsFor(po.code || po.id).map((s) => (
              <button key={s.id} onClick={() => chooseShipment(s)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
                <div className="row gap-3">
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="box" s={17} /></div>
                  <div>
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{s.code}</span><Badge tone={statusTone(s.status)}>{s.status}</Badge></div>
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{s.date} · {[s.vessel, s.blNumber].filter(Boolean).join(' · ') || 'No vessel info'} · Landed {fmtMoney(s.landedTotal)}</div>
                  </div>
                </div>
                <Icon n="chev" s={16} c="var(--tx-3)" />
              </button>
            ))}
          </div>
        )}

        {step === 3 && shipment && (
          <div>
            <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ background: 'var(--bg-0)' }}>
                  {['Code', 'Item', 'Shipped', 'PO Bal.', 'Landed/U', 'Receiving Now'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                </tr></thead>
                <tbody>{(shipment.lines || []).map((l, i) => {
                  const poLine = po?.lines.find((pl: any) => pl.id === l.purchaseOrderLineId)
                  const cap = Math.min(l.qty, poLine?.balanceQty ?? l.qty)
                  return (
                    <tr key={i}>
                      <td style={tdSty} className="mono t-2">{l.code}</td>
                      <td style={tdSty}>{l.item}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{poLine?.balanceQty ?? '—'}</td>
                      <td style={{ ...tdSty, textAlign: 'right', color: 'var(--ac-bright)' }} className="mono">{fmtMoney(l.landedCost || l.cost)}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                        <input type="number" value={recv[i] ?? 0} max={cap} min={0}
                          onChange={(e) => setRecv((s) => ({ ...s, [i]: Math.min(cap, Math.max(0, +e.target.value)) }))}
                          style={{ ...inputStyle, width: 90, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            <div className="info-banner row gap-2" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--ok-dim)', border: '1px solid var(--ok)', borderRadius: 'var(--r-s)', fontSize: 12.5, color: 'var(--ok)' }}>
              <Icon n="check" s={16} /><span>Posting increases stock, recomputes Average Cost using landed cost, and reduces the PO balance.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================== *
 *  4.  TRACKING SCREEN                                           *
 * ============================================================== */

export function TrackingScreen({ go: _go }: { go: Go }) {
  const [data, setData] = useState<{ summary: any; rows: TrackingRow[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'open' | 'completed'>('all')

  useEffect(() => {
    let alive = true
    api.tracking().then((d: any) => { if (alive) setData(d) }).finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [])

  const rows = useMemo(() => {
    const r = data?.rows || []
    if (filter === 'open') return r.filter((x) => x.balanceQty > 0)
    if (filter === 'completed') return r.filter((x) => x.balanceQty <= 0 && x.orderedQty > 0)
    return r
  }, [data, filter])

  return (
    <div>
      <PageHead crumbs="Procurement" title="PO Tracking Dashboard" icon="chart"
        sub="Balance quantities and shipment status across every Purchase Order"
        actions={
          <div className="row gap-2">
            {(['all', 'open', 'completed'] as const).map((k) => (
              <Btn key={k} variant={filter === k ? 'primary' : 'ghost'} size="sm" onClick={() => setFilter(k)}>{k[0].toUpperCase() + k.slice(1)}</Btn>
            ))}
          </div>
        } />

      <StatRow items={[
        { icon: 'cart', label: 'Purchase Orders', value: data?.summary?.pos ?? 0, c: 'ac' },
        { icon: 'box', label: 'Shipments', value: data?.summary?.shipments ?? 0, c: 'green' },
        { icon: 'truck', label: 'GRNs', value: data?.summary?.grns ?? 0, c: 'green' },
        { icon: 'clock', label: 'Open Balance Qty', value: data?.summary?.openBalanceQty ?? 0, c: 'warn' },
      ]} />

      <Card pad={0}>
        {loading && <div className="t-2" style={{ padding: 24, textAlign: 'center' }}>Loading…</div>}
        {!loading && rows.length === 0 && <div className="t-3" style={{ padding: 24, textAlign: 'center' }}>No matching POs.</div>}
        {!loading && rows.map((r) => (
          <div key={r.poCode} style={{ borderBottom: '1px solid var(--line-soft)', padding: '14px 18px' }}>
            <div className="row between wrap gap-2">
              <div className="row gap-3">
                <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)' }}><Icon n="cart" s={18} /></div>
                <div>
                  <div className="row gap-2">
                    <span className="mono" style={{ fontWeight: 700, color: 'var(--ac-bright)' }}>{r.poCode}</span>
                    <Badge tone={statusTone(r.status)} dot>{r.status}</Badge>
                  </div>
                  <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{r.supplier}{r.piNumber ? ` · PI ${r.piNumber}` : ''} · {r.date}</div>
                </div>
              </div>
              <div className="row gap-4" style={{ fontFamily: 'JetBrains Mono', fontSize: 12.5 }}>
                <Mini k="Ordered" v={r.orderedQty} />
                <Mini k="Received" v={r.receivedQty} c="var(--ok)" />
                <Mini k="Balance" v={r.balanceQty} c={r.balanceQty > 0 ? 'var(--warn)' : 'var(--ok)'} />
                <Mini k="Value" v={fmtMoney(r.total)} mono />
              </div>
            </div>

            <div style={{ marginTop: 10, height: 8, background: 'var(--bg-3)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, r.progress)}%`, height: '100%', background: r.progress >= 100 ? 'var(--ok)' : 'var(--ac)', transition: 'width .3s' }} />
            </div>
            <div className="t-3" style={{ fontSize: 11, marginTop: 4 }}>{r.progress}% received</div>

            {r.shipments.length > 0 && (
              <div className="row gap-2 wrap" style={{ marginTop: 10 }}>
                {r.shipments.map((s) => (
                  <div key={s.code} className="row gap-2" style={{ padding: '6px 10px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', fontSize: 12 }}>
                    <Icon n="box" s={13} c="var(--ac-bright)" />
                    <span className="mono" style={{ fontWeight: 600 }}>{s.code}</span>
                    <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    <span className="t-2 mono">{fmtMoney(s.landedTotal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  )
}

/* ============================================================== *
 *  shared helpers                                                *
 * ============================================================== */

const tdSty = { padding: '8px 12px', borderBottom: '1px solid var(--line-soft)' } as const

function KV({ k, v }: { k: string; v?: any }) {
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 9, marginBottom: 3 }}>{k}</div>
      <div style={{ color: 'var(--tx-0)' }}>{v || '—'}</div>
    </div>
  )
}

function Mini({ k, v, c, mono }: { k: string; v: any; c?: string; mono?: boolean }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div className="eyebrow" style={{ fontSize: 9 }}>{k}</div>
      <div style={{ fontWeight: 700, color: c || 'var(--tx-0)', fontFamily: mono ? 'JetBrains Mono' : 'Saira' }}>{v}</div>
    </div>
  )
}

function ExcelDrop({ onPick, fileName, parsing, fileRef, hint }: {
  onPick: (f: File | null) => void
  fileName: string
  parsing: boolean
  fileRef: React.RefObject<HTMLInputElement>
  hint: string
}) {
  const [drag, setDrag] = useState(false)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); onPick(e.dataTransfer.files?.[0] || null) }}
      onClick={() => fileRef.current?.click()}
      style={{ cursor: 'pointer', padding: 22, textAlign: 'center', border: '1px dashed ' + (drag ? 'var(--ac)' : 'var(--line)'), borderRadius: 'var(--r-m)', background: drag ? 'var(--ac-dim)' : 'var(--bg-0)' }}>
      <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
        onChange={(e) => onPick(e.target.files?.[0] || null)} />
      <Icon n="upload" s={26} c="var(--ac-bright)" />
      <div style={{ marginTop: 8, fontSize: 13.5, fontWeight: 600 }}>{parsing ? 'Reading…' : fileName || 'Click or drop Excel here'}</div>
      <div className="t-2" style={{ fontSize: 11.5, marginTop: 4 }}>{hint}</div>
    </div>
  )
}
