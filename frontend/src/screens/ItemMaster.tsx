/* NMS-Auto — Item Master (Excel export w/o Qty) + Customer Master, ported from itemMaster.jsx */
import { useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import DB from '../data'
import type { Item, Customer } from '../types'
import type { Go } from './types'

export function downloadXls(filename: string, headers: string[], rows: (string | number)[][]) {
  let html = '<table><thead><tr>' + headers.map((h) => `<th>${h}</th>`).join('') + '</tr></thead><tbody>'
  rows.forEach((r) => { html += '<tr>' + r.map((c) => `<td>${c}</td>`).join('') + '</tr>' })
  html += '</tbody></table>'
  const blob = new Blob(['﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' + html + '</body></html>'], { type: 'application/vnd.ms-excel' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
}

export function ItemMasterScreen({ go }: { go: Go }) {
  const D = DB
  const [rows, setRows] = useState<Item[]>(D.items)
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [brand, setBrand] = useState(''); const [stat, setStat] = useState('')
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null); const [form, setForm] = useState<any>({}); const [toast, setToast] = useState('')
  const [codeErr, setCodeErr] = useState('')
  const open = (r?: Item) => { setForm(r || { unit: 'Pcs', group: 'OEM', status: 'in', reorder: 12 }); setCodeErr(''); setModal(r ? 'edit' : 'add') }
  const codeTaken = (code: string) => {
    const c = (code || '').trim().toLowerCase()
    if (!c) return false
    return rows.some((x) => x.code.trim().toLowerCase() === c && x.id !== form.id)
  }
  const save = () => {
    const code = (form.code || '').trim()
    if (!code) { setCodeErr('Item code is required.'); return }
    if (codeTaken(code)) { setCodeErr(`Item code "${code}" already exists.`); return }
    if (modal === 'add') setRows((r) => [{ ...form, code, id: 'IT' + (2000 + r.length), qty: Number(form.qty || 0) }, ...r])
    else setRows((r) => r.map((x) => (x.id === form.id ? { ...form, code } : x)))
    setModal(null); setCodeErr('')
  }
  const f = rows.filter((r) => (!q || (r.name + r.code).toLowerCase().includes(q.toLowerCase())) && (!cat || r.category === cat) && (!brand || r.brand === brand) && (!stat || r.status === stat))

  const exportExcel = () => {
    // NOTE: Quantity / stock columns intentionally EXCLUDED (price list export)
    const headers = ['Item Code', 'Item Name', 'Brand', 'Category', 'Group', 'Unit', 'Rack', 'Avg Cost (Rs)', 'FIFO Cost (Rs)', 'Selling Price (Rs)']
    const data = f.map((i) => [i.code, i.name, i.brand, i.category, i.group, i.unit, i.rack, i.avgCost, i.fifoCost, i.price])
    downloadXls('NMS-Auto_Item_Master_PriceList.xls', headers, data)
    setToast('Exported ' + f.length + ' items to Excel (without quantity)'); setTimeout(() => setToast(''), 3200)
  }

  const stTone: Record<string, 'green' | 'amber' | 'red'> = { in: 'green', low: 'amber', out: 'red' }
  const stLabel: Record<string, string> = { in: 'In Stock', low: 'Low', out: 'Out' }
  return (
    <div>
      <PageHead crumbs="Master Files" title="Item Master" icon="pkg" sub={`${rows.length} spare parts · ${rows.filter((i) => i.status !== 'in').length} need attention`}
        actions={<>
          <Btn variant="solid" icon="excel" onClick={exportExcel}>Export Excel</Btn>
          <Btn variant="solid" icon="upload">Import</Btn>
          <Btn variant="primary" icon="plus" onClick={() => open()}>Add Item</Btn>
        </>} />

      <div className="info-banner row gap-2" style={{ padding: '10px 14px', background: 'var(--ac-dim)', border: '1px solid var(--ac-line)', borderRadius: 'var(--r-s)', marginBottom: 16, fontSize: 12.5, color: 'var(--ac-bright)' }}>
        <Icon n="excel" s={16} /><span><b>Price-List Export</b> — the Excel export contains item details &amp; prices only. Quantity / stock columns are deliberately omitted.</span>
      </div>

      <Card pad={0}>
        <div className="row between wrap gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 300, maxWidth: '55vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
          <div className="row gap-2 wrap">
            <div style={{ width: 140 }}><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All Categories</option>{D.categories.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div style={{ width: 130 }}><Select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All Brands</option>{D.brands.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div style={{ width: 120 }}><Select value={stat} onChange={(e) => setStat(e.target.value)}><option value="">All Status</option><option value="in">In Stock</option><option value="low">Low</option><option value="out">Out</option></Select></div>
          </div>
        </div>
        <Table cols={[
          { label: 'Code', w: 90 }, { label: 'Item Name' }, { label: 'Brand' }, { label: 'Category' }, { label: 'Group' },
          { label: 'Rack', align: 'center' }, { label: 'Avg Cost', align: 'right' }, { label: 'FIFO Cost', align: 'right' },
          { label: 'Price', align: 'right' }, { label: 'Qty', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 80 }]}
          rows={f}
          render={(i) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
            <Td>{i.brand}</Td><Td>{i.category}</Td>
            <Td><Badge tone="neutral">{i.group}</Badge></Td>
            <Td align="center" mono>{i.rack}</Td>
            <Td align="right" mono>{i.avgCost.toLocaleString()}</Td>
            <Td align="right" mono>{i.fifoCost.toLocaleString()}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.price.toLocaleString()}</Td>
            <Td align="right" mono style={{ fontWeight: 600, color: i.status === 'out' ? 'var(--bad)' : i.status === 'low' ? 'var(--warn)' : 'var(--tx-0)' }}>{i.qty}</Td>
            <Td align="center"><Badge tone={stTone[i.status]} dot>{stLabel[i.status]}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" onClick={() => open(i)} title="Edit"><Icon n="edit" s={15} /></button>
              <button className="mms-act" onClick={() => go('st/bin')} title="BIN Card"><Icon n="list" s={15} /></button>
            </div></Td>
          </>} />
        <div className="row between" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          <span className="t-2">Showing {f.length} of {rows.length} items</span>
          <span className="t-2">Total stock value · <b className="num" style={{ color: 'var(--tx-0)' }}>{D.money(rows.reduce((a, i) => a + i.avgCost * i.qty, 0))}</b></span>
        </div>
      </Card>

      <Modal open={!!modal} onClose={() => setModal(null)} width={680} title={(modal === 'add' ? 'Add ' : 'Edit ') + 'Item'} sub="Spare part master record"
        footer={<><Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Save Item</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Field label="Item Code">
            <Input value={form.code || ''}
              onChange={(e) => { setForm((s: any) => ({ ...s, code: e.target.value })); if (codeErr) setCodeErr('') }}
              onBlur={(e) => { if (codeTaken(e.target.value)) setCodeErr(`Item code "${e.target.value.trim()}" already exists.`) }}
              placeholder="BP-2201"
              style={codeErr ? { borderColor: 'var(--bad)' } : undefined} />
            {codeErr && <span style={{ fontSize: 11.5, color: 'var(--bad)', marginTop: 4 }}>{codeErr}</span>}
          </Field>
          <Field label="Item Name" style={{ gridColumn: 'span 2' }}><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Brand"><Select value={form.brand || ''} onChange={(e) => setForm((s: any) => ({ ...s, brand: e.target.value }))}><option value="">Select…</option>{D.brands.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Category"><Select value={form.category || ''} onChange={(e) => setForm((s: any) => ({ ...s, category: e.target.value }))}><option value="">Select…</option>{D.categories.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Group"><Select value={form.group || ''} onChange={(e) => setForm((s: any) => ({ ...s, group: e.target.value }))}>{D.groups.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Unit"><Select value={form.unit || ''} onChange={(e) => setForm((s: any) => ({ ...s, unit: e.target.value }))}>{['Pcs', 'Set', 'Kit', 'Box'].map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Rack / BIN"><Input value={form.rack || ''} onChange={(e) => setForm((s: any) => ({ ...s, rack: e.target.value }))} placeholder="R3-B2" /></Field>
          <Field label="Reorder Level"><Input type="number" value={form.reorder || ''} onChange={(e) => setForm((s: any) => ({ ...s, reorder: e.target.value }))} /></Field>
          <Field label="Avg Cost (Rs)"><Input type="number" value={form.avgCost || ''} onChange={(e) => setForm((s: any) => ({ ...s, avgCost: e.target.value }))} /></Field>
          <Field label="FIFO Cost (Rs)"><Input type="number" value={form.fifoCost || ''} onChange={(e) => setForm((s: any) => ({ ...s, fifoCost: e.target.value }))} /></Field>
          <Field label="Selling Price (Rs)"><Input type="number" value={form.price || ''} onChange={(e) => setForm((s: any) => ({ ...s, price: e.target.value }))} /></Field>
          <Field label="Opening Qty"><Input type="number" value={form.qty || ''} onChange={(e) => setForm((s: any) => ({ ...s, qty: e.target.value }))} /></Field>
        </div>
      </Modal>

      {toast && (
        <div className="toast row gap-2" style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 300, background: 'var(--bg-1)', border: '1px solid var(--ok)', borderRadius: 'var(--r-m)', padding: '12px 16px', boxShadow: 'var(--sh-3)', color: 'var(--ok)', animation: 'slideIn .3s var(--ease)' }}>
          <Icon n="check" s={18} /><span style={{ fontSize: 13, color: 'var(--tx-0)' }}>{toast}</span>
        </div>
      )}
    </div>
  )
}

export function CustomerMasterScreen({ go: _go }: { go: Go }) {
  const D = DB
  const [rows, setRows] = useState<Customer[]>(D.customers)
  const [q, setQ] = useState(''); const [modal, setModal] = useState<null | 'add' | 'edit'>(null); const [form, setForm] = useState<any>({})
  const open = (r?: Customer) => { setForm(r || { credit: 30, status: 'ok' }); setModal(r ? 'edit' : 'add') }
  const save = () => {
    if (modal === 'add') setRows((r) => [{ ...form, id: 'C' + (3000 + r.length), outstanding: 0 }, ...r])
    else setRows((r) => r.map((x) => (x.id === form.id ? form : x)))
    setModal(null)
  }
  const f = rows.filter((r) => !q || (r.name + r.city + r.contact).toLowerCase().includes(q.toLowerCase()))
  const totalOut = rows.reduce((a, c) => a + c.outstanding, 0)
  return (
    <div>
      <PageHead crumbs="Master Files" title="Customer Master" icon="users" sub={`${rows.length} customers · ${D.money(totalOut)} total outstanding`}
        actions={<><Btn variant="solid" icon="excel" onClick={() => downloadXls('Customers.xls', ['ID', 'Name', 'Contact', 'City', 'Credit Days', 'Limit', 'Rep'], f.map((c) => [c.id, c.name, c.contact, c.city, c.credit, c.limit, c.rep]))}>Export</Btn><Btn variant="primary" icon="plus" onClick={() => open()}>Add Customer</Btn></>} />
      <Card pad={0}>
        <div className="row gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 320, maxWidth: '60vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
        </div>
        <Table cols={[{ label: 'ID', w: 80 }, { label: 'Customer' }, { label: 'City' }, { label: 'Contact' }, { label: 'Rep' }, { label: 'Credit', align: 'center' }, { label: 'Limit', align: 'right' }, { label: 'Outstanding', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 70 }]}
          rows={f}
          render={(c) => <>
            <Td mono c="var(--tx-2)">{c.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{c.name}</Td>
            <Td>{c.city}</Td><Td mono>{c.contact}</Td><Td>{c.rep}</Td>
            <Td align="center" mono>{c.credit}d</Td>
            <Td align="right" mono>{c.limit.toLocaleString()}</Td>
            <Td align="right" mono c={c.outstanding > c.limit * 0.7 ? 'var(--bad)' : 'var(--tx-1)'} style={{ fontWeight: 600 }}>{c.outstanding.toLocaleString()}</Td>
            <Td align="center"><Badge tone={c.status === 'risk' ? 'red' : 'green'} dot>{c.status === 'risk' ? 'Over Limit' : 'Good'}</Badge></Td>
            <Td align="right"><button className="mms-act" onClick={() => open(c)}><Icon n="edit" s={15} /></button></Td>
          </>} />
      </Card>
      <Modal open={!!modal} onClose={() => setModal(null)} width={600} title={(modal === 'add' ? 'Add ' : 'Edit ') + 'Customer'}
        footer={<><Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Save</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Customer Name" full><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Contact No"><Input value={form.contact || ''} onChange={(e) => setForm((s: any) => ({ ...s, contact: e.target.value }))} /></Field>
          <Field label="City"><Input value={form.city || ''} onChange={(e) => setForm((s: any) => ({ ...s, city: e.target.value }))} /></Field>
          <Field label="Assigned Rep"><Select value={form.rep || ''} onChange={(e) => setForm((s: any) => ({ ...s, rep: e.target.value }))}><option value="">Select…</option>{D.reps.map((r) => <option key={r.id}>{r.name}</option>)}</Select></Field>
          <Field label="Credit Period (days)"><Select value={form.credit || ''} onChange={(e) => setForm((s: any) => ({ ...s, credit: e.target.value }))}>{[0, 7, 15, 30, 45, 60].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Credit Limit (Rs)" full><Input type="number" value={form.limit || ''} onChange={(e) => setForm((s: any) => ({ ...s, limit: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}
