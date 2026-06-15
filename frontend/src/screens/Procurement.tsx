/* NMS-Auto — Procurement
   Four screens that share the PO → Costing → GRN → Tracking flow:
     POScreen        : raise a PO (basic details + Excel upload of items)
     CostingScreen   : pick a PO, fill costing form, generate a shipment
     GRNScreen       : pick PO + Shipment, receive items, set selling prices
     TrackingScreen  : balance + shipment status + financial impact dashboard */
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Card, PageHead, Btn, Badge, Field, Input, Select, Modal,
  Table, Td, statusTone, inputStyle,
} from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow } from '../components/doc'
import DB from '../data'
import { api } from '../api'
import { parsePoExcel, parseCostingExcel, fileToBase64, type ParsedLine, type ParsedCostingLine } from '../excel'
import { computeCosting, type ComplexCharge } from '../lib/costing'
import type { PurchaseOrder, Shipment, ShipmentLine, GRN, TrackingRow } from '../types'
import type { Go } from './types'

const D = DB
const fmtMoney = (n: number) => D.money(n || 0)
const today = () => new Date().toISOString().slice(0, 10)

/* ============================================================== *
 *  1.  PURCHASE ORDER SCREEN                                     *
 * ============================================================== */

interface POForm {
  supplier: string; supplierContact: string; date: string;
  piNumber: string; piDate: string;
  paymentTerms: string; incoTerms: string; currency: string; notes: string;
}
const blankPO = (): POForm => ({
  supplier: '', supplierContact: '', date: today(),
  piNumber: '', piDate: '', paymentTerms: '30 Days', incoTerms: 'FOB',
  currency: 'USD', notes: '',
})

