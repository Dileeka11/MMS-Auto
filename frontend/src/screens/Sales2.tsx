/* NMS-Auto — Sales Return + Payment Receipt + Expense (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, DateInput, Select, Modal, Table, Td, statusTone, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow } from '../components/doc'
import { api, clearListCache } from '../api'
import { useNotify } from '../components/Notify'
import { AttachmentField, AttachmentLink } from '../components/Attachment'
import { userCan } from '../lib/permissions'
import { printReceipts } from '../lib/receiptPrint'
import { money, moneyK, fmtDate } from '../data'
import { useBranches } from '../hooks'
import type { SalesReturn, Customer, CashBookAccount } from '../types'
import type { Go, ScreenProps } from './types'

export function ReturnScreen({ go: _go, user }: ScreenProps) {
  const [rows, setRows] = useState<SalesReturn[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [view, setView] = useState<SalesReturn | null>(null)
  const [form, setForm] = useState<any>({})
  /** invoice line id → qty being returned */
  const [qtys, setQtys] = useState<Record<number, string>>({})
  const [error, setError] = useState('')

  const refresh = () => { setLoading(true); api.returns.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh(); api.invoices.list().then((d) => setInvoices(d as any)).catch(() => {}) }, [])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve') await api.approveReturn(id)
    else await api.rejectReturn(id)
    refresh()
  }

  const inv = invoices.find((i) => i.code === form.invoice)
  // Qty already on returns (pending or approved) per invoice line.
  const returned = (lineId: number) => rows
    .filter((r) => r.status !== 'Rejected')
    .reduce((s, r) => s + (r.lines || []).filter((l) => l.invoiceLineId === lineId).reduce((t, l) => t + l.qty, 0), 0)
  // Same valuation the server uses: net rate after an approved discount, plus VAT if charged.
  const factor = inv?.discountStatus === 'approved' ? 1 - (inv.discountPct || 0) / 100 : 1
  const net = (inv?.lines || []).reduce((s: number, l: any) => s + (parseInt(qtys[l.id]) || 0) * Math.round(l.rate * factor * 100) / 100, 0)
  const vat = inv?.vatApplied ? Math.round(net * (inv.vatPct || 0)) / 100 : 0
  const picked = Object.values(qtys).some((q) => parseInt(q) > 0)

  const closeModal = () => { setModal(false); setForm({}); setQtys({}); setError('') }
  const raise = async () => {
    try {
      await api.returns.create({
        invoice: form.invoice, rep: inv?.rep, reason: form.reason, raisedBy: user?.name || null,
        lines: Object.entries(qtys).filter(([, q]) => parseInt(q) > 0).map(([id, q]) => ({ invoiceLineId: Number(id), qty: parseInt(q) })),
      } as any)
      closeModal(); refresh()
    } catch (e: any) {
      const d = e?.response?.data
      setError((d?.errors && (Object.values(d.errors)[0] as string[])[0]) || d?.message || 'Could not raise the return.')
    }
  }
  const pending = rows.filter((r) => r.status === 'Pending Approval')
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Sales Return" icon="refund" sub={`${rows.length} returns · ${pending.length} awaiting admin approval`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Raise Return</Btn>} />

      {pending.length > 0 && (
        <Card style={{ marginBottom: 16, border: '1px solid var(--warn)' }}>
          <div className="row between" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 16 }} className="row gap-2"><Icon n="clock" s={18} c="var(--warn)" /><span>Pending Approval ({pending.length})</span></h3>
            <Badge tone="amber">Admin action required</Badge>
          </div>
          <div className="col gap-2">
            {pending.map((r) => (
              <div key={r.id} className="ret-pend row between wrap gap-3" style={{ padding: '12px 14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
                <div className="row gap-3">
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--warn-dim)', display: 'grid', placeItems: 'center', color: 'var(--warn)' }}><Icon n="refund" s={18} /></div>
                  <div>
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--tx-0)' }}>{r.code ?? r.id}</span><span className="t-3" style={{ fontSize: 12 }}>↩ {r.invoice}</span></div>
                    <div className="t-2" style={{ fontSize: 12, marginTop: 2 }}>{r.customer} · {r.reason} · raised by {r.raisedBy}</div>
                  </div>
                </div>
                <div className="row gap-3">
                  <span className="num" style={{ fontWeight: 600 }}>{money(r.amount)}</span>
                  <div className="row gap-2">
                    <Btn variant="ok" size="sm" icon="check" onClick={() => decide(r.id, 'approve')}>Approve</Btn>
                    <Btn variant="danger" size="sm" icon="x" onClick={() => decide(r.id, 'reject')}>Reject</Btn>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card pad={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }} className="eyebrow">All Returns</div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Return No' }, { label: 'Invoice' }, { label: 'Customer' }, { label: 'Reason' }, { label: 'Raised By' }, { label: 'Amount', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 60 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.code ?? r.id}</Td>
            <Td mono>{r.invoice}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.reason}</Td><Td>{r.raisedBy}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.amount)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><button className="mms-act" onClick={() => setView(r)}><Icon n="eye" s={15} /></button></Td>
          </>} />}
      </Card>

      <Modal open={modal} onClose={closeModal} width={680} title="Raise Sales Return" sub="Pick the items coming back — stock and accounts update when an admin approves"
        footer={<><Btn variant="plain" onClick={closeModal}>Cancel</Btn><Btn variant="primary" icon="check" onClick={raise} disabled={!form.invoice || !picked}>Submit for Approval</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Against Invoice"><Select value={form.invoice || ''} onChange={(e) => { setForm((s: any) => ({ ...s, invoice: e.target.value })); setQtys({}); setError('') }}><option value="">Select invoice…</option>{invoices.map((i) => <option key={i.id} value={i.code}>{i.code} · {i.customer}</option>)}</Select></Field>
          <Field label="Customer"><Input value={inv?.customer || ''} readOnly placeholder="auto" /></Field>
          {inv && (
            <div style={{ gridColumn: '1 / -1', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px', gap: 10, padding: '8px 12px', background: 'var(--bg-2)', fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase' }}>
                <div>Item</div><div style={{ textAlign: 'right' }}>Sold</div><div style={{ textAlign: 'right' }}>Can return</div><div style={{ textAlign: 'right' }}>Return qty</div>
              </div>
              {(inv.lines || []).map((l: any) => {
                const left = l.qty - returned(l.id)
                return (
                  <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 80px 90px 110px', gap: 10, padding: '8px 12px', alignItems: 'center', borderTop: '1px solid var(--line-soft)', fontSize: 13 }}>
                    <div>{l.code && <span className="mono t-2" style={{ marginRight: 6 }}>{l.code}</span>}{l.name}</div>
                    <div className="mono" style={{ textAlign: 'right' }}>{l.qty}</div>
                    <div className="mono" style={{ textAlign: 'right' }}>{left}</div>
                    <Input type="number" min="0" max={left} disabled={left <= 0} value={qtys[l.id] || ''} placeholder="0" style={{ textAlign: 'right' }}
                      onChange={(e) => setQtys((s) => ({ ...s, [l.id]: String(Math.min(left, Math.max(0, parseInt(e.target.value) || 0)) || '') }))} />
                  </div>
                )
              })}
              <div className="row between" style={{ padding: '10px 12px', borderTop: '1px solid var(--line)', fontSize: 13 }}>
                <span className="t-2">{factor < 1 ? `Less ${inv.discountPct}% discount · ` : ''}{vat ? `incl. VAT ${money(vat)}` : 'No VAT'}</span>
                <b className="mono">Credit {money(net + vat)}</b>
              </div>
            </div>
          )}
          <Field label="Reason" full><Select value={form.reason || ''} onChange={(e) => setForm((s: any) => ({ ...s, reason: e.target.value }))}><option value="">Select reason…</option>{['Wrong part', 'Defective', 'Excess order', 'Damaged in transit'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          {error && <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>{error}</div>}
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} width={520} title={view?.code ?? view?.id} sub={'Return against ' + view?.invoice}
        footer={view?.status === 'Pending Approval' ? <><Btn variant="danger" icon="x" onClick={() => { decide(view!.id, 'reject'); setView(null) }}>Reject</Btn><Btn variant="ok" icon="check" onClick={() => { decide(view!.id, 'approve'); setView(null) }}>Approve &amp; Restock</Btn></> : <Badge tone={statusTone(view?.status || '')}>{view?.status}</Badge>}>
        {view && (
          <div className="col gap-3">
            {([['Customer', view.customer], ['Reason', view.reason], ['Items', view.items], ['Amount', money(view.amount)], ['Raised by', view.raisedBy], ['Date', fmtDate(view.date)]] as [string, any][]).map(([k, v]) => (
              <div key={k} className="row between" style={{ paddingBottom: 9, borderBottom: '1px solid var(--line-soft)' }}>
                <span className="t-2" style={{ fontSize: 12.5 }}>{k}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
            {(view.lines || []).length > 0 && (
              <div style={{ marginTop: 4 }}>
                <div className="t-2" style={{ fontSize: 12.5, marginBottom: 6 }}>Items returned</div>
                {view.lines!.map((l) => (
                  <div key={l.id} className="row between" style={{ fontSize: 13, padding: '4px 0' }}>
                    <span>{l.name}</span><span className="mono">{l.qty} × {money(l.rate)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

const OPEN_BALANCE = 'OPEN'
const today = () => new Date().toISOString().slice(0, 10)

export function ReceiptScreen({ user }: ScreenProps) {
  const notify = useNotify()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [cust, setCust] = useState<Customer | null>(null)
  /** invoice id (or OPEN_BALANCE) → amount being settled */
  const [alloc, setAlloc] = useState<Record<string, number>>({})
  const [mode, setMode] = useState('Cash'); const [date, setDate] = useState(today())
  const [reference, setReference] = useState('')
  const [chequeNo, setChequeNo] = useState(''); const [chequeBank, setChequeBank] = useState(''); const [chequeDate, setChequeDate] = useState('')
  const [cashAccounts, setCashAccounts] = useState<CashBookAccount[]>([]); const [depositTo, setDepositTo] = useState('')
  const [saving, setSaving] = useState(false)
  /** receipts created by the last post (for the success panel + print) */
  const [posted, setPosted] = useState<any[] | null>(null)
  const canDelete = userCan(user, 'Payment Receipt', 'Delete')

  const loadAll = () => {
    clearListCache()
    api.customers.list().then((d) => {
      setCustomers(d as any)
      setCust((c) => (c ? (d as any[]).find((x) => x.id === c.id) || c : c))
    }).catch(() => {})
    api.invoices.list().then((d) => setInvoices(d as any)).catch(() => {})
    api.receipts.list().then((d) => setReceipts(d as any)).catch(() => {})
  }
  useEffect(() => {
    api.accounting.cashbook.accounts().then((a) => setCashAccounts((a as CashBookAccount[]).filter((x) => x.isPostable))).catch(() => {})
    loadAll()
  }, [])

  // open invoices, oldest first; any balance not covered by an invoice is an opening balance
  const custInvoices = cust
    ? invoices.filter((i) => i.customer === cust.name && (i.due || 0) > 0).sort((a, b) => String(a.date).localeCompare(String(b.date)) || a.id - b.id)
    : []
  const invDue = custInvoices.reduce((a, i) => a + (i.due || 0), 0)
  const openBal = cust ? Math.round(((cust.outstanding || 0) - invDue) * 100) / 100 : 0
  const rows = [
    ...custInvoices.map((i) => ({ key: String(i.id), no: i.code || i.id, date: i.date, due: i.due })),
    ...(openBal > 0 ? [{ key: OPEN_BALANCE, no: 'Opening / On Account', date: '', due: openBal }] : []),
  ]
  const totalAlloc = Math.round(Object.values(alloc).reduce((a, b) => a + (+b || 0), 0) * 100) / 100
  const cheque = mode === 'Cheque'

  const resetForm = () => { setAlloc({}); setReference(''); setChequeNo(''); setChequeBank(''); setChequeDate(''); setDate(today()) }
  const pick = (c: Customer) => { setCust(c); resetForm(); setPosted(null) }
  const setRow = (key: string, due: number, v: number) => setAlloc((s) => ({ ...s, [key]: Math.max(0, Math.min(due, v || 0)) }))
  const allFull = () => setAlloc(Object.fromEntries(rows.map((r) => [r.key, r.due])))

  const post = async () => {
    if (!cust || totalAlloc <= 0 || saving) return
    if (cheque && !chequeNo.trim()) { notify.error('Cheque number required', 'Enter the cheque number for a cheque payment.'); return }
    setSaving(true)
    try {
      const created = await api.receipts.create({
        customer: cust.name, mode, amount: totalAlloc, date,
        reference: reference || null,
        chequeNo: cheque ? chequeNo : null, chequeBankName: cheque ? chequeBank || null : null, chequeDate: cheque ? chequeDate || null : null,
        accountId: depositTo ? Number(depositTo) : null,
        allocations: Object.entries(alloc).filter(([k, v]) => k !== OPEN_BALANCE && v > 0).map(([k, v]) => ({ invoiceId: Number(k), amount: v })),
      } as any)
      setPosted(created as any)
      resetForm()
      loadAll()
    } catch (e: any) {
      notify.error('Receipt not posted', e?.response?.data?.message || e?.message || 'Please try again.')
    } finally { setSaving(false) }
  }

  const remove = async (r: any) => {
    const ok = await notify.confirm({ title: `Delete receipt ${r.code}?`, msg: `${money(r.amount)} will be added back to ${r.customer}'s outstanding${r.against && r.against !== 'On Account' ? ` and invoice ${r.against} reopens` : ''}.`, danger: true, okText: 'Delete' })
    if (!ok) return
    try { await api.receipts.remove(r.id); loadAll() } catch (e: any) { notify.error('Receipt not deleted', e?.response?.data?.message || e?.message || 'Please try again.') }
  }

  const history = cust ? receipts.filter((r) => r.customer === cust.name) : receipts
  const postedTotal = (posted || []).reduce((a, r) => a + (+r.amount || 0), 0)

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Payment Receipt" icon="wallet" sub="Customer outstanding settlement"
        actions={<Btn variant="solid" icon="print" disabled={!posted} onClick={() => posted && printReceipts(posted)}>Print Receipt</Btn>} />
      <StatRow items={[
        { icon: 'wallet', label: 'Total Receivable', value: moneyK(customers.reduce((a, c) => a + (c.outstanding || 0), 0)), c: 'warn' },
        { icon: 'users', label: 'Customers w/ Balance', value: customers.filter((c) => (c.outstanding || 0) > 0).length, c: 'ac' },
        { icon: 'shield', label: 'Over Credit Limit', value: customers.filter((c) => c.status === 'risk').length, c: 'red' },
        { icon: 'check', label: 'Receipts Total', value: receipts.length, c: 'green' },
      ]} />
      <div className="rcp-grid" style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 16, alignItems: 'start' }}>
        <Card pad={0}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Customers · Outstanding</div>
          <div style={{ maxHeight: 540, overflowY: 'auto' }}>
            {customers.filter((c) => (c.outstanding || 0) > 0).map((c) => (
              <button key={c.id} onClick={() => pick(c)} className="row between mms-row" style={{ width: '100%', padding: '12px 16px', background: cust?.id === c.id ? 'var(--ac-dim)' : 'transparent', border: 'none', borderBottom: '1px solid var(--line-soft)', borderLeft: '3px solid ' + (cust?.id === c.id ? 'var(--ac)' : 'transparent'), textAlign: 'left', color: 'var(--tx-0)' }}>
                <div><div style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</div><div className="t-3" style={{ fontSize: 11 }}>{c.city} · {c.credit}d terms</div></div>
                <div style={{ textAlign: 'right' }}><div className="num" style={{ fontSize: 13, fontWeight: 600, color: c.status === 'risk' ? 'var(--bad)' : 'var(--warn)' }}>{moneyK(c.outstanding)}</div></div>
              </button>
            ))}
          </div>
        </Card>
        <Card>
          {!cust ? (
            <div className="col center" style={{ padding: '80px 20px', textAlign: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 14, background: 'var(--bg-3)', display: 'grid', placeItems: 'center', color: 'var(--tx-3)', marginBottom: 16 }}><Icon n="wallet" s={28} /></div>
              <div className="t-2">Select a customer to settle outstanding invoices</div>
            </div>
          ) : posted ? (
            <div className="col center" style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--ok-dim)', display: 'grid', placeItems: 'center', color: 'var(--ok)', marginBottom: 18 }}><Icon n="check" s={32} /></div>
              <h3 style={{ fontSize: 20 }}>Receipt Posted</h3>
              <div className="t-2" style={{ marginTop: 6 }}>{money(postedTotal)} received from {cust.name} via {posted[0]?.mode}</div>
              <div className="t-3 mono" style={{ marginTop: 6, fontSize: 12 }}>{posted.map((r) => `${r.code} → ${r.against}`).join(' · ')}</div>
              <div className="row gap-2" style={{ marginTop: 20 }}><Btn variant="solid" icon="print" onClick={() => printReceipts(posted)}>Print</Btn><Btn variant="primary" onClick={() => pick(cust)}>New Receipt</Btn></div>
            </div>
          ) : (
            <div>
              <div className="row between" style={{ marginBottom: 18 }}>
                <div><div className="eyebrow">Settling</div><h3 style={{ fontSize: 19, marginTop: 3 }}>{cust.name}</h3></div>
                <div style={{ textAlign: 'right' }}><div className="t-2" style={{ fontSize: 11.5 }}>Total Outstanding</div><div className="num" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Saira', color: 'var(--warn)' }}>{money(cust.outstanding)}</div></div>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg-0)' }}>{['Invoice No', 'Date', 'Outstanding', 'Allocate'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{i === 3 ? <span className="row gap-2" style={{ justifyContent: 'flex-end' }}>{h}<button onClick={allFull} style={{ background: 'none', border: 'none', color: 'var(--ac)', fontSize: 10.5, cursor: 'pointer', textTransform: 'uppercase' }}>all full</button></span> : h}</th>)}</tr></thead>
                  <tbody>
                    {rows.length === 0 && <tr><td colSpan={4} style={{ padding: '14px 12px' }} className="t-3">No open invoices.</td></tr>}
                    {rows.map((r) => (
                      <tr key={r.key}>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono">{r.no}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono t-2">{r.date ? fmtDate(r.date) : '—'}</td>
                        <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }} className="mono">{money(r.due)}</td>
                        <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                          <input type="number" min={0} max={r.due} value={alloc[r.key] || ''} placeholder="0" onChange={(e) => setRow(r.key, r.due, +e.target.value)} style={{ ...inputStyle, width: 120, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                          <button onClick={() => setRow(r.key, r.due, alloc[r.key] === r.due ? 0 : r.due)} className="t-3" style={{ background: 'none', border: 'none', fontSize: 10.5, cursor: 'pointer', display: 'block', marginLeft: 'auto', marginTop: 2, color: alloc[r.key] === r.due ? 'var(--ok)' : undefined }}>{alloc[r.key] === r.due ? '✓ full' : 'full'}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {openBal < 0 && (
                <div style={{ marginBottom: 14, padding: '9px 12px', borderRadius: 'var(--r-m)', background: 'var(--warn-dim)', color: 'var(--warn)', fontSize: 12.5 }}>
                  Open invoices total {money(invDue)}, but the customer owes {money(cust.outstanding)}. {money(-openBal)} was received earlier "On Account" without settling an invoice — check before collecting the full amount.
                </div>
              )}
              <div className="row between wrap gap-3" style={{ alignItems: 'flex-end' }}>
                <div className="row gap-3 wrap">
                  <Field label="Receipt Date" style={{ width: 150 }}><DateInput value={date} onChange={setDate} /></Field>
                  <Field label="Payment Mode" style={{ width: 150 }}><Select value={mode} onChange={(e) => setMode(e.target.value)}>{['Cash', 'Cheque', 'Bank Transfer', 'Card'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
                  <Field label="Deposit To" style={{ width: 200 }}><Select value={depositTo} onChange={(e) => setDepositTo(e.target.value)}><option value="">{mode === 'Cash' ? 'Cash (default)' : 'Bank (default)'}</option>{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></Field>
                  {cheque && <>
                    <Field label="Cheque No" style={{ width: 140 }}><Input value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} placeholder="Cheque no" /></Field>
                    <Field label="Cheque Bank" style={{ width: 170 }}><Input value={chequeBank} onChange={(e) => setChequeBank(e.target.value)} placeholder="Bank name" /></Field>
                    <Field label="Cheque Date" style={{ width: 150 }}><DateInput value={chequeDate} onChange={setChequeDate} /></Field>
                  </>}
                  {mode !== 'Cash' && <Field label="Reference" style={{ width: 170 }}><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Ref / slip no" /></Field>}
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 10 }}>
                  <div className="row gap-4"><span className="t-2">Receiving</span><span className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira', color: 'var(--ok)' }}>{money(totalAlloc)}</span></div>
                  <Btn variant="primary" size="lg" icon="check" disabled={totalAlloc <= 0 || saving} onClick={post}>{saving ? 'Posting…' : 'Post Receipt'}</Btn>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card pad={0} style={{ marginTop: 16 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Receipts{cust ? ` · ${cust.name}` : ''}</div>
        <div style={{ maxHeight: 420, overflowY: 'auto' }}>
          <Table rows={history} empty="No receipts yet"
            cols={[{ label: 'Receipt No' }, { label: 'Date' }, { label: 'Customer' }, { label: 'Against' }, { label: 'Mode' }, { label: 'Amount', align: 'right' }, { label: '', w: 80 }]}
            render={(r: any) => <>
              <Td mono>{r.code}</Td>
              <Td mono>{fmtDate(r.date)}</Td>
              <Td>{r.customer}</Td>
              <Td mono>{r.against || 'On Account'}</Td>
              <Td>{r.mode}{r.chequeNo ? ` #${r.chequeNo}` : ''}</Td>
              <Td align="right" mono>{money(r.amount)}</Td>
              <Td align="right">
                <span className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                  <button className="mms-act" title="Print receipt" onClick={() => printReceipts([r])}><Icon n="print" s={15} /></button>
                  {canDelete && <button className="mms-act" title="Delete receipt" onClick={() => remove(r)}><Icon n="trash" s={15} /></button>}
                </span>
              </Td>
            </>} />
        </div>
      </Card>
    </div>
  )
}

export function ExpenseScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({})
  const [uploading, setUploading] = useState(false); const [saving, setSaving] = useState(false)
  const [types, setTypes] = useState<any[]>([])
  const [cashAccounts, setCashAccounts] = useState<CashBookAccount[]>([])
  const branches = useBranches()

  const refresh = () => { setLoading(true); api.expenses.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => {
    refresh()
    api.master('expenseType').list().then((d: any[]) => setTypes(d.filter((t) => t.status !== 'Inactive'))).catch(() => {})
    api.accounting.cashbook.accounts().then((a) => setCashAccounts((a as CashBookAccount[]).filter((x) => x.isPostable))).catch(() => {})
  }, [])

  const save = async () => {
    if (!form.type) { alert('Select an expense type'); return }
    setSaving(true)
    try {
      await api.expenses.create({ type: form.type, date: form.date || new Date().toISOString().slice(0, 10), amount: +form.amount || 0, branch: form.branch || null, note: form.note || '', attachment: form.attachment || null, paymentAccountId: form.paidFrom ? Number(form.paidFrom) : null } as any)
      setModal(false); setForm({}); refresh()
    } catch (e: any) {
      const d = e?.response?.data
      alert((d?.errors && (Object.values(d.errors)[0] as string[])?.[0]) || d?.message || 'Expense not saved')
    } finally { setSaving(false) }
  }
  const remove = async (id: any) => { if (!confirm('Delete?')) return; await api.expenses.remove(id); refresh() }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Expense" icon="coins" sub={`${rows.length} entries · ${money(rows.reduce((a, r) => a + (r.amount || 0), 0))} total`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Add Expense</Btn>} />
      <StatRow items={[
        { icon: 'coins', label: 'Total Expenses', value: moneyK(rows.reduce((a, r) => a + (r.amount || 0), 0)), c: 'red' },
        { icon: 'list', label: 'Entries', value: rows.length, c: 'ac' },
        { icon: 'store', label: 'Branches', value: branches.length, c: 'ac' },
        { icon: 'chart', label: 'Avg / Entry', value: rows.length ? moneyK(Math.round(rows.reduce((a, r) => a + (r.amount || 0), 0) / rows.length)) : 'Rs 0', c: 'warn' },
      ]} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Ref' }, { label: 'Type' }, { label: 'Branch' }, { label: 'Date' }, { label: 'Note' }, { label: 'Amount', align: 'right' }, { label: '', align: 'right', w: 90 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.type}</Td>
            <Td>{r.branch || '—'}</Td><Td mono>{fmtDate(r.date)}</Td><Td c="var(--tx-2)">{r.note || '—'}</Td>
            <Td align="right" mono c="var(--bad)" style={{ fontWeight: 600 }}>{money(r.amount || 0)}</Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <AttachmentLink path={r.attachment} title="View bill / receipt" />
              <button className="mms-act danger" onClick={() => remove(r.id)}><Icon n="trash" s={15} /></button>
            </div></Td>
          </>} />}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={520} title="Add Expense"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save} disabled={saving || uploading}>{saving ? 'Saving…' : 'Save'}</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Expense Type"><Select value={form.type || ''} onChange={(e) => setForm((s: any) => ({ ...s, type: e.target.value }))}><option value="">{types.length ? 'Select…' : 'No expense types — add in Master Files'}</option>{types.map((t) => <option key={t.id} value={t.name}>{t.code ? `${t.code} · ${t.name}` : t.name}</option>)}</Select></Field>
          <Field label="Branch"><Select value={form.branch || ''} onChange={(e) => setForm((s: any) => ({ ...s, branch: e.target.value }))}><option value="">{branches.length ? 'Select…' : 'No branches — add in Master Files'}</option>{branches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Amount (Rs)"><Input type="number" value={form.amount || ''} onChange={(e) => setForm((s: any) => ({ ...s, amount: e.target.value }))} /></Field>
          <Field label="Date"><DateInput value={form.date || ''} onChange={(v) => setForm((s: any) => ({ ...s, date: v }))} /></Field>
          <Field label="Paid From" full><Select value={form.paidFrom || ''} onChange={(e) => setForm((s: any) => ({ ...s, paidFrom: e.target.value }))}><option value="">Cash (default)</option>{cashAccounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></Field>
          <Field label="Note" full><Input value={form.note || ''} onChange={(e) => setForm((s: any) => ({ ...s, note: e.target.value }))} placeholder="Optional" /></Field>
          <AttachmentField label="Bill / Receipt" folder="expenses" full hint="Photo or PDF of the bill"
            value={form.attachment} onChange={(p) => setForm((s: any) => ({ ...s, attachment: p }))} onBusy={setUploading} />
        </div>
      </Modal>
    </div>
  )
}
