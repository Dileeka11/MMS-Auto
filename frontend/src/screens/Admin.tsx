/* NMS-Auto — Administration, ported from admin.jsx */
import { useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { Gauge } from '../components/charts'
import DB from '../data'
import type { Go } from './types'

const D = DB

export function UsersScreen({ go }: { go: Go }) {
  const [rows, setRows] = useState([
    { id: 'U-01', name: 'Admin User', email: 'admin@mms-auto.lk', role: 'Administrator', branch: 'Main Store', status: 'Active', last: 'Online now' },
    { id: 'U-02', name: 'Kasun Bandara', email: 'kasun@mms-auto.lk', role: 'Store Keeper', branch: 'Main Store', status: 'Active', last: '2h ago' },
    { id: 'U-03', name: 'Nimal Jayasuriya', email: 'nimal@mms-auto.lk', role: 'Accountant', branch: 'Main Store', status: 'Active', last: '1d ago' },
    { id: 'U-04', name: 'R. Fernando', email: 'ruwan@mms-auto.lk', role: 'Sales Rep', branch: 'City Branch', status: 'Active', last: '30m ago' },
    { id: 'U-05', name: 'Pradeep Silva', email: 'pradeep@mms-auto.lk', role: 'Cashier', branch: 'Highway Depot', status: 'Inactive', last: '12d ago' },
  ])
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({ role: 'Sales Rep', status: 'Active' })
  const save = () => { setRows((r) => [{ id: 'U-0' + (r.length + 1), name: form.name, email: form.email, role: form.role, branch: form.branch || 'Main Store', status: 'Active', last: 'Never' }, ...r]); setModal(false); setForm({ role: 'Sales Rep', status: 'Active' }) }
  const roleTone: Record<string, 'blue' | 'neutral' | 'green' | 'amber'> = { Administrator: 'blue', 'Store Keeper': 'neutral', Accountant: 'neutral', 'Sales Rep': 'green', Cashier: 'amber' }
  return (
    <div>
      <PageHead crumbs="Administration" title="User Management" icon="users" sub={`${rows.length} system users`}
        actions={<Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Add User</Btn>} />
      <Card pad={0}>
        <Table cols={[{ label: 'User' }, { label: 'Email' }, { label: 'Role', align: 'center' }, { label: 'Branch' }, { label: 'Last Active' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 90 }]}
          rows={rows}
          render={(u) => <>
            <Td c="var(--tx-0)"><div className="row gap-2"><div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-3)', display: 'grid', placeItems: 'center', fontFamily: 'Saira', fontWeight: 700, fontSize: 12, color: 'var(--ac-bright)' }}>{u.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div><span style={{ fontWeight: 600 }}>{u.name}</span></div></Td>
            <Td mono c="var(--tx-2)" style={{ fontSize: 12 }}>{u.email}</Td>
            <Td align="center"><Badge tone={roleTone[u.role] || 'neutral'}>{u.role}</Badge></Td>
            <Td>{u.branch}</Td><Td c="var(--tx-2)">{u.last}</Td>
            <Td align="center"><Badge tone={u.status === 'Active' ? 'green' : 'red'} dot>{u.status}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}><button className="mms-act" onClick={() => go('ad/perm')} title="Permissions"><Icon n="shield" s={15} /></button><button className="mms-act"><Icon n="edit" s={15} /></button></div></Td>
          </>} />
      </Card>
      <Modal open={modal} onClose={() => setModal(false)} width={560} title="Add System User"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={save}>Create User</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Full Name" full><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => setForm((s: any) => ({ ...s, email: e.target.value }))} /></Field>
          <Field label="Role"><Select value={form.role} onChange={(e) => setForm((s: any) => ({ ...s, role: e.target.value }))}>{['Administrator', 'Store Keeper', 'Accountant', 'Sales Rep', 'Cashier'].map((r) => <option key={r}>{r}</option>)}</Select></Field>
          <Field label="Branch"><Select value={form.branch || ''} onChange={(e) => setForm((s: any) => ({ ...s, branch: e.target.value }))}>{D.branches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Temp Password"><Input type="text" defaultValue="Auto-generated" /></Field>
        </div>
      </Modal>
    </div>
  )
}

