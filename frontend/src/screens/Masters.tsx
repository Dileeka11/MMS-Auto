/* MMS-Auto — Master Files (generic CRUD engine + configs), ported from masters.jsx */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, statusTone, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import DB from '../data'
import type { Go } from './types'

const D = DB

interface ColCfg {
  key: string
  label: string
  mono?: boolean
  align?: 'left' | 'right' | 'center'
  strong?: boolean
  badge?: boolean
  dot?: boolean
  fmt?: (v: any, r: any) => ReactNode
  tone?: (r: any) => 'neutral' | 'blue' | 'green' | 'amber' | 'red'
}
interface FieldCfg { k: string; label: string; type?: string; opts?: (string | number)[]; ph?: string; full?: boolean }
export interface MasterCfg {
  title: string
  singular: string
  icon: string
  search: string[]
  searchPh?: string
  sub?: string
  cols: ColCfg[]
  fields: FieldCfg[]
  seed: any[]
  blank: () => any
  idGen: (n: number) => string
  excel?: boolean
  addLabel?: string
  formSub?: string
  onExcel?: () => void
  extraActions?: (rows: any[]) => ReactNode
}

export function DataModule({ cfg }: { cfg: MasterCfg; go?: Go }) {
  const [rows, setRows] = useState<any[]>(cfg.seed)
  const [q, setQ] = useState('')
  const [modal, setModal] = useState<null | 'add' | 'edit'>(null)
  const [form, setForm] = useState<any>({})
  const open = (row?: any) => { setForm(row || cfg.blank()); setModal(row ? 'edit' : 'add') }
  const save = () => {
    if (modal === 'add') setRows((r) => [{ ...form, id: cfg.idGen(r.length) }, ...r])
    else setRows((r) => r.map((x) => (x.id === form.id ? form : x)))
    setModal(null)
  }
  const del = (id: any) => setRows((r) => r.filter((x) => x.id !== id))
  const filtered = rows.filter((r) => !q || cfg.search.some((k) => String(r[k] || '').toLowerCase().includes(q.toLowerCase())))
  return (
    <div>
      <PageHead crumbs="Master Files" title={cfg.title} icon={cfg.icon} sub={cfg.sub || `${rows.length} records`}
        actions={<>
          {cfg.excel && <Btn variant="solid" icon="excel" onClick={cfg.onExcel}>Export Excel</Btn>}
          <Btn variant="primary" icon="plus" onClick={() => open()}>{cfg.addLabel || 'Add New'}</Btn>
        </>} />
      <Card pad={0}>
        <div className="row between wrap gap-3" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <div className="row gap-2" style={{ background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '7px 12px', width: 320, maxWidth: '60vw' }}>
            <Icon n="search" s={16} c="var(--tx-2)" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={cfg.searchPh || 'Search…'} style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          </div>
          <div className="row gap-2"><Btn variant="ghost" size="sm" icon="filter">Filter</Btn>{cfg.extraActions && cfg.extraActions(rows)}</div>
        </div>
        <Table cols={[...cfg.cols, { label: '', align: 'right', w: 90 }]} rows={filtered}
          render={(r) => <>
            {cfg.cols.map((c, i) => (
              <Td key={i} align={c.align} mono={c.mono} c={c.strong ? 'var(--tx-0)' : undefined} style={c.strong ? { fontWeight: 600 } : undefined}>
                {c.badge
                  ? <Badge tone={c.tone ? c.tone(r) : statusTone(r[c.key])} dot={c.dot}>{c.fmt ? c.fmt(r[c.key], r) : r[c.key]}</Badge>
                  : c.fmt ? c.fmt(r[c.key], r) : r[c.key]}
              </Td>
            ))}
            <Td align="right">
              <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                <button className="mms-act" onClick={(e) => { e.stopPropagation(); open(r) }} title="Edit"><Icon n="edit" s={15} /></button>
                <button className="mms-act danger" onClick={(e) => { e.stopPropagation(); del(r.id) }} title="Delete"><Icon n="trash" s={15} /></button>
              </div>
            </Td>
          </>} />
      </Card>
      <Modal open={!!modal} onClose={() => setModal(null)} title={(modal === 'add' ? 'Add ' : 'Edit ') + cfg.singular} sub={cfg.formSub}
        footer={<><Btn variant="plain" onClick={() => setModal(null)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Save {cfg.singular}</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {cfg.fields.map((f) => (
            <Field key={f.k} label={f.label} full={f.full}>
              {f.type === 'select'
                ? <Select value={form[f.k] || ''} onChange={(e) => setForm((s: any) => ({ ...s, [f.k]: e.target.value }))}><option value="">Select…</option>{f.opts!.map((o) => <option key={o} value={o}>{o}</option>)}</Select>
                : f.type === 'textarea'
                  ? <textarea value={form[f.k] || ''} onChange={(e) => setForm((s: any) => ({ ...s, [f.k]: e.target.value }))} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
                  : <Input type={f.type || 'text'} value={form[f.k] || ''} onChange={(e) => setForm((s: any) => ({ ...s, [f.k]: e.target.value }))} placeholder={f.ph} />}
            </Field>
          ))}
        </div>
      </Modal>
    </div>
  )
}

/* ---- Master configs ---- */
export const MASTERS: Record<string, MasterCfg> = {
  vehicleBrand: { title: 'Vehicle Brand', singular: 'Brand', icon: 'car', search: ['name'], searchPh: 'Search brands…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Brand Name', strong: true }, { key: 'origin', label: 'Origin' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code', ph: 'TYT' }, { k: 'name', label: 'Brand Name' }, { k: 'origin', label: 'Country of Origin', type: 'select', opts: ['Japan', 'Korea', 'Germany', 'USA', 'India'] }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: D.brands.map((b, i) => ({ id: 'VB' + (i + 1), code: b.slice(0, 3).toUpperCase(), name: b, origin: ['Japan', 'Japan', 'Japan', 'Japan', 'Japan', 'Japan', 'Japan', 'Korea'][i], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'VB' + (D.brands.length + n + 1) },

  vehicleModel: { title: 'Vehicle Model', singular: 'Model', icon: 'car', search: ['name', 'brand'], searchPh: 'Search models…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Model', strong: true }, { key: 'brand', label: 'Brand' }, { key: 'year', label: 'Year', mono: true, align: 'right' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Model Name' }, { k: 'brand', label: 'Brand', type: 'select', opts: D.brands }, { k: 'year', label: 'Year Range', ph: '2015-2022' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Corolla', 'Toyota', '2014-2024'], ['Hilux', 'Toyota', '2016-2024'], ['Sunny', 'Nissan', '2012-2020'], ['Civic', 'Honda', '2016-2023'], ['Swift', 'Suzuki', '2018-2024'], ['Lancer', 'Mitsubishi', '2008-2017'], ['CX-5', 'Mazda', '2017-2024'], ['Dmax', 'Isuzu', '2019-2024']].map((m, i) => ({ id: 'VM' + (i + 1), code: 'M' + (100 + i), name: m[0], brand: m[1], year: m[2], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'VM' + (n + 9) },

  brand: { title: 'Brand Master', singular: 'Brand', icon: 'tag', search: ['name'], searchPh: 'Search brands…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Brand', strong: true }, { key: 'category', label: 'Category' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Brand Name' }, { k: 'category', label: 'Category', type: 'select', opts: D.categories }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: ['Denso', 'Bosch', 'NGK', 'Aisin', 'Koyo', 'Exedy', 'Sakura', 'Valeo'].map((b, i) => ({ id: 'BR' + (i + 1), code: 'B' + (10 + i), name: b, category: D.categories[i % D.categories.length], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'BR' + (n + 9) },

  brandCat: { title: 'Brand Category — Spare Parts', singular: 'Category', icon: 'tag', search: ['name'], searchPh: 'Search categories…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Category', strong: true }, { key: 'items', label: 'Items', mono: true, align: 'right' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Category Name' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: D.categories.map((c, i) => ({ id: 'BC' + (i + 1), code: 'C' + (10 + i), name: c, items: D.items.filter((x) => x.category === c).length, status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'BC' + (n + 9) },

  group: { title: 'Group Master', singular: 'Group', icon: 'layers', search: ['name'], searchPh: 'Search groups…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Group', strong: true }, { key: 'margin', label: 'Default Margin', mono: true, align: 'right' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Group Name' }, { k: 'margin', label: 'Default Margin %', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: D.groups.map((g, i) => ({ id: 'GP' + (i + 1), code: 'G' + (10 + i), name: g, margin: [18, 22, 28, 15][i] + '%', status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'GP' + (n + 5) },

  services: { title: 'Services', singular: 'Service', icon: 'wrench', search: ['name'], searchPh: 'Search services…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Service', strong: true }, { key: 'rate', label: 'Rate', mono: true, align: 'right', fmt: (v) => D.money(v) }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Service Name' }, { k: 'rate', label: 'Rate (Rs)', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Wheel Alignment', 2500], ['Engine Tune-up', 6500], ['Brake Service', 3500], ['AC Gas Refill', 4500], ['Battery Check', 800], ['Diagnostic Scan', 1500]].map((s, i) => ({ id: 'SV' + (i + 1), code: 'S' + (10 + i), name: s[0], rate: s[1], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'SV' + (n + 7) },

  department: { title: 'Department', singular: 'Department', icon: 'building', search: ['name'], searchPh: 'Search…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Department', strong: true }, { key: 'head', label: 'Head' }, { key: 'staff', label: 'Staff', mono: true, align: 'right' }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Department Name' }, { k: 'head', label: 'Department Head' }, { k: 'staff', label: 'Staff Count', type: 'number' }],
    seed: [['Sales', 'R. Fernando', 12], ['Stores', 'K. Bandara', 8], ['Finance', 'N. Jayasuriya', 5], ['Procurement', 'A. Razik', 4], ['Admin', 'S. Mendis', 6]].map((d, i) => ({ id: 'DP' + (i + 1), code: 'D' + (10 + i), name: d[0], head: d[1], staff: d[2] })),
    blank: () => ({}), idGen: (n) => 'DP' + (n + 6) },

  employee: { title: 'Employee Master', singular: 'Employee', icon: 'users', search: ['name', 'department'], searchPh: 'Search employees…',
    cols: [{ key: 'id', label: 'Emp ID', mono: true }, { key: 'name', label: 'Name', strong: true }, { key: 'department', label: 'Department' }, { key: 'role', label: 'Designation' }, { key: 'contact', label: 'Contact', mono: true }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'name', label: 'Full Name', full: true }, { k: 'department', label: 'Department', type: 'select', opts: ['Sales', 'Stores', 'Finance', 'Procurement', 'Admin'] }, { k: 'role', label: 'Designation' }, { k: 'contact', label: 'Contact No' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Ruwan Fernando', 'Sales', 'Sales Manager'], ['Kasun Bandara', 'Stores', 'Store Keeper'], ['Nimal Jayasuriya', 'Finance', 'Accountant'], ['Ahmed Razik', 'Procurement', 'Buyer'], ['Sanduni Mendis', 'Admin', 'HR Officer'], ['Pradeep Silva', 'Sales', 'Sales Executive']].map((e, i) => ({ id: 'EMP-' + (101 + i), name: e[0], department: e[1], role: e[2], contact: '07' + (11000000 + i * 7654), status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'EMP-' + (107 + n) },

  payment: { title: 'Payment Master', singular: 'Payment Method', icon: 'wallet', search: ['name'], searchPh: 'Search…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Method', strong: true }, { key: 'type', label: 'Type' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Method Name' }, { k: 'type', label: 'Type', type: 'select', opts: ['Cash', 'Bank', 'Card', 'Cheque', 'Credit'] }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Cash', 'Cash'], ['Bank Transfer', 'Bank'], ['Credit Card', 'Card'], ['Cheque', 'Cheque'], ['Credit Sale', 'Credit']].map((p, i) => ({ id: 'PM' + (i + 1), code: 'P' + (10 + i), name: p[0], type: p[1], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'PM' + (n + 6) },

  bank: { title: 'Bank Master', singular: 'Bank', icon: 'building', search: ['name'], searchPh: 'Search banks…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Bank', strong: true }, { key: 'account', label: 'Account No', mono: true }, { key: 'branch', label: 'Branch' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Bank Name' }, { k: 'account', label: 'Account No' }, { k: 'branch', label: 'Bank Branch' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Commercial Bank', '8001234567', 'Colombo'], ['Sampath Bank', '1052009988', 'Kollupitiya'], ['HNB', '0710456321', 'Kandy'], ['BOC', '7745001122', 'Galle']].map((b, i) => ({ id: 'BK' + (i + 1), code: 'BK' + (10 + i), name: b[0], account: b[1], branch: b[2], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'BK' + (n + 5) },

  country: { title: 'Country Master', singular: 'Country', icon: 'pin', search: ['name'], searchPh: 'Search countries…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Country', strong: true }, { key: 'currency', label: 'Currency', mono: true }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'ISO Code' }, { k: 'name', label: 'Country' }, { k: 'currency', label: 'Currency' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['LK', 'Sri Lanka', 'LKR'], ['JP', 'Japan', 'JPY'], ['IN', 'India', 'INR'], ['DE', 'Germany', 'EUR'], ['US', 'United States', 'USD'], ['KR', 'South Korea', 'KRW']].map((c, i) => ({ id: 'CN' + (i + 1), code: c[0], name: c[1], currency: c[2], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'CN' + (n + 7) },

  branch: { title: 'Branch Master', singular: 'Branch', icon: 'store', search: ['name', 'city'], searchPh: 'Search branches…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Branch', strong: true }, { key: 'city', label: 'City' }, { key: 'phone', label: 'Phone', mono: true }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Branch Name' }, { k: 'city', label: 'City' }, { k: 'phone', label: 'Phone' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: D.branches.map((b, i) => ({ id: 'BN' + (i + 1), code: 'BR' + (10 + i), name: b, city: ['Colombo', 'Kandy', 'Galle'][i], phone: '011' + (2340000 + i * 111), status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'BN' + (n + 4) },

  expenseType: { title: 'Expense Type', singular: 'Expense Type', icon: 'coins', search: ['name'], searchPh: 'Search…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Type', strong: true }, { key: 'account', label: 'GL Account', mono: true }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Expense Type' }, { k: 'account', label: 'GL Account' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Fuel', '5101'], ['Salary', '5102'], ['Rent', '5103'], ['Utilities', '5104'], ['Transport', '5105'], ['Maintenance', '5106'], ['Misc', '5199']].map((e, i) => ({ id: 'ET' + (i + 1), code: 'E' + (10 + i), name: e[0], account: e[1], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'ET' + (n + 8) },

  credit: { title: 'Credit Period', singular: 'Credit Period', icon: 'clock', search: ['name'], searchPh: 'Search…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'name', label: 'Term', strong: true }, { key: 'days', label: 'Days', mono: true, align: 'right' }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'name', label: 'Term Name' }, { k: 'days', label: 'Days', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: [['Cash / COD', 0], ['Net 7', 7], ['Net 15', 15], ['Net 30', 30], ['Net 45', 45], ['Net 60', 60]].map((c, i) => ({ id: 'CP' + (i + 1), code: 'CP' + (10 + i), name: c[0], days: c[1], status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'CP' + (n + 7) },

  remark: { title: 'Invoice Remark', singular: 'Remark', icon: 'doc', search: ['text'], searchPh: 'Search remarks…',
    cols: [{ key: 'code', label: 'Code', mono: true }, { key: 'text', label: 'Remark Text', strong: true }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'code', label: 'Code' }, { k: 'text', label: 'Remark Text', full: true, type: 'textarea' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: ['Goods once sold cannot be returned without approval.', 'Warranty as per manufacturer terms only.', 'Please verify part number before fitting.', 'Payment due within agreed credit period.'].map((t, i) => ({ id: 'RM' + (i + 1), code: 'RM' + (10 + i), text: t, status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'RM' + (n + 5) },

  salesExec: { title: 'Sales Executive', singular: 'Sales Executive', icon: 'target', search: ['name', 'zone'], searchPh: 'Search executives…',
    cols: [{ key: 'id', label: 'ID', mono: true }, { key: 'name', label: 'Name', strong: true }, { key: 'zone', label: 'Zone' }, { key: 'target', label: 'Monthly Target', mono: true, align: 'right', fmt: (v) => D.moneyK(v) }, { key: 'status', label: 'Status', badge: true }],
    fields: [{ k: 'name', label: 'Full Name', full: true }, { k: 'zone', label: 'Sales Zone' }, { k: 'target', label: 'Monthly Target (Rs)', type: 'number' }, { k: 'status', label: 'Status', type: 'select', opts: ['Active', 'Inactive'] }],
    seed: D.reps.map((r) => ({ id: r.id, name: r.name, zone: r.zone, target: r.target, status: 'Active' })),
    blank: () => ({ status: 'Active' }), idGen: (n) => 'REP-' + (5 + n) },
}
