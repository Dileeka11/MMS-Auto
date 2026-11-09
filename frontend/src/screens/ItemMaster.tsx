/* NMS-Auto — Item Master + Customer Master (API-backed) */
import { useEffect, useRef, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td } from '../components/ui'
import { Icon } from '../components/Icon'
import { api } from '../api'
import { useNotify } from '../components/Notify'
import { brands as brandSeed, categories as catSeed, groups as grpSeed, money } from '../data'
import { parseItemMasterExcel, downloadItemMasterTemplate, parsePriceUpdateExcel, downloadPriceUpdateTemplate } from '../excel'
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
  const notify = useNotify()
  const [rows, setRows] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(''); const [cat, setCat] = useState(''); const [brand, setBrand] = useState(''); const [stat, setStat] = useState('')
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null); const [form, setForm] = useState<any>({})
  const [codeErr, setCodeErr] = useState('')
  const [saving, setSaving] = useState(false)

  const importRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)

  const refresh = () => { setLoading(true); api.items.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const onImport = async (file: File | null) => {
    if (!file) return
    setImporting(true)
    try {
      const parsed = await parseItemMasterExcel(file)
      if (!parsed.length) { notify.warning('Nothing imported', 'No items detected in the sheet'); return }
      const res: any = await (api.items as any).bulk(parsed)
      await refresh()
      notify.success('Import complete', `${parsed.length} items · ${res?.created || 0} new, ${res?.updated || 0} updated`)
    } catch (e: any) {
      notify.error('Import failed', e?.response?.data?.message || e?.message || 'unknown error')
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ''
    }
  }

  const priceRef = useRef<HTMLInputElement>(null)
  const [pricing, setPricing] = useState(false)
  const [priceResult, setPriceResult] = useState<null | { file: string; updated: number; unchanged: number; skipped: number; notFound: string[] }>(null)

  const onPriceUpdate = async (file: File | null) => {
    if (!file) return
    setPricing(true)
    try {
      const { items, skipped } = await parsePriceUpdateExcel(file)
      if (!items.length) {
        notify.warning('No prices found', 'The sheet needs a Part No / Item Code column and a Selling Price column')
        return
      }
      const ok = await notify.confirm({
        title: `Update selling price of ${items.length} items?`,
        msg: `From "${file.name}". Only the selling price changes — name, qty and cost stay as they are. Part numbers not in Item Master are skipped.`,
        okText: 'Update prices',
      })
      if (!ok) return
      const res = await (api.items as any).bulkPrice(items)
      await refresh()
      setPriceResult({ file: file.name, updated: res?.updated || 0, unchanged: res?.unchanged || 0, skipped, notFound: res?.notFound || [] })
    } catch (e: any) {
      notify.error('Price update failed', e?.response?.data?.message || e?.message || 'unknown error')
    } finally {
      setPricing(false)
      if (priceRef.current) priceRef.current.value = ''
    }
  }

  const clearAll = async () => {
    const ok = await notify.confirm({ title: `Delete ALL ${rows.length} items?`, msg: 'This cannot be undone.', danger: true, okText: 'Delete all' })
    if (!ok) return
    try {
      const res: any = await (api.items as any).clearAll()
      await refresh()
      notify.success('Items cleared', `${res?.deleted ?? 0} items removed`)
    } catch (e: any) {
      notify.error('Clear failed', e?.response?.data?.message || e?.message || 'unknown error')
    }
  }

  const open = (r?: Item) => { setForm(r || { unit: 'Pcs', group: 'OEM', status: 'in', reorder: 12 }); setCodeErr(''); setModal(r ? 'edit' : 'add') }
  const codeTaken = (code: string) => {
    const c = (code || '').trim().toLowerCase()
    if (!c) return false
    return rows.some((x) => x.code.trim().toLowerCase() === c && x.id !== form.id)
  }
  const save = async () => {
    let code = (form.code || '').trim()
    if (!code && modal === 'add') {
      try { code = await (api.items as any).nextCode() as string } catch { /* ignore */ }
    }
    if (!code) { setCodeErr('Item code is required.'); return }
    if (codeTaken(code)) { setCodeErr(`Item code "${code}" already exists.`); return }
    setSaving(true)
    try {
      if (modal === 'add') await api.items.create({ ...form, code, qty: Number(form.qty || 0) })
      else await api.items.update(form.id, { ...form, code })
      const wasAdd = modal === 'add'
      setModal(null); setCodeErr(''); refresh()
      notify.success(wasAdd ? 'Item created' : 'Item updated', code)
    } catch (e: any) {
      setCodeErr(e?.response?.data?.message || 'Failed to save')
    } finally { setSaving(false) }
  }
  const remove = async (id: any) => {
    const ok = await notify.confirm({ title: 'Delete this item?', danger: true, okText: 'Delete' })
    if (!ok) return
    try { await api.items.remove(id); refresh(); notify.success('Item deleted') }
    catch (e: any) { notify.error('Delete failed', e?.response?.data?.message || undefined) }
  }
  const f = rows.filter((r) => (!q || (r.name + r.code).toLowerCase().includes(q.toLowerCase())) && (!cat || r.category === cat) && (!brand || r.brand === brand) && (!stat || r.status === stat))

  const exportExcel = () => {
    const headers = ['Item Code', 'HS Code', 'Item Name', 'Brand', 'Category', 'Group', 'Unit', 'Rack', 'Avg Cost (Rs)', 'FIFO Cost (Rs)', 'Selling Price (Rs)']
    const data = f.map((i) => [i.code, i.hsCode || '', i.name, i.brand, i.category, i.group, i.unit, i.rack, i.avgCost, i.fifoCost, i.price])
    downloadXls('NMS-Auto_Item_Master_PriceList.xls', headers, data)
    notify.info('Export ready', f.length + ' items downloaded')
  }

  const stTone: Record<string, 'green' | 'amber' | 'red'> = { in: 'green', low: 'amber', out: 'red' }
  const stLabel: Record<string, string> = { in: 'In Stock', low: 'Low', out: 'Out' }
  return (
    <div>
      <PageHead crumbs="Master Files" title="Item Master" icon="pkg" sub={`${rows.length} spare parts · ${rows.filter((i) => i.status !== 'in').length} need attention`}
        actions={<>
          <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => onImport(e.target.files?.[0] || null)} />
          <Btn variant="ghost" icon="download" onClick={downloadItemMasterTemplate}>Template</Btn>
          <Btn variant="ghost" icon="upload" onClick={() => importRef.current?.click()} disabled={importing}>
            {importing ? 'Importing…' : 'Import Excel'}
          </Btn>
          <input ref={priceRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }}
            onChange={(e) => onPriceUpdate(e.target.files?.[0] || null)} />
          <Btn variant="ghost" icon="upload" onClick={() => priceRef.current?.click()} disabled={pricing}>
            {pricing ? 'Updating…' : 'Update Prices'}
          </Btn>
          {rows.length > 0 && <Btn variant="danger" icon="trash" onClick={clearAll}>Clear All</Btn>}
          <Btn variant="solid" icon="excel" onClick={exportExcel}>Export Excel</Btn>
          <Btn variant="primary" icon="plus" onClick={() => open()}>Add Item</Btn>
        </>} />

      <Card pad={0}>
        <div className="row between wrap gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 300, maxWidth: '55vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
          <div className="row gap-2 wrap">
            <div style={{ width: 140 }}><Select value={cat} onChange={(e) => setCat(e.target.value)}><option value="">All Categories</option>{catSeed.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div style={{ width: 130 }}><Select value={brand} onChange={(e) => setBrand(e.target.value)}><option value="">All Brands</option>{brandSeed.map((c) => <option key={c}>{c}</option>)}</Select></div>
            <div style={{ width: 120 }}><Select value={stat} onChange={(e) => setStat(e.target.value)}><option value="">All Status</option><option value="in">In Stock</option><option value="low">Low</option><option value="out">Out</option></Select></div>
          </div>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> : (
        <Table cols={[
          { label: 'Code', w: 90 }, { label: 'HS Code', w: 110 }, { label: 'Item Name' }, { label: 'Brand' }, { label: 'Category' }, { label: 'Group' },
          { label: 'Rack', align: 'center' }, { label: 'Avg Cost', align: 'right' }, { label: 'FIFO Cost', align: 'right' },
          { label: 'Price', align: 'right' }, { label: 'Qty', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 110 }]}
          rows={f}
          render={(i) => <>
            <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{i.code}</Td>
            <Td mono c="var(--tx-2)">{i.hsCode || '—'}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{i.name}</Td>
            <Td>{i.brand}</Td><Td>{i.category}</Td>
            <Td><Badge tone="neutral">{i.group}</Badge></Td>
            <Td align="center" mono>{i.rack}</Td>
            <Td align="right" mono>{(i.avgCost || 0).toLocaleString()}</Td>
            <Td align="right" mono>{(i.fifoCost || 0).toLocaleString()}</Td>
            <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{(i.price || 0).toLocaleString()}</Td>
            <Td align="right" mono style={{ fontWeight: 600, color: i.status === 'out' ? 'var(--bad)' : i.status === 'low' ? 'var(--warn)' : 'var(--tx-0)' }}>{i.qty}</Td>
            <Td align="center"><Badge tone={stTone[i.status]} dot>{stLabel[i.status]}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" onClick={() => open(i)} title="Edit"><Icon n="edit" s={15} /></button>
              <button className="mms-act" onClick={() => remove(i.id)} title="Delete"><Icon n="trash" s={15} /></button>
              <button className="mms-act" onClick={() => go('st/bin')} title="BIN Card"><Icon n="list" s={15} /></button>
            </div></Td>
          </>} />)}
        <div className="row between" style={{ padding: '12px 18px', borderTop: '1px solid var(--line)', fontSize: 12.5 }}>
          <span className="t-2">Showing {f.length} of {rows.length} items</span>
          <span className="t-2">Total stock value · <b className="num" style={{ color: 'var(--tx-0)' }}>{money(rows.reduce((a, i) => a + (i.avgCost || 0) * (i.qty || 0), 0))}</b></span>
        </div>
      </Card>

      <Modal open={!!priceResult} onClose={() => setPriceResult(null)} width={560} title="Price update complete" sub={priceResult?.file}
        footer={<>
          <Btn variant="ghost" icon="download" onClick={downloadPriceUpdateTemplate}>Template</Btn>
          {!!priceResult?.notFound.length && <Btn variant="ghost" icon="excel"
            onClick={() => downloadXls('Price_Update_Not_Found.xls', ['Part No'], priceResult.notFound.map((c) => [c]))}>Download not-found list</Btn>}
          <Btn variant="primary" icon="check" onClick={() => setPriceResult(null)}>Done</Btn>
        </>}>
        {priceResult && <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
            {[['Updated', priceResult.updated, 'var(--ok, #16a34a)'], ['Same price', priceResult.unchanged, 'var(--tx-1)'], ['Not in Item Master', priceResult.notFound.length, priceResult.notFound.length ? 'var(--warn, #d97706)' : 'var(--tx-1)']].map(([l, n, c]) => (
              <div key={l as string} style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '10px 12px' }}>
                <div style={{ fontSize: 12, color: 'var(--tx-2)' }}>{l}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: c as string }}>{n}</div>
              </div>
            ))}
          </div>
          {priceResult.skipped > 0 && <div style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 10 }}>{priceResult.skipped} rows skipped (blank or invalid price).</div>}
          {priceResult.notFound.length > 0 && <>
            <div style={{ fontSize: 13, color: 'var(--tx-1)', marginBottom: 6 }}>These part numbers are not in Item Master, so their prices were not saved:</div>
            <div style={{ maxHeight: 180, overflow: 'auto', fontFamily: 'var(--mono, monospace)', fontSize: 12, background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '8px 10px', lineHeight: 1.7 }}>
              {priceResult.notFound.join(', ')}
            </div>
          </>}
        </div>}
      </Modal>

      <Modal open={!!modal} onClose={() => setModal(null)} width={680} title={(modal === 'add' ? 'Add ' : 'Edit ') + 'Item'} sub="Spare part master record"
        footer={<><Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Item'}</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <Field label={<span className="row between" style={{ alignItems: 'baseline' }}>
            <span>Item Code</span>
            {modal === 'add' && (
              <button type="button"
                onClick={async () => {
                  try { const c = await (api.items as any).nextCode() as string; if (c) { setForm((s: any) => ({ ...s, code: c })); setCodeErr('') } } catch { /* ignore */ }
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--ac-bright)', fontSize: 10.5, fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Generate
              </button>
            )}
          </span>}>
            <Input value={form.code || ''}
              onChange={(e) => { setForm((s: any) => ({ ...s, code: e.target.value })); if (codeErr) setCodeErr('') }}
              onBlur={(e) => { if (codeTaken(e.target.value)) setCodeErr(`Item code "${e.target.value.trim()}" already exists.`) }}
              placeholder="Type or click Generate"
              style={codeErr ? { borderColor: 'var(--bad)' } : undefined} />
            {codeErr && <span style={{ fontSize: 11.5, color: 'var(--bad)', marginTop: 4 }}>{codeErr}</span>}
          </Field>
          <Field label="HS Code"><Input value={form.hsCode || ''} onChange={(e) => setForm((s: any) => ({ ...s, hsCode: e.target.value }))} placeholder="87141090" /></Field>
          <Field label="Item Name"><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Brand"><Select value={form.brand || ''} onChange={(e) => setForm((s: any) => ({ ...s, brand: e.target.value }))}><option value="">Select…</option>{brandSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Category"><Select value={form.category || ''} onChange={(e) => setForm((s: any) => ({ ...s, category: e.target.value }))}><option value="">Select…</option>{catSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Group"><Select value={form.group || ''} onChange={(e) => setForm((s: any) => ({ ...s, group: e.target.value }))}>{grpSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Unit"><Select value={form.unit || ''} onChange={(e) => setForm((s: any) => ({ ...s, unit: e.target.value }))}>{['Pcs', 'Set', 'Kit', 'Box'].map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Rack / BIN"><Input value={form.rack || ''} onChange={(e) => setForm((s: any) => ({ ...s, rack: e.target.value }))} placeholder="R3-B2" /></Field>
          <Field label="Reorder Level"><Input type="number" value={form.reorder || ''} onChange={(e) => setForm((s: any) => ({ ...s, reorder: e.target.value }))} /></Field>
          <Field label="Avg Cost (Rs)"><Input type="number" value={form.avgCost || ''} onChange={(e) => setForm((s: any) => ({ ...s, avgCost: e.target.value }))} /></Field>
          <Field label="FIFO Cost (Rs)"><Input type="number" value={form.fifoCost || ''} onChange={(e) => setForm((s: any) => ({ ...s, fifoCost: e.target.value }))} /></Field>
          <Field label="Selling Price (Rs)"><Input type="number" value={form.price || ''} onChange={(e) => setForm((s: any) => ({ ...s, price: e.target.value }))} /></Field>
          <Field label="Opening Qty"><Input type="number" value={form.qty || ''} onChange={(e) => setForm((s: any) => ({ ...s, qty: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}

export function CustomerMasterScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<Customer[]>([])
  const [reps, setReps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState(''); const [modal, setModal] = useState<null | 'add' | 'edit'>(null); const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const refresh = () => { setLoading(true); api.customers.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh(); api.reps.list().then((d) => setReps(d as any)).catch(() => {}) }, [])

  const open = (r?: Customer) => { setForm(r || { credit: 30, status: 'ok' }); setModal(r ? 'edit' : 'add') }
  const save = async () => {
    setSaving(true)
    try {
      if (modal === 'add') await api.customers.create({ ...form, outstanding: 0 })
      else await api.customers.update(form.id, form)
      setModal(null); refresh()
    } finally { setSaving(false) }
  }
  const remove = async (id: any) => {
    if (!confirm('Delete this customer?')) return
    await api.customers.remove(id); refresh()
  }

  const f = rows.filter((r) => !q || (r.name + r.city + r.contact).toLowerCase().includes(q.toLowerCase()))
  const totalOut = rows.reduce((a, c) => a + (c.outstanding || 0), 0)
  return (
    <div>
      <PageHead crumbs="Master Files" title="Customer Master" icon="users" sub={`${rows.length} customers · ${money(totalOut)} total outstanding`}
        actions={<><Btn variant="solid" icon="excel" onClick={() => downloadXls('Customers.xls', ['ID', 'Name', 'Contact', 'City', 'Credit Days', 'Limit', 'Rep'], f.map((c) => [c.id, c.name, c.contact, c.city, c.credit, c.limit, c.rep]))}>Export</Btn><Btn variant="primary" icon="plus" onClick={() => open()}>Add Customer</Btn></>} />
      <Card pad={0}>
        <div className="row gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 320, maxWidth: '60vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search customers…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
        </div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> : (
        <Table cols={[{ label: 'ID', w: 80 }, { label: 'Customer' }, { label: 'City' }, { label: 'Contact' }, { label: 'Rep' }, { label: 'Credit', align: 'center' }, { label: 'Limit', align: 'right' }, { label: 'Outstanding', align: 'right' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 90 }]}
          rows={f}
          render={(c) => <>
            <Td mono c="var(--tx-2)">{c.id}</Td>
            <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{c.name}</Td>
            <Td>{c.city}</Td><Td mono>{c.contact}</Td><Td>{c.rep}</Td>
            <Td align="center" mono>{c.credit}d</Td>
            <Td align="right" mono>{(c.limit || 0).toLocaleString()}</Td>
            <Td align="right" mono c={(c.outstanding || 0) >= (c.limit || 0) * 0.8 && c.limit > 0 ? ((c.outstanding || 0) >= c.limit ? 'var(--bad)' : 'var(--warn)') : 'var(--tx-1)'} style={{ fontWeight: 600 }}>{(c.outstanding || 0).toLocaleString()}</Td>
            <Td align="center">
              {c.limit > 0 && (c.outstanding || 0) >= c.limit ? (
                <Badge tone="red" dot>Over Limit</Badge>
              ) : c.limit > 0 && (c.outstanding || 0) >= c.limit * 0.8 ? (
                <Badge tone="amber" dot>Close to limit</Badge>
              ) : (
                <Badge tone="green" dot>Good</Badge>
              )}
            </Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" onClick={() => open(c)}><Icon n="edit" s={15} /></button>
              <button className="mms-act" onClick={() => remove(c.id)}><Icon n="trash" s={15} /></button>
            </div></Td>
          </>} />)}
      </Card>
      <Modal open={!!modal} onClose={() => setModal(null)} width={600} title={(modal === 'add' ? 'Add ' : 'Edit ') + 'Customer'}
        footer={<><Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Customer Name" full><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Contact No"><Input value={form.contact || ''} onChange={(e) => setForm((s: any) => ({ ...s, contact: e.target.value }))} /></Field>
          <Field label="City"><Input value={form.city || ''} onChange={(e) => setForm((s: any) => ({ ...s, city: e.target.value }))} /></Field>
          <Field label="Assigned Rep"><Select value={form.rep || ''} onChange={(e) => setForm((s: any) => ({ ...s, rep: e.target.value }))}><option value="">Select…</option>{reps.map((r) => <option key={r.id}>{r.name}</option>)}</Select></Field>
          <Field label="Credit Period (days)"><Select value={form.credit || ''} onChange={(e) => setForm((s: any) => ({ ...s, credit: e.target.value }))}>{[0, 7, 15, 30, 45, 60].map((d) => <option key={d}>{d}</option>)}</Select></Field>
          <Field label="Tax No (TIN / VAT)"><Input value={form.taxNo || ''} onChange={(e) => setForm((s: any) => ({ ...s, taxNo: e.target.value }))} /></Field>
          <Field label="Address" full><Input value={form.address || ''} onChange={(e) => setForm((s: any) => ({ ...s, address: e.target.value }))} /></Field>
          <Field label="Credit Limit (Rs)" full><Input type="number" value={form.limit || ''} onChange={(e) => setForm((s: any) => ({ ...s, limit: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}
