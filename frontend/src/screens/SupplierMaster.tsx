/* NMS-Auto — Supplier Master (full CRUD, API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td } from '../components/ui'
import { Icon } from '../components/Icon'
import { api } from '../api'
import type { Supplier } from '../types'
import type { Go } from './types'
import { downloadXls } from './ItemMaster'

const CURRENCIES = ['USD', 'LKR', 'EUR', 'JPY', 'GBP', 'CNY', 'INR']
const PAYMENT_TERMS = ['100% TT in advance', 'DP at sight', 'DA 30 Days', 'DA 60 Days', 'LC at sight']

type FormState = Partial<Supplier> & Record<string, any>

export function SupplierMasterScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null)
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const refresh = () => {
    setLoading(true)
    ;(api as any).suppliers.list()
      .then((d: Supplier[]) => setRows(d))
      .finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const open = (r?: Supplier) => {
    setErr('')
    setForm(r ? { ...r } : { currency: 'USD', paymentTerms: 'DA 30 Days', status: 'Active' })
    setModal(r ? 'edit' : 'add')
  }
  const save = async () => {
    if (!(form.name || '').toString().trim()) { setErr('Name is required'); return }
    setSaving(true); setErr('')
    try {
      if (modal === 'add') await (api as any).suppliers.create(form)
      else await (api as any).suppliers.update(form.id, form)
      setModal(null); refresh()
    } catch (e: any) {
      setErr(e?.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }
  const remove = async (id: any) => {
    if (!confirm('Delete this supplier?')) return
    await (api as any).suppliers.remove(id); refresh()
  }

  const f = rows.filter((r) => !q ||
    [r.name, r.code, r.city, r.country, r.contact, r.email]
      .some((v) => (v || '').toLowerCase().includes(q.toLowerCase())))

  const active = rows.filter((r) => (r.status || 'Active') === 'Active').length
  const set = (k: keyof Supplier, v: any) => setForm((s) => ({ ...s, [k]: v }))

  return (
    <div>
      <PageHead crumbs="Master Files" title="Supplier Master" icon="truck"
        sub={`${rows.length} suppliers · ${active} active`}
        actions={<>
          <Btn variant="solid" icon="excel"
            onClick={() => downloadXls('Suppliers.xls',
              ['Code', 'Name', 'Contact', 'Email', 'City', 'Country', 'Tax No', 'Payment Terms', 'Currency', 'Status'],
              f.map((s) => [s.code || '', s.name, s.contact || '', s.email || '', s.city || '', s.country || '', s.taxNo || '', s.paymentTerms || '', s.currency || '', s.status || '']))}>Export</Btn>
          <Btn variant="primary" icon="plus" onClick={() => open()}>Add Supplier</Btn>
        </>} />
      <Card pad={0}>
        <div className="row gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 340, maxWidth: '60vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search suppliers…"
              style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> : (
          <Table cols={[
            { label: 'Code', w: 90 }, { label: 'Supplier' }, { label: 'Contact' }, { label: 'Email' },
            { label: 'City' }, { label: 'Country' }, { label: 'Terms', align: 'center' },
            { label: 'Ccy', align: 'center', w: 70 }, { label: 'Status', align: 'center' },
            { label: '', align: 'right', w: 90 },
          ]}
            rows={f}
            empty="No suppliers yet — click Add Supplier."
            render={(s) => <>
              <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{s.code || '—'}</Td>
              <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{s.name}</Td>
              <Td mono>{s.contact || '—'}</Td>
              <Td>{s.email || '—'}</Td>
              <Td>{s.city || '—'}</Td>
              <Td>{s.country || '—'}</Td>
              <Td align="center">{s.paymentTerms || '—'}</Td>
              <Td align="center" mono>{s.currency || '—'}</Td>
              <Td align="center"><Badge tone={(s.status || 'Active') === 'Active' ? 'green' : 'neutral'} dot>{s.status || 'Active'}</Badge></Td>
              <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                <button className="mms-act" onClick={() => open(s)}><Icon n="edit" s={15} /></button>
                <button className="mms-act" onClick={() => remove(s.id)}><Icon n="trash" s={15} /></button>
              </div></Td>
            </>} />
        )}
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} width={760}
        title={(modal === 'add' ? 'Add ' : 'Edit ') + 'Supplier'}
        sub={modal === 'add' ? 'Code is generated automatically' : (form.code || '')}
        footer={<>
          <Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Name *" style={{ gridColumn: '1 / -1' }}>
            <Input autoFocus value={form.name || ''} onChange={(e) => set('name', e.target.value)} placeholder="Supplier company name" />
          </Field>
          <Field label="Contact"><Input value={form.contact || ''} onChange={(e) => set('contact', e.target.value)} placeholder="Phone" /></Field>
          <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="sales@supplier.com" /></Field>
          <Field label="City"><Input value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Country"><Input value={form.country || ''} onChange={(e) => set('country', e.target.value)} /></Field>
          <Field label="Tax / VAT No"><Input value={form.taxNo || ''} onChange={(e) => set('taxNo', e.target.value)} /></Field>
          <Field label="Currency">
            <Select value={form.currency || 'USD'} onChange={(e) => set('currency', e.target.value)}>
              {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
            </Select>
          </Field>
          <Field label="Payment Terms">
            <Select value={form.paymentTerms || 'DA 30 Days'} onChange={(e) => set('paymentTerms', e.target.value)}>
              {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Status">
            <Select value={form.status || 'Active'} onChange={(e) => set('status', e.target.value)}>
              {['Active', 'Inactive'].map((t) => <option key={t}>{t}</option>)}
            </Select>
          </Field>
          <Field label="Address" style={{ gridColumn: '1 / -1' }}>
            <Input value={form.address || ''} onChange={(e) => set('address', e.target.value)} placeholder="Street, area" />
          </Field>
          <Field label="Notes" style={{ gridColumn: '1 / -1' }}>
            <Input value={form.notes || ''} onChange={(e) => set('notes', e.target.value)} placeholder="Optional" />
          </Field>
          {err && (
            <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
              {err}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
