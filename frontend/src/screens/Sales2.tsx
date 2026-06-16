/* NMS-Auto — Sales Return + Payment Receipt + Expense (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, statusTone, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { StatRow } from '../components/doc'
import { api } from '../api'
import { money, moneyK, branches as branchSeed } from '../data'
import type { SalesReturn, Customer } from '../types'
import type { Go } from './types'

export function ReturnScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<SalesReturn[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [view, setView] = useState<SalesReturn | null>(null)
  const [form, setForm] = useState<any>({})

  const refresh = () => { setLoading(true); api.returns.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh(); api.invoices.list().then((d) => setInvoices(d as any)).catch(() => {}) }, [])

  const decide = async (id: string, action: 'approve' | 'reject') => {
    if (action === 'approve') await api.approveReturn(id)
    else await api.rejectReturn(id)
    refresh()
  }
  const raise = async () => {
    await api.returns.create({
      invoice: form.invoice, customer: form.customer || '—', rep: 'R. Fernando',
      date: new Date().toISOString().slice(0, 10), amount: +form.amount || 0,
      items: +form.items || 1, reason: form.reason, status: 'Pending Approval', raisedBy: 'R. Fernando',
    } as any)
    setModal(false); setForm({}); refresh()
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
                    <div className="row gap-2"><span className="mono" style={{ fontWeight: 600, color: 'var(--tx-0)' }}>{r.id}</span><span className="t-3" style={{ fontSize: 12 }}>↩ {r.invoice}</span></div>
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
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td mono>{r.invoice}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.customer}</Td>
            <Td>{r.reason}</Td><Td>{r.raisedBy}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(r.amount)}</Td>
            <Td align="center"><Badge tone={statusTone(r.status)} dot>{r.status}</Badge></Td>
            <Td align="right"><button className="mms-act" onClick={() => setView(r)}><Icon n="eye" s={15} /></button></Td>
          </>} />}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} width={580} title="Raise Sales Return" sub="Submitted for administrator approval"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={raise} disabled={!form.invoice}>Submit for Approval</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Against Invoice"><Select value={form.invoice || ''} onChange={(e) => { const inv = invoices.find((i) => i.id === e.target.value); setForm((s: any) => ({ ...s, invoice: e.target.value, customer: inv?.customer })) }}><option value="">Select invoice…</option>{invoices.map((i) => <option key={i.id}>{i.id}</option>)}</Select></Field>
          <Field label="Customer"><Input value={form.customer || ''} readOnly placeholder="auto" /></Field>
          <Field label="Items Returned"><Input type="number" value={form.items || ''} onChange={(e) => setForm((s: any) => ({ ...s, items: e.target.value }))} /></Field>
          <Field label="Return Amount (Rs)"><Input type="number" value={form.amount || ''} onChange={(e) => setForm((s: any) => ({ ...s, amount: e.target.value }))} /></Field>
          <Field label="Reason" full><Select value={form.reason || ''} onChange={(e) => setForm((s: any) => ({ ...s, reason: e.target.value }))}><option value="">Select reason…</option>{['Wrong part', 'Defective', 'Excess order', 'Damaged in transit'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
        </div>
      </Modal>

      <Modal open={!!view} onClose={() => setView(null)} width={520} title={view?.id} sub={'Return against ' + view?.invoice}
        footer={view?.status === 'Pending Approval' ? <><Btn variant="danger" icon="x" onClick={() => { decide(view!.id, 'reject'); setView(null) }}>Reject</Btn><Btn variant="ok" icon="check" onClick={() => { decide(view!.id, 'approve'); setView(null) }}>Approve &amp; Restock</Btn></> : <Badge tone={statusTone(view?.status || '')}>{view?.status}</Badge>}>
        {view && (
          <div className="col gap-3">
            {([['Customer', view.customer], ['Reason', view.reason], ['Items', view.items], ['Amount', money(view.amount)], ['Raised by', view.raisedBy], ['Date', view.date]] as [string, any][]).map(([k, v]) => (
              <div key={k} className="row between" style={{ paddingBottom: 9, borderBottom: '1px solid var(--line-soft)' }}>
                <span className="t-2" style={{ fontSize: 12.5 }}>{k}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  )
}

export function ReceiptScreen({ go: _go }: { go: Go }) {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [receipts, setReceipts] = useState<any[]>([])
  const [cust, setCust] = useState<Customer | null>(null)
  const [alloc, setAlloc] = useState<Record<string, number>>({}); const [mode, setMode] = useState('Cash'); const [posted, setPosted] = useState<number | null>(null)

  useEffect(() => {
    api.customers.list().then((d) => setCustomers(d as any)).catch(() => {})
    api.invoices.list().then((d) => setInvoices(d as any)).catch(() => {})
    api.receipts.list().then((d) => setReceipts(d as any)).catch(() => {})
  }, [])

  const custInvoices = cust ? invoices.filter((i) => i.customer === cust.name && (i.due || 0) > 0) : []
  const synth = cust && custInvoices.length === 0 ? [{ id: 'INV-OPEN-1', due: cust.outstanding, date: '', total: cust.outstanding }] : custInvoices
  const totalAlloc = Object.values(alloc).reduce((a, b) => a + (+b || 0), 0)
  const pick = (c: Customer) => { setCust(c); setAlloc({}); setPosted(null) }
  const post = async () => {
    if (!cust) return
    await api.receipts.create({ customer: cust.name, mode, amount: totalAlloc, date: new Date().toISOString().slice(0, 10), allocations: alloc } as any)
    setPosted(totalAlloc)
    api.receipts.list().then((d) => setReceipts(d as any)).catch(() => {})
  }
  return (
    <div>
      <PageHead crumbs="Data Capture" title="Payment Receipt" icon="wallet" sub="Customer outstanding settlement"
        actions={<Btn variant="solid" icon="print" disabled={!posted}>Print Receipt</Btn>} />
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
              <div className="t-2" style={{ marginTop: 6 }}>{money(posted)} received from {cust.name} via {mode}</div>
              <div className="row gap-2" style={{ marginTop: 20 }}><Btn variant="solid" icon="print">Print</Btn><Btn variant="primary" onClick={() => pick(cust)}>New Receipt</Btn></div>
            </div>
          ) : (
            <div>
              <div className="row between" style={{ marginBottom: 18 }}>
                <div><div className="eyebrow">Settling</div><h3 style={{ fontSize: 19, marginTop: 3 }}>{cust.name}</h3></div>
                <div style={{ textAlign: 'right' }}><div className="t-2" style={{ fontSize: 11.5 }}>Total Outstanding</div><div className="num" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Saira', color: 'var(--warn)' }}>{money(cust.outstanding)}</div></div>
              </div>
              <div style={{ border: '1px solid var(--line)', borderRadius: 'var(--r-m)', overflow: 'hidden', marginBottom: 16 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ background: 'var(--bg-0)' }}>{['Invoice', 'Date', 'Outstanding', 'Allocate'].map((h, i) => <th key={i} style={{ padding: '9px 12px', textAlign: i > 1 ? 'right' : 'left', fontSize: 10.5, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)' }}>{h}</th>)}</tr></thead>
                  <tbody>{synth.map((inv: any) => (
                    <tr key={inv.id}>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono">{inv.id}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)' }} className="mono t-2">{inv.date}</td>
                      <td style={{ padding: '9px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }} className="mono">{money(inv.due)}</td>
                      <td style={{ padding: '6px 12px', borderBottom: '1px solid var(--line-soft)', textAlign: 'right' }}>
                        <input type="number" value={alloc[inv.id] || ''} max={inv.due} placeholder="0" onChange={(e) => setAlloc((s) => ({ ...s, [inv.id]: Math.min(inv.due, +e.target.value) }))} style={{ ...inputStyle, width: 110, padding: '5px 8px', textAlign: 'right', fontFamily: 'JetBrains Mono' }} />
                        <button onClick={() => setAlloc((s) => ({ ...s, [inv.id]: inv.due }))} className="t-3" style={{ background: 'none', border: 'none', fontSize: 10.5, cursor: 'pointer', display: 'block', marginLeft: 'auto', marginTop: 2 }}>full</button>
                      </td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
              <div className="row between wrap gap-3">
                <div className="row gap-3">
                  <Field label="Payment Mode" style={{ width: 160 }}><Select value={mode} onChange={(e) => setMode(e.target.value)}>{['Cash', 'Cheque', 'Bank Transfer', 'Card'].map((m) => <option key={m}>{m}</option>)}</Select></Field>
                  {mode !== 'Cash' && <Field label="Reference" style={{ width: 160 }}><Input placeholder="Ref / Cheque no" /></Field>}
                </div>
                <div className="col" style={{ alignItems: 'flex-end', gap: 10 }}>
                  <div className="row gap-4"><span className="t-2">Receiving</span><span className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira', color: 'var(--ok)' }}>{money(totalAlloc)}</span></div>
                  <Btn variant="primary" size="lg" icon="check" disabled={totalAlloc <= 0} onClick={post}>Post Receipt</Btn>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}

export function ExpenseScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({})

  const refresh = () => { setLoading(true); api.expenses.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const save = async () => {
    await api.expenses.create({ type: form.type, date: form.date || new Date().toISOString().slice(0, 10), amount: +form.amount || 0, branch: form.branch || 'Main Store', note: form.note || '' } as any)
    setModal(false); setForm({}); refresh()
  }
  const remove = async (id: any) => { if (!confirm('Delete?')) return; await api.expenses.remove(id); refresh() }

  return (
    <div>
      <PageHead crumbs="Data Capture" title="Expense" icon="coins" sub={`${rows.length} entries · ${money(rows.reduce((a, r) => a + (r.amount || 0), 0))} total`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Add Expense</Btn>} />
      <StatRow items={[
        { icon: 'coins', label: 'Total Expenses', value: moneyK(rows.reduce((a, r) => a + (r.amount || 0), 0)), c: 'red' },
        { icon: 'list', label: 'Entries', value: rows.length, c: 'ac' },
        { icon: 'store', label: 'Branches', value: 3, c: 'ac' },
        { icon: 'chart', label: 'Avg / Entry', value: rows.length ? moneyK(Math.round(rows.reduce((a, r) => a + (r.amount || 0), 0) / rows.length)) : 'Rs 0', c: 'warn' },
      ]} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Ref' }, { label: 'Type' }, { label: 'Branch' }, { label: 'Date' }, { label: 'Note' }, { label: 'Amount', align: 'right' }, { label: '', align: 'right', w: 60 }]}
          rows={rows}
          render={(r) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.type}</Td>
            <Td>{r.branch}</Td><Td mono>{r.date}</Td><Td c="var(--tx-2)">{r.note || '—'}</Td>
            <Td align="right" mono c="var(--bad)" style={{ fontWeight: 600 }}>{money(r.amount || 0)}</Td>
            <Td align="right"><button className="mms-act danger" onClick={() => remove(r.id)}><Icon n="trash" s={15} /></button></Td>
          </>} />}
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={520} title="Add Expense"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Save</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Expense Type"><Select value={form.type || ''} onChange={(e) => setForm((s: any) => ({ ...s, type: e.target.value }))}><option value="">Select…</option>{['Fuel', 'Salary', 'Rent', 'Utilities', 'Transport', 'Maintenance', 'Misc'].map((t) => <option key={t}>{t}</option>)}</Select></Field>
          <Field label="Branch"><Select value={form.branch || ''} onChange={(e) => setForm((s: any) => ({ ...s, branch: e.target.value }))}>{branchSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Amount (Rs)"><Input type="number" value={form.amount || ''} onChange={(e) => setForm((s: any) => ({ ...s, amount: e.target.value }))} /></Field>
          <Field label="Date"><Input type="date" value={form.date || ''} onChange={(e) => setForm((s: any) => ({ ...s, date: e.target.value }))} /></Field>
          <Field label="Note" full><Input value={form.note || ''} onChange={(e) => setForm((s: any) => ({ ...s, note: e.target.value }))} placeholder="Optional" /></Field>
        </div>
      </Modal>
    </div>
  )
}