const PAYMENT_TERMS = ['Advance', 'CAD', 'LC at sight', 'LC 30 Days', '30 Days', '45 Days', '60 Days', '90 Days']
const INCO_TERMS = ['EXW', 'FCA', 'FOB', 'CIF', 'CFR', 'DAP', 'DDP']
const CURRENCIES = ['USD', 'LKR', 'EUR', 'JPY', 'GBP', 'CNY', 'INR']

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
    try { setRows(await api.purchaseOrders.list() as any) }
    catch { /* offline */ }
    finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const onFile = async (f: File | null) => {
    if (!f) return
    setErr(''); setParsing(true); setFileName(f.name)
    try {
      const parsed = await parsePoExcel(f)
      if (!parsed.length) setErr('No item rows detected. Expecting columns like PART NO / DESCRIPTION / HS CODE / ORDER QUANTITY / UNIT PRICE FOB-USD.')
      setLines(parsed)
    } catch (e: any) { setErr(e?.message || 'Could not read Excel') }
    finally { setParsing(false) }
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
          code: l.code, hsCode: l.hsCode, item: l.item, qty: l.qty, cost: l.cost,
        })),
      } as any)
      await reload()
      closeModal()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Save failed')
    } finally { setSubmitting(false) }
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

      <Modal open={modal} onClose={closeModal} width={960}
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
            <SearchSelect value={form.supplier} onChange={(v) => setForm({ ...form, supplier: v })}
              options={D.suppliers} placeholder="Search supplier…" allowCustom />
          </Field>
          <Field label="Supplier Contact"><Input value={form.supplierContact} onChange={(e) => setForm({ ...form, supplierContact: e.target.value })} placeholder="Email / phone" /></Field>
          <Field label="PO Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
          <Field label="PI Number"><Input value={form.piNumber} onChange={(e) => setForm({ ...form, piNumber: e.target.value })} placeholder="e.g. PI-2026-118" /></Field>
          <Field label="PI Date"><Input type="date" value={form.piDate} onChange={(e) => setForm({ ...form, piDate: e.target.value })} /></Field>
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
          <Field label="Notes"><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional" /></Field>
        </div>

        <div className="eyebrow" style={{ marginBottom: 10 }}>Items · Excel Upload</div>
        <ExcelDrop onPick={onFile} fileName={fileName} parsing={parsing} fileRef={fileRef}
          hint="Drop .xlsx with: PART NO · DESCRIPTION · HS CODE · ORDER QUANTITY · UNIT PRICE FOB-USD · TOTAL AMOUNT USD-FOB" />

        {err && <ErrBox text={err} />}

        {lines.length > 0 && (
          <div style={{ marginTop: 14, border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
            <div style={{ maxHeight: 320, overflow: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-0)' }}>
                  <tr>{['#', 'Part No', 'Description', 'HS Code', 'Qty', 'Unit FOB', 'Total FOB'].map((h, i) => <th key={i} style={{ padding: '8px 12px', textAlign: i > 3 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={i}>
                      <td style={tdSty} className="mono t-3">{i + 1}</td>
                      <td style={tdSty} className="mono t-2">{l.code}</td>
                      <td style={tdSty}>{l.item}</td>
                      <td style={tdSty} className="mono t-2">{l.hsCode || '—'}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.cost)}</td>
                      <td style={{ ...tdSty, textAlign: 'right', fontWeight: 600 }} className="mono">{fmtMoney(l.qty * l.cost)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--bg-0)' }}>
                    <td colSpan={6} style={{ ...tdSty, textAlign: 'right', fontWeight: 700 }}>Total</td>
                    <td style={{ ...tdSty, textAlign: 'right', fontWeight: 700, color: 'var(--ac-bright)' }} className="mono">{fmtMoney(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} width={820}
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
                  {['Part No', 'HS Code', 'Description', 'Ordered', 'Received', 'Balance', 'Cost', 'Total'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 2 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}
                </tr></thead>
                <tbody>{view.lines?.map((l, i) => (
                  <tr key={i}>
                    <td style={tdSty} className="mono t-2">{l.code}</td>
                    <td style={tdSty} className="mono t-2">{l.hsCode || '—'}</td>
                    <td style={tdSty}>{l.item}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.receivedQty ?? 0}</td>
                    <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.balanceQty ?? l.qty}</td>
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

const SHIPMENT_TYPES = ['SEA', 'AIR', 'COURIER']
const SHIPMENT_VOLUMES = ["20'", "40'", 'LCL']

interface CostingForm {
  date: string;
  invoiceNo: string; blNumber: string;
  noOfPackages: string; grossWeight: string; netWeight: string;
  shipmentType: string; shipmentVolume: string;
  etd: string; etaDate: string;
  cusdecNo: string; cusdecDate: string;
  bankingRate: string; customRate: string; settlementRate: string;
  cidAmount: string; palAmount: string;
  dutyAmount: string; dutyDate: string;
  cessAmount: string; vatAmount: string; ssclAmount: string;
  other1Amount: string; other2Amount: string; other3Amount: string;
}
const blankCosting = (): CostingForm => ({
  date: today(),
  invoiceNo: '', blNumber: '',
  noOfPackages: '', grossWeight: '', netWeight: '',
  shipmentType: 'SEA', shipmentVolume: "20'",
  etd: '', etaDate: '',
  cusdecNo: '', cusdecDate: '',
  bankingRate: '335', customRate: '340', settlementRate: '',
  cidAmount: '', palAmount: '',
  dutyAmount: '', dutyDate: '',
  cessAmount: '', vatAmount: '', ssclAmount: '',
  other1Amount: '', other2Amount: '', other3Amount: '',
})
const blankCharge = (): ComplexCharge => ({ amountUsd: 0, amountLkr: 0, agent: '', invoiceNo: '', policyNo: '', invoiceValue: 0 })
const num = (s: string | number | undefined) => Number(s || 0) || 0

export function CostingScreen({ go }: { go: Go }) {
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)

  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [form, setForm] = useState<CostingForm>(blankCosting())
  const [lines, setLines] = useState<ParsedCostingLine[]>([])
  const [freight, setFreight] = useState<ComplexCharge>(blankCharge())
  const [insurance, setInsurance] = useState<ComplexCharge>(blankCharge())
  const [banking, setBanking] = useState<ComplexCharge>(blankCharge())
  const [clearance, setClearance] = useState<ComplexCharge>(blankCharge())
  const [slpa, setSlpa] = useState<ComplexCharge>(blankCharge())
  const [demurrage, setDemurrage] = useState<ComplexCharge>(blankCharge())

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
      const [poList, shList] = await Promise.all([api.purchaseOrders.list(), api.shipments.list()])
      setPos(poList as any); setShipments(shList as any)
    } finally { setLoading(false) }
  }
  useEffect(() => { reload() }, [])

  const openPOs = pos.filter((p) => p.status !== 'Completed')

  const reset = () => {
    setPo(null); setForm(blankCosting())
    setLines([]); setFileName(''); setFileBase64(''); setErr('')
    setFreight(blankCharge()); setInsurance(blankCharge()); setBanking(blankCharge())
    setClearance(blankCharge()); setSlpa(blankCharge()); setDemurrage(blankCharge())
  }

  // Seed lines from PO whenever a PO is picked, so the grid is editable even
  // without an Excel upload.
  useEffect(() => {
    if (!po) return
    setLines(po.lines.map((l: any) => ({
      code: l.code, hsCode: l.hsCode, item: l.item,
      qty: l.balanceQty ?? l.qty, cost: l.cost, total: (l.balanceQty ?? l.qty) * l.cost,
    })))
  }, [po])

  const onFile = async (f: File | null) => {
    if (!f || !po) return
    setErr(''); setParsing(true); setFileName(f.name)
    try {
      const parsed = await parseCostingExcel(f)
      if (parsed.lines.length) setLines(parsed.lines)
      setFileBase64(await fileToBase64(f))
    } catch (e: any) {
      setErr(e?.message || 'Could not read Excel')
    } finally { setParsing(false) }
  }

  const computed = useMemo(() => computeCosting({
    bankingRate: num(form.bankingRate),
    freight, insurance, banking, clearance, slpa, demurrage,
    cidAmount: num(form.cidAmount), palAmount: num(form.palAmount),
    dutyAmount: num(form.dutyAmount), cessAmount: num(form.cessAmount),
    vatAmount: num(form.vatAmount), ssclAmount: num(form.ssclAmount),
    other1Amount: num(form.other1Amount), other2Amount: num(form.other2Amount), other3Amount: num(form.other3Amount),
    lines: lines.map((l) => ({
      code: l.code, hsCode: l.hsCode, item: l.item, qty: l.qty, cost: l.cost,
      sellingPriceWoVat: l.sellingPriceWoVat, sellingPriceWithVat: l.sellingPriceWithVat,
    })),
  }), [form, freight, insurance, banking, clearance, slpa, demurrage, lines])

  const updLine = (i: number, patch: Partial<ParsedCostingLine>) =>
    setLines((ls) => ls.map((l, j) => j === i ? { ...l, ...patch } : l))

  const submit = async () => {
    if (!po || !lines.length) return
    setSubmitting(true); setErr('')
    try {
      const out = await api.shipments.create({
        po: po.code || po.id,
        date: form.date,
        invoiceNo: form.invoiceNo, blNumber: form.blNumber,
        noOfPackages: num(form.noOfPackages) || null,
        grossWeight: num(form.grossWeight) || null,
        netWeight: num(form.netWeight) || null,
        shipmentType: form.shipmentType, shipmentVolume: form.shipmentVolume,
        etd: form.etd || null, etaDate: form.etaDate || null,
        cusdecNo: form.cusdecNo, cusdecDate: form.cusdecDate || null,
        bankingRate: num(form.bankingRate),
        customRate: num(form.customRate),
        settlementRate: num(form.settlementRate),
        cidAmount: num(form.cidAmount), palAmount: num(form.palAmount),
        dutyAmount: num(form.dutyAmount), dutyDate: form.dutyDate || null,
        cessAmount: num(form.cessAmount), vatAmount: num(form.vatAmount), ssclAmount: num(form.ssclAmount),
        other1Amount: num(form.other1Amount), other2Amount: num(form.other2Amount), other3Amount: num(form.other3Amount),
        freight, insurance, banking, clearance, slpa, demurrage,
        costFileName: fileName || null, costFileData: fileBase64 || null,
        lines: lines.map((l) => ({
          code: l.code, hsCode: l.hsCode, item: l.item,
          qty: l.qty, cost: l.cost,
          sellingPriceWoVat: l.sellingPriceWoVat || 0,
          sellingPriceWithVat: l.sellingPriceWithVat || 0,
        })),
      } as any)
      setCreated(out as any)
      await reload()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Save failed')
    } finally { setSubmitting(false) }
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
          { label: 'Shipment' }, { label: 'PO' }, { label: 'Invoice' }, { label: 'Date' },
          { label: 'Type', align: 'center' },
          { label: 'Items LKR', align: 'right' }, { label: 'Charges', align: 'right' },
          { label: 'Landed', align: 'right' }, { label: 'Status', align: 'center' },
        ]}
          rows={shipments}
          empty={loading ? 'Loading…' : 'No shipments yet — click "New Costing".'}
          render={(s) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{s.code}</Td>
            <Td mono>{s.poCode}</Td>
            <Td mono>{s.invoiceNo || '—'}</Td>
            <Td mono>{s.date}</Td>
            <Td align="center"><Badge>{[s.shipmentType, s.shipmentVolume].filter(Boolean).join(' · ') || '—'}</Badge></Td>
            <Td align="right" mono>{fmtMoney(s.itemsTotalLkr || s.itemsTotal)}</Td>
            <Td align="right" mono>{fmtMoney(s.chargesTotalLkr || s.extrasTotal)}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{fmtMoney(s.landedTotal)}</Td>
            <Td align="center"><Badge tone={statusTone(s.status)} dot>{s.status}</Badge></Td>
          </>} />
      </Card>

      <Modal open={modal} onClose={closeAndReset} width={1180}
        title={created ? 'Shipment Created' : (po ? `Costing for ${po.code || po.id}` : 'Select Purchase Order')}
        sub={created ? `Shipment number: ${created.code}` : (po ? `${po.supplier} · ${po.lines.length} items` : 'Choose an open PO to cost')}
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
              <Icon n="check" s={18} /><span><b>{created.code}</b> generated · landed total {fmtMoney(created.landedTotal)}.</span>
            </div>
            <div className="t-2" style={{ fontSize: 12.5 }}>Track this shipment in the GRN screen or the Tracking Dashboard.</div>
          </div>
        ) : !po ? (
          <POPicker pos={openPOs} onPick={setPo} />
        ) : (
          <div className="col gap-3">
            <Section title="Shipping & Weight">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                <Field label="Invoice No"><Input value={form.invoiceNo} onChange={(e) => setForm({ ...form, invoiceNo: e.target.value })} /></Field>
                <Field label="BL Number"><Input value={form.blNumber} onChange={(e) => setForm({ ...form, blNumber: e.target.value })} /></Field>
                <Field label="No. of Packages"><Input type="number" value={form.noOfPackages} onChange={(e) => setForm({ ...form, noOfPackages: e.target.value })} /></Field>
                <Field label="Shipment Date"><Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></Field>
                <Field label="Gross Weight (kg)"><Input type="number" value={form.grossWeight} onChange={(e) => setForm({ ...form, grossWeight: e.target.value })} /></Field>
                <Field label="Net Weight (kg)"><Input type="number" value={form.netWeight} onChange={(e) => setForm({ ...form, netWeight: e.target.value })} /></Field>
                <Field label="Shipment Type"><Select value={form.shipmentType} onChange={(e) => setForm({ ...form, shipmentType: e.target.value })}>{SHIPMENT_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="Shipment Volume"><Select value={form.shipmentVolume} onChange={(e) => setForm({ ...form, shipmentVolume: e.target.value })}>{SHIPMENT_VOLUMES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
                <Field label="ETD"><Input type="date" value={form.etd} onChange={(e) => setForm({ ...form, etd: e.target.value })} /></Field>
                <Field label="ETA"><Input type="date" value={form.etaDate} onChange={(e) => setForm({ ...form, etaDate: e.target.value })} /></Field>
              </div>
            </Section>

            <Section title="Tax & Custom">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                <Field label="Cusdec No"><Input value={form.cusdecNo} onChange={(e) => setForm({ ...form, cusdecNo: e.target.value })} /></Field>
                <Field label="Cusdec Date"><Input type="date" value={form.cusdecDate} onChange={(e) => setForm({ ...form, cusdecDate: e.target.value })} /></Field>
                <Field label="Banking Rate"><Input type="number" value={form.bankingRate} onChange={(e) => setForm({ ...form, bankingRate: e.target.value })} /></Field>
                <Field label="Custom Rate"><Input type="number" value={form.customRate} onChange={(e) => setForm({ ...form, customRate: e.target.value })} /></Field>
                <Field label="Settlement Rate"><Input type="number" value={form.settlementRate} onChange={(e) => setForm({ ...form, settlementRate: e.target.value })} /></Field>
              </div>
            </Section>

            <Section title="Costing Expenses">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                <Field label="CID (LKR)"><Input type="number" value={form.cidAmount} onChange={(e) => setForm({ ...form, cidAmount: e.target.value })} /></Field>
                <Field label="PAL (LKR)"><Input type="number" value={form.palAmount} onChange={(e) => setForm({ ...form, palAmount: e.target.value })} /></Field>
                <Field label="DUTY (LKR)"><Input type="number" value={form.dutyAmount} onChange={(e) => setForm({ ...form, dutyAmount: e.target.value })} /></Field>
                <Field label="DUTY Date"><Input type="date" value={form.dutyDate} onChange={(e) => setForm({ ...form, dutyDate: e.target.value })} /></Field>
                <Field label="CESS (LKR)"><Input type="number" value={form.cessAmount} onChange={(e) => setForm({ ...form, cessAmount: e.target.value })} /></Field>
                <Field label="VAT (LKR)"><Input type="number" value={form.vatAmount} onChange={(e) => setForm({ ...form, vatAmount: e.target.value })} /></Field>
                <Field label="SSCL (LKR)"><Input type="number" value={form.ssclAmount} onChange={(e) => setForm({ ...form, ssclAmount: e.target.value })} /></Field>
                <Field label="OTHER 1"><Input type="number" value={form.other1Amount} onChange={(e) => setForm({ ...form, other1Amount: e.target.value })} /></Field>
                <Field label="OTHER 2"><Input type="number" value={form.other2Amount} onChange={(e) => setForm({ ...form, other2Amount: e.target.value })} /></Field>
                <Field label="OTHER 3"><Input type="number" value={form.other3Amount} onChange={(e) => setForm({ ...form, other3Amount: e.target.value })} /></Field>
              </div>
            </Section>

            <Section title="Complex Charges (Freight / Insurance / Banking / Clearance / SLPA / Demurrage)">
              <ChargeRow label="Freight" v={freight} set={setFreight} withAgent />
              <ChargeRow label="Insurance" v={insurance} set={setInsurance} withAgent policy />
              <ChargeRow label="Banking" v={banking} set={setBanking} />
              <ChargeRow label="Clearance" v={clearance} set={setClearance} withAgent />
              <ChargeRow label="SLPA" v={slpa} set={setSlpa} withAgent />
              <ChargeRow label="Demurrage" v={demurrage} set={setDemurrage} withAgent />
            </Section>

            <Section title="Items · Excel Upload (optional)">
              <ExcelDrop onPick={onFile} fileName={fileName} parsing={parsing} fileRef={fileRef}
                hint="Optional — upload the costing template to override line qty/price. Otherwise the PO lines are used." />
            </Section>

            {err && <ErrBox text={err} />}

            <CostingGrid lines={lines} computed={computed} updLine={updLine} />
          </div>
        )}
      </Modal>
    </div>
  )
}

function POPicker({ pos, onPick }: { pos: PurchaseOrder[]; onPick: (p: PurchaseOrder) => void }) {
  return (
    <div className="col gap-2">
      {pos.length === 0 && <div className="t-2" style={{ padding: 20, textAlign: 'center' }}>No open POs.</div>}
      {pos.map((p) => (
        <button key={p.id} onClick={() => onPick(p)} className="row between mms-row" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', textAlign: 'left', color: 'var(--tx-0)' }}>
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
  )
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-0)', fontSize: 11.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)' }}>{title}</div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  )
}

function ChargeRow({ label, v, set, withAgent, policy }: {
  label: string; v: ComplexCharge; set: (n: ComplexCharge) => void
  withAgent?: boolean; policy?: boolean
}) {
  const upd = (patch: Partial<ComplexCharge>) => set({ ...v, ...patch })
  return (
    <div className="row gap-2 wrap" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
      <div style={{ width: 110, fontSize: 12.5, fontWeight: 600, paddingBottom: 10 }}>{label}</div>
      <Field label="USD" style={{ width: 110 }}><Input type="number" value={v.amountUsd ?? ''} onChange={(e) => upd({ amountUsd: Number(e.target.value) || 0 })} /></Field>
      <Field label="LKR" style={{ width: 120 }}><Input type="number" value={v.amountLkr ?? ''} onChange={(e) => upd({ amountLkr: Number(e.target.value) || 0 })} /></Field>
      {withAgent && <Field label="Agent" style={{ width: 140 }}><Input value={v.agent ?? ''} onChange={(e) => upd({ agent: e.target.value })} /></Field>}
      <Field label={policy ? 'Policy No' : 'Invoice No'} style={{ width: 140 }}><Input value={(policy ? v.policyNo : v.invoiceNo) ?? ''} onChange={(e) => upd(policy ? { policyNo: e.target.value } : { invoiceNo: e.target.value })} /></Field>
      <Field label="Invoice Value" style={{ width: 130 }}><Input type="number" value={v.invoiceValue ?? ''} onChange={(e) => upd({ invoiceValue: Number(e.target.value) || 0 })} /></Field>
    </div>
  )
}

function CostingGrid({ lines, computed, updLine }: {
  lines: ParsedCostingLine[]
  computed: ReturnType<typeof computeCosting>
  updLine: (i: number, p: Partial<ParsedCostingLine>) => void
}) {
  return (
    <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: 'var(--bg-0)', fontSize: 11.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)' }}>Costing Item Grid</div>
      <div style={{ maxHeight: 380, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead><tr style={{ background: 'var(--bg-0)', position: 'sticky', top: 0 }}>
            {['Part No', 'Description', 'Qty', 'Unit FOB', 'Total FOB', 'FOB LKR', 'Freight', 'Ins.', 'CID', 'PAL', 'Duty', 'CESS', 'SSCL', 'Other', 'Other Chg', 'Tot W/O VAT', 'Tot W/ VAT', 'U.Cost W/O', 'U.Cost W/', 'Sell W/O', 'Sell W/'].map((h, i) => <th key={i} style={{ padding: '6px 8px', textAlign: i > 1 ? 'right' : 'left', fontSize: 9.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>)}
          </tr></thead>
          <tbody>{computed.lines.map((c, i) => (
            <tr key={i}>
              <td style={tdSty} className="mono t-2">{c.code}</td>
              <td style={tdSty}>{c.item}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">
                <input type="number" value={lines[i]?.qty || 0}
                  onChange={(e) => updLine(i, { qty: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, width: 60, padding: '3px 6px', textAlign: 'right' }} />
              </td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.cost)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.total)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.fobLkr)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.freightLkr)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.insuranceLkr)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.cid)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.pal)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.duty)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.cess)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.sscl)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.other1 + c.other2 + c.other3)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.bankingAlloc + c.clearanceAlloc + c.slpaAlloc + c.demurrageAlloc)}</td>
              <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(c.totalPriceWoVat)}</td>
              <td style={{ ...tdSty, textAlign: 'right', fontWeight: 600 }} className="mono">{fmtMoney(c.totalPriceWithVat)}</td>
              <td style={{ ...tdSty, textAlign: 'right', color: 'var(--ac-bright)' }} className="mono">{fmtMoney(c.unitCostWoVat)}</td>
              <td style={{ ...tdSty, textAlign: 'right', color: 'var(--ac-bright)', fontWeight: 600 }} className="mono">{fmtMoney(c.unitCostWithVat)}</td>
              <td style={tdSty}>
                <input type="number" value={lines[i]?.sellingPriceWoVat ?? ''}
                  onChange={(e) => updLine(i, { sellingPriceWoVat: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, width: 90, padding: '3px 6px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
              </td>
              <td style={tdSty}>
                <input type="number" value={lines[i]?.sellingPriceWithVat ?? ''}
                  onChange={(e) => updLine(i, { sellingPriceWithVat: Number(e.target.value) || 0 })}
                  style={{ ...inputStyle, width: 90, padding: '3px 6px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
              </td>
            </tr>
          ))}</tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg-0)' }}>
              <td colSpan={4} style={{ ...tdSty, fontWeight: 700, textAlign: 'right' }}>Totals</td>
              <td style={{ ...tdSty, textAlign: 'right', fontWeight: 700 }} className="mono">{fmtMoney(computed.itemsTotalUsd)}</td>
              <td style={{ ...tdSty, textAlign: 'right', fontWeight: 700 }} className="mono">{fmtMoney(computed.itemsTotalLkr)}</td>
              <td colSpan={9} style={{ ...tdSty, textAlign: 'right', fontWeight: 700 }} className="mono">Charges {fmtMoney(computed.chargesTotalLkr)}</td>
              <td colSpan={2} style={{ ...tdSty, textAlign: 'right', fontWeight: 700, color: 'var(--ac-bright)' }} className="mono">Landed {fmtMoney(computed.landedTotal)}</td>
              <td colSpan={4} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

/* ============================================================== *
 *  3.  GRN SCREEN                                                *
 * ============================================================== */

interface RecvRow {
  qty: number
  sellingPriceWoVat: number
  sellingPriceWithVat: number
}

export function GRNScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<GRN[]>([])
  const [pos, setPos] = useState<PurchaseOrder[]>([])
  const [allShipments, setAllShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)

  const [modal, setModal] = useState(false)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [po, setPo] = useState<PurchaseOrder | null>(null)
  const [shipment, setShipment] = useState<Shipment | null>(null)
  const [recv, setRecv] = useState<Record<number, RecvRow>>({})
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
      const r: Record<number, RecvRow> = {}
      ;(full.lines || []).forEach((l: ShipmentLine, i: number) => {
        const poLine = po?.lines.find((pl: any) => pl.id === l.purchaseOrderLineId)
        r[i] = {
          qty: Math.min(l.qty, poLine?.balanceQty ?? l.qty),
          sellingPriceWoVat: l.sellingPriceWoVat || 0,
          sellingPriceWithVat: l.sellingPriceWithVat || 0,
        }
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
          code: l.code, item: l.item,
          qty: recv[i]?.qty || 0,
          cost: l.unitCostWithVat || l.landedCost || l.cost,
          unitCostWoVat: l.unitCostWoVat || l.cost,
          unitCostWithVat: l.unitCostWithVat || l.landedCost || l.cost,
          sellingPriceWoVat: recv[i]?.sellingPriceWoVat || 0,
          sellingPriceWithVat: recv[i]?.sellingPriceWithVat || 0,
        })),
      } as any)
      await reload()
      reset()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Post failed')
    } finally { setSubmitting(false) }
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

      <Modal open={modal} onClose={reset} width={1080}
        title={step === 1 ? 'GRN · Step 1 — Select PO' : step === 2 ? `GRN · Step 2 — Select Shipment for ${po?.code || po?.id}` : `Receive Goods · ${shipment?.code}`}
        sub={step === 3 ? `${po?.supplier} · ${(shipment?.lines || []).length} items in shipment` : undefined}
        footer={step === 3 ? <>
          <Btn variant="plain" onClick={() => setStep(2)}>Back</Btn>
          <Btn variant="primary" icon="check" disabled={submitting} onClick={post}>{submitting ? 'Posting…' : 'Post GRN & Update Stock'}</Btn>
        </> : step === 2 ? <Btn variant="plain" onClick={() => setStep(1)}>Back</Btn> : <Btn variant="plain" onClick={reset}>Cancel</Btn>}
      >
        {err && <ErrBox text={err} />}

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
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{s.date} · {[s.invoiceNo, s.blNumber].filter(Boolean).join(' · ') || 'No invoice/BL info'} · Landed {fmtMoney(s.landedTotal)}</div>
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
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: 'var(--bg-0)' }}>
                  {['Part No', 'Description', 'Shipped', 'PO Bal.', 'U.Cost W/ VAT', 'U.Cost W/O VAT', 'Receiving', 'Sell W/O VAT', 'Sell W/ VAT'].map((h, i) => <th key={i} style={{ padding: '8px 10px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' }}>{h}</th>)}
                </tr></thead>
                <tbody>{(shipment.lines || []).map((l, i) => {
                  const poLine = po?.lines.find((pl: any) => pl.id === l.purchaseOrderLineId)
                  const cap = Math.min(l.qty, poLine?.balanceQty ?? l.qty)
                  const row = recv[i] || { qty: 0, sellingPriceWoVat: 0, sellingPriceWithVat: 0 }
                  const setRow = (p: Partial<RecvRow>) =>
                    setRecv((s) => ({ ...s, [i]: { ...row, ...p } }))
                  return (
                    <tr key={i}>
                      <td style={tdSty} className="mono t-2">{l.code}</td>
                      <td style={tdSty}>{l.item}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{l.qty}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{poLine?.balanceQty ?? '—'}</td>
                      <td style={{ ...tdSty, textAlign: 'right', color: 'var(--ac-bright)' }} className="mono">{fmtMoney(l.unitCostWithVat || l.landedCost || l.cost)}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }} className="mono">{fmtMoney(l.unitCostWoVat || l.cost)}</td>
                      <td style={{ ...tdSty, textAlign: 'right' }}>
                        <input type="number" value={row.qty} max={cap} min={0}
                          onChange={(e) => setRow({ qty: Math.min(cap, Math.max(0, +e.target.value)) })}
                          style={{ ...inputStyle, width: 80, padding: '4px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                      </td>
                      <td style={tdSty}>
                        <input type="number" value={row.sellingPriceWoVat}
                          onChange={(e) => setRow({ sellingPriceWoVat: Number(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: 100, padding: '4px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                      </td>
                      <td style={tdSty}>
                        <input type="number" value={row.sellingPriceWithVat}
                          onChange={(e) => setRow({ sellingPriceWithVat: Number(e.target.value) || 0 })}
                          style={{ ...inputStyle, width: 100, padding: '4px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
            <div className="info-banner row gap-2" style={{ marginTop: 14, padding: '10px 14px', background: 'var(--ok-dim)', border: '1px solid var(--ok)', borderRadius: 'var(--r-s)', fontSize: 12.5, color: 'var(--ok)' }}>
              <Icon n="check" s={16} /><span>Posting increases stock, recomputes Average Cost using ex-VAT landed cost, sets the item's selling prices, and reduces the PO balance.</span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/* ============================================================== *
 *  4.  TRACKING / SUMMARY SCREEN                                 *
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
        sub="Balance quantities, shipment status, and financial impact across every Purchase Order"
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
        { icon: 'coins', label: 'Stock Value Added', value: D.moneyK(data?.summary?.stockValueAdded ?? 0), c: 'green' },
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
                <Mini k="PO Value" v={fmtMoney(r.total)} mono />
                <Mini k="Stock Value" v={fmtMoney(r.stockValue ?? 0)} c="var(--ac-bright)" mono />
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
                    {s.invoiceNo && <span className="t-3">Inv {s.invoiceNo}</span>}
                    {s.shipmentType && <span className="t-3">{s.shipmentType}{s.shipmentVolume ? '·' + s.shipmentVolume : ''}</span>}
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

const tdSty = { padding: '6px 10px', borderBottom: '1px solid var(--line-soft)' } as const

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

function ErrBox({ text }: { text: string }) {
  return (
    <div className="row gap-2" style={{ marginTop: 10, padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
      <Icon n="alert" s={15} />{text}
    </div>
  )
}

function SearchSelect({ value, onChange, options, placeholder, allowCustom }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  allowCustom?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => o.toLowerCase().includes(q))
    : options
  const shown = open ? (query ? query : value) : value

  const pick = (v: string) => { onChange(v); setQuery(''); setOpen(false) }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          value={open ? query : value}
          placeholder={value || placeholder}
          onFocus={() => { setOpen(true); setQuery('') }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered[0]) pick(filtered[0])
              else if (allowCustom && query) pick(query)
            } else if (e.key === 'Escape') {
              setOpen(false); setQuery('')
            }
          }}
          style={{ ...inputStyle, paddingRight: 32 }}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--tx-2)' }}>
          <Icon n="chevd" s={15} />
        </span>
      </div>
      {open && (
        <div style={{
          position: 'absolute', zIndex: 50, top: 'calc(100% + 4px)', left: 0, right: 0,
          maxHeight: 240, overflow: 'auto',
          background: 'var(--bg-2, var(--bg-3))', border: '1px solid var(--line)',
          borderRadius: 'var(--r-s)', boxShadow: '0 10px 24px rgba(0,0,0,.35)',
        }}>
          {filtered.length === 0 && (
            <div className="t-3" style={{ padding: '10px 12px', fontSize: 12.5 }}>
              {allowCustom && query
                ? <span>Press Enter to add <b style={{ color: 'var(--ac-bright)' }}>{query}</b></span>
                : 'No matches'}
            </div>
          )}
          {filtered.map((o) => {
            const selected = o === value
            return (
              <button key={o} type="button" onMouseDown={(e) => { e.preventDefault(); pick(o) }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 12px', fontSize: 13, cursor: 'pointer',
                  background: selected ? 'var(--ac-dim)' : 'transparent',
                  color: selected ? 'var(--ac-bright)' : 'var(--tx-0)',
                  border: 'none', borderBottom: '1px solid var(--line-soft)',
                }}>
                {o}
              </button>
            )
          })}
        </div>
      )}
      {/* keep value for SSR/screen readers — silence unused warning */}
      {shown === undefined ? null : null}
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