export function PermScreen({ go: _go }: { go: Go }) {
  const modules = ['Dashboard', 'Item Master', 'Customer Master', 'Purchase Order', 'GRN', 'Quotation', 'Sales Invoice', 'Sales Return', 'Payment Receipt', 'Stores', 'Reports', 'Administration']
  const roles = ['Administrator', 'Store Keeper', 'Accountant', 'Sales Rep', 'Cashier']
  const perms = ['View', 'Create', 'Edit', 'Delete', 'Approve']
  const [role, setRole] = useState('Sales Rep')
  const seed: Record<string, (m: string, p: string) => boolean> = {
    Administrator: () => true,
    'Store Keeper': (m, p) => /Item|GRN|Stores|Dashboard/.test(m) && p !== 'Approve',
    Accountant: (m, p) => /Payment|Reports|Customer|Dashboard/.test(m) && p !== 'Delete',
    'Sales Rep': (m, p) => /Quotation|Sales Invoice|Customer|Dashboard|Item/.test(m) && (p === 'View' || p === 'Create'),
    Cashier: (m, p) => /Payment|Dashboard/.test(m) && p !== 'Delete',
  }
  const [grid, setGrid] = useState<Record<string, Record<string, Record<string, boolean>>>>(() => {
    const g: any = {}; roles.forEach((r) => { g[r] = {}; modules.forEach((m) => { g[r][m] = {}; perms.forEach((p) => (g[r][m][p] = seed[r](m, p))) }) }); return g
  })
  const toggle = (m: string, p: string) => setGrid((g) => ({ ...g, [role]: { ...g[role], [m]: { ...g[role][m], [p]: !g[role][m][p] } } }))
  return (
    <div>
      <PageHead crumbs="Administration" title="User Permission" icon="shield" sub="Role-based access control matrix"
        actions={<Btn variant="primary" icon="check">Save Permissions</Btn>} />
      <Card pad={0}>
        <div className="row gap-2 wrap" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <span className="t-2" style={{ fontSize: 12.5, alignSelf: 'center', marginRight: 6 }}>Role:</span>
          {roles.map((r) => <Btn key={r} variant="ghost" size="sm" active={role === r} onClick={() => setRole(r)}>{r}</Btn>)}
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)' }}>Module</th>
              {perms.map((p) => <th key={p} style={{ padding: '11px 14px', fontSize: 11, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)', width: 90 }}>{p}</th>)}</tr></thead>
            <tbody>{modules.map((m) => (
              <tr key={m} className="mms-tr">
                <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600, color: 'var(--tx-0)' }}>{m}</td>
                {perms.map((p) => {
                  const on = grid[role][m][p]; const dis = role === 'Administrator'
                  return (
                    <td key={p} style={{ padding: '8px 14px', borderBottom: '1px solid var(--line-soft)', textAlign: 'center' }}>
                      <button onClick={() => !dis && toggle(m, p)} style={{ width: 34, height: 20, borderRadius: 20, border: 'none', cursor: dis ? 'not-allowed' : 'pointer', background: on ? 'var(--ac)' : 'var(--bg-3)', position: 'relative', transition: 'background .18s', opacity: dis ? 0.6 : 1 }}>
                        <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} />
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function CompanyScreen({ go: _go, setBrand }: { go: Go; setBrand?: (v: string) => void }) {
  const [name, setName] = useState(D.company.name)
  const [accent, setAccent] = useState(document.documentElement.dataset.accent || 'blue')
  const swatches: [string, string, string][] = [['blue', 'Electric Blue', 'oklch(0.62 0.19 256)'], ['orange', 'Garage Orange', 'oklch(0.66 0.18 45)'], ['green', 'Service Green', 'oklch(0.66 0.15 158)'], ['violet', 'Performance Violet', 'oklch(0.6 0.2 290)'], ['red', 'Racing Red', 'oklch(0.6 0.21 22)']]
  const setTheme = (a: string) => { setAccent(a); document.documentElement.dataset.accent = a }
  const applyName = (v: string) => { setName(v); setBrand?.(v || 'NMS-Auto') }
  return (
    <div>
      <PageHead crumbs="Administration" title="Company Profile" icon="building" sub="Branding, identity & system theme"
        actions={<Btn variant="primary" icon="check">Save Changes</Btn>} />
      <div className="comp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="col gap-4">
          <Card>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Company Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Company Name" full><Input value={name} onChange={(e) => applyName(e.target.value)} /></Field>
              <Field label="Tagline" full><Input defaultValue={D.company.tagline} /></Field>
              <Field label="Address" full><textarea defaultValue={D.company.address} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              <Field label="Phone"><Input defaultValue={D.company.phone} /></Field>
              <Field label="Email"><Input defaultValue={D.company.email} /></Field>
              <Field label="Tax / VAT No"><Input defaultValue="VAT-114-2290-8870" /></Field>
              <Field label="Currency"><Select defaultValue="LKR — Sri Lankan Rupee">{['LKR — Sri Lankan Rupee', 'PKR — Pakistani Rupee', 'INR — Indian Rupee', 'USD — US Dollar'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </div>
          </Card>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Logo &amp; Favicon</div>
            <div className="row gap-4 wrap">
              <div className="col gap-2">
                <span style={{ fontSize: 11.5, color: 'var(--tx-2)' }}>Company Logo</span>
                <label className="upload-slot col center" style={{ width: 200, height: 120, border: '1.5px dashed var(--line)', borderRadius: 'var(--r-m)', background: 'repeating-linear-gradient(45deg,var(--bg-0),var(--bg-0) 10px,var(--bg-1) 10px,var(--bg-1) 20px)', cursor: 'pointer', color: 'var(--tx-2)', gap: 8 }}>
                  <Icon n="upload" s={22} /><span style={{ fontSize: 11.5, fontFamily: 'JetBrains Mono' }}>drop logo · PNG/SVG</span>
                </label>
              </div>
              <div className="col gap-2">
                <span style={{ fontSize: 11.5, color: 'var(--tx-2)' }}>Favicon</span>
                <label className="upload-slot col center" style={{ width: 84, height: 84, border: '1.5px dashed var(--line)', borderRadius: 'var(--r-m)', background: 'repeating-linear-gradient(45deg,var(--bg-0),var(--bg-0) 8px,var(--bg-1) 8px,var(--bg-1) 16px)', cursor: 'pointer', color: 'var(--tx-2)', gap: 6 }}>
                  <Icon n="upload" s={18} /><span style={{ fontSize: 10, fontFamily: 'JetBrains Mono' }}>.ico</span>
                </label>
              </div>
            </div>
          </Card>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Color Theme</div>
            <div className="t-2" style={{ fontSize: 12.5, marginBottom: 16 }}>Pick the system accent — applies instantly across the whole panel.</div>
            <div className="row gap-3 wrap">
              {swatches.map(([id, label, col]) => (
                <button key={id} onClick={() => setTheme(id)} className="col gap-2 center" style={{ padding: '14px 12px', width: 120, background: accent === id ? 'var(--bg-2)' : 'var(--bg-0)', border: '1.5px solid ' + (accent === id ? 'var(--ac)' : 'var(--line)'), borderRadius: 'var(--r-m)', cursor: 'pointer', transition: 'all .15s' }}>
                  <span style={{ width: 40, height: 40, borderRadius: 10, background: col, boxShadow: accent === id ? '0 0 0 4px ' + col.replace(')', ' / 0.25)') : 'none' }} />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: accent === id ? 'var(--tx-0)' : 'var(--tx-2)' }}>{label}</span>
                  {accent === id && <Badge tone="blue">Active</Badge>}
                </button>
              ))}
            </div>
          </Card>
        </div>
        <div className="col gap-4" style={{ position: 'sticky', top: 80 }}>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 14 }}>Live Preview</div>
            <div style={{ background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-m)', padding: 18 }}>
              <div className="row gap-3" style={{ marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 9, background: 'var(--ac)', display: 'grid', placeItems: 'center', color: '#fff' }}><Icon n="wrench" s={21} /></div>
                <div><div style={{ fontFamily: 'Saira', fontWeight: 800, fontSize: 18 }}>{name || 'NMS-Auto'}</div><div className="eyebrow" style={{ fontSize: 9 }}>{D.company.tagline}</div></div>
              </div>
              <Btn variant="primary" style={{ width: '100%', marginBottom: 8 }}>Primary Button</Btn>
              <div className="row gap-2"><Badge tone="blue" dot>Accent</Badge><Badge tone="green" dot>Success</Badge><Badge tone="amber" dot>Pending</Badge></div>
              <div style={{ height: 6, background: 'var(--bg-3)', borderRadius: 6, marginTop: 14, overflow: 'hidden' }}><div style={{ height: '100%', width: '68%', background: 'var(--ac)', borderRadius: 6 }} /></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function RepsScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState(D.reps.map((r) => ({ ...r, app: true, login: r.name.toLowerCase().split(' ').join('.') + '@mms' })))
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({}); const [cred, setCred] = useState<{ name: string; login: string; pw: string } | null>(null)
  const add = () => {
    const login = (form.name || 'rep').toLowerCase().replace(/[^a-z]/g, '.') + '@mms'; const pw = 'Mms@' + Math.floor(1000 + Math.random() * 9000)
    setRows((r) => [...r, { id: 'REP-0' + (r.length + 1), name: form.name, zone: form.zone, target: +form.target || 500000, achieved: 0, visits: 0, invoices: 0, avatar: (form.name || 'NA').split(' ').map((w: string) => w[0]).join('').slice(0, 2), app: true, login }])
    setCred({ name: form.name, login, pw }); setModal(false); setForm({})
  }
  return (
    <div>
      <PageHead crumbs="Administration" title="Sales Reps & Mobile App" icon="phone" sub="Field reps, app logins & on-the-road quotations"
        actions={<><Btn variant="solid" icon="phone">Preview Mobile App</Btn><Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Add Sales Rep</Btn></>} />

      <div className="reps-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
        <Card style={{ background: 'linear-gradient(135deg, var(--bg-1), var(--ac-dim))', border: '1px solid var(--ac-line)' }}>
          <div className="row gap-2" style={{ marginBottom: 10 }}><Badge tone="blue" dot>Field Sales Platform</Badge></div>
          <h3 style={{ fontSize: 22, maxWidth: 440, lineHeight: 1.2 }}>Reps create quotations &amp; invoices on the road — synced live to head office.</h3>
          <div className="row gap-2 wrap" style={{ marginTop: 16 }}>
            {['Create Quotation', 'Browse Live Stock', 'Customer Balances', 'My Targets', 'Visit History', 'Offline-ready'].map((f) => (
              <span key={f} className="row gap-2" style={{ padding: '6px 11px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 100, fontSize: 12 }}><Icon n="check" s={13} c="var(--ok)" />{f}</span>
            ))}
          </div>
        </Card>
        <Card className="col" style={{ justifyContent: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>App Adoption</div>
          <div className="row gap-4" style={{ alignItems: 'center' }}>
            <Gauge pct={Math.round((rows.filter((r) => r.app).length / rows.length) * 100)} label="active" />
            <div className="col gap-2">
              <div><div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira' }}>{rows.length}</div><div className="t-2" style={{ fontSize: 11.5 }}>Reps with app</div></div>
              <div><div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira', color: 'var(--ok)' }}>{rows.reduce((a, r) => a + r.invoices, 0)}</div><div className="t-2" style={{ fontSize: 11.5 }}>Mobile invoices</div></div>
            </div>
          </div>
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Sales Representatives</div>
        <Table cols={[{ label: 'Rep' }, { label: 'Zone' }, { label: 'App Login' }, { label: 'Target', align: 'right' }, { label: 'Achieved', align: 'right' }, { label: 'Visits', align: 'right' }, { label: 'App', align: 'center' }, { label: '', align: 'right', w: 90 }]}
          rows={rows}
          render={(r) => <>
            <Td c="var(--tx-0)"><div className="row gap-2"><div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', fontFamily: 'Saira', fontWeight: 700, fontSize: 12, color: 'var(--ac-bright)' }}>{r.avatar}</div><span style={{ fontWeight: 600 }}>{r.name}</span></div></Td>
            <Td>{r.zone}</Td>
            <Td mono c="var(--tx-2)" style={{ fontSize: 12 }}>{r.login}</Td>
            <Td align="right" mono>{D.moneyK(r.target)}</Td>
            <Td align="right" mono c={r.achieved >= r.target ? 'var(--ok)' : 'var(--tx-0)'} style={{ fontWeight: 600 }}>{D.moneyK(r.achieved)}</Td>
            <Td align="right" mono>{r.visits}</Td>
            <Td align="center"><Badge tone={r.app ? 'green' : 'neutral'} dot>{r.app ? 'Enabled' : 'Off'}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}><button className="mms-act" onClick={() => setCred({ name: r.name, login: r.login, pw: '••••••' })} title="Credentials"><Icon n="shield" s={15} /></button><button className="mms-act"><Icon n="edit" s={15} /></button></div></Td>
          </>} />
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} width={560} title="Add Sales Rep" sub="A mobile-app login is generated automatically"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={add} disabled={!form.name}>Create Rep &amp; Login</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Full Name" full><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Sales Zone"><Input value={form.zone || ''} onChange={(e) => setForm((s: any) => ({ ...s, zone: e.target.value }))} placeholder="Colombo West" /></Field>
          <Field label="Monthly Target (Rs)"><Input type="number" value={form.target || ''} onChange={(e) => setForm((s: any) => ({ ...s, target: e.target.value }))} placeholder="500000" /></Field>
          <Field label="Mobile No"><Input placeholder="07X XXX XXXX" /></Field>
          <Field label="Branch"><Select>{D.branches.map((b) => <option key={b}>{b}</option>)}</Select></Field>
        </div>
        <div className="info-banner row gap-2" style={{ marginTop: 16, padding: '10px 14px', background: 'var(--ac-dim)', border: '1px solid var(--ac-line)', borderRadius: 'var(--r-s)', fontSize: 12, color: 'var(--ac-bright)' }}>
          <Icon n="phone" s={15} /><span>App credentials are generated on save — share them with the rep to log into the mobile app.</span>
        </div>
      </Modal>

      <Modal open={!!cred} onClose={() => setCred(null)} width={420} title="App Login Credentials" sub={cred?.name}
        footer={<Btn variant="primary" icon="check" onClick={() => setCred(null)}>Done</Btn>}>
        {cred && (
          <div className="col gap-3">
            <div style={{ padding: '14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <div className="t-2" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Username</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, color: 'var(--ac-bright)', marginTop: 4 }}>{cred.login}</div>
            </div>
            <div style={{ padding: '14px', background: 'var(--bg-0)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <div className="t-2" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em' }}>Temporary Password</div>
              <div className="mono" style={{ fontSize: 15, fontWeight: 600, marginTop: 4 }}>{cred.pw}</div>
            </div>
            <div className="t-2" style={{ fontSize: 12 }}>Rep must change password on first login. Access can be revoked anytime from this page.</div>
          </div>
        )}
      </Modal>
    </div>
  )
}
