/* NMS-Auto — Administration (API-backed) */
import { useEffect, useState } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, Modal, Table, Td, inputStyle } from '../components/ui'
import { Icon } from '../components/Icon'
import { Gauge } from '../components/charts'
import { api, company as companyApi, permissionsApi, type PermissionMatrix } from '../api'
import { branches as branchSeed, moneyK } from '../data'
import { useNotify } from '../components/Notify'
import type { Go } from './types'

const ROLE_OPTIONS = ['admin', 'manager', 'storekeeper', 'accountant', 'salesrep', 'cashier', 'user'] as const
const roleLabel = (r?: string) => ({ admin: 'Administrator', manager: 'Manager', storekeeper: 'Store Keeper', accountant: 'Accountant', salesrep: 'Sales Rep', cashier: 'Cashier', user: 'User' } as Record<string, string>)[r || ''] || (r || 'User')
const roleTone: Record<string, 'blue' | 'neutral' | 'green' | 'amber' | 'red'> = { admin: 'blue', manager: 'blue', storekeeper: 'neutral', accountant: 'neutral', salesrep: 'green', cashier: 'amber', user: 'neutral' }

interface UserRow { id: number; name: string; email: string; role: string; branch?: string | null; status?: string }
const blankUserForm = (): Partial<UserRow & { password: string }> => ({ role: 'user', status: 'Active', branch: '' })

export function UsersScreen({ go: _go, user: me }: { go: Go; user?: { id: number; role?: string } | null }) {
  const notify = useNotify()
  const [rows, setRows] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<UserRow | null>(null)
  const [form, setForm] = useState<Partial<UserRow & { password: string }>>(blankUserForm())

  const refresh = () => {
    setLoading(true)
    api.users.list().then((d) => setRows(d as any)).catch(() => setRows([])).finally(() => setLoading(false))
  }
  useEffect(() => { refresh() }, [])

  const openCreate = () => { setEditing(null); setForm(blankUserForm()); setErr(''); setModal(true) }
  const openEdit   = (u: UserRow) => { setEditing(u); setForm({ ...u, password: '' }); setErr(''); setModal(true) }
  const close = () => { setModal(false); setEditing(null); setErr('') }

  const save = async () => {
    if (!form.name || !form.email) { setErr('Name and email are required.'); return }
    if (!editing && !form.password) { setErr('Password is required for new users.'); return }
    setBusy(true); setErr('')
    try {
      if (editing) {
        const body: any = { name: form.name, email: form.email, role: form.role, branch: form.branch || null, status: form.status }
        if (form.password) body.password = form.password
        await api.users.update(editing.id, body)
      } else {
        await api.users.create({ name: form.name, email: form.email, role: form.role, branch: form.branch || null, status: form.status || 'Active', password: form.password } as any)
      }
      close(); refresh()
      notify.success(editing ? 'User updated' : 'User created', form.name || undefined)
    } catch (ex: any) {
      setErr(ex?.response?.data?.message || ex?.response?.data?.errors?.email?.[0] || 'Save failed')
    } finally { setBusy(false) }
  }

  const remove = async (u: UserRow) => {
    if (u.id === me?.id) { notify.error('Cannot delete', 'You cannot delete your own account.'); return }
    const ok = await notify.confirm({ title: `Delete user "${u.name}"?`, msg: 'This action cannot be undone.', danger: true, okText: 'Delete' })
    if (!ok) return
    try { await api.users.remove(u.id); refresh(); notify.success('User deleted', u.name) }
    catch (ex: any) { notify.error('Delete failed', ex?.response?.data?.message || undefined) }
  }

  return (
    <div>
      <PageHead crumbs="Administration" title="User Management" icon="users" sub={`${rows.length} system users`}
        actions={<Btn variant="primary" icon="plus" onClick={openCreate}>Add User</Btn>} />
      <Card pad={0}>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'User' }, { label: 'Email' }, { label: 'Role', align: 'center' }, { label: 'Branch' }, { label: 'Status', align: 'center' }, { label: '', align: 'right', w: 120 }]}
          rows={rows}
          render={(u) => <>
            <Td c="var(--tx-0)"><div className="row gap-2"><div style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--bg-3)', display: 'grid', placeItems: 'center', fontFamily: 'Saira', fontWeight: 700, fontSize: 12, color: 'var(--ac-bright)' }}>{(u.name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}</div><span style={{ fontWeight: 600 }}>{u.name}</span></div></Td>
            <Td mono c="var(--tx-2)" style={{ fontSize: 12 }}>{u.email}</Td>
            <Td align="center"><Badge tone={roleTone[u.role] || 'neutral'}>{roleLabel(u.role)}</Badge></Td>
            <Td>{u.branch || '—'}</Td>
            <Td align="center"><Badge tone={(u.status || 'Active') === 'Active' ? 'green' : 'red'} dot>{u.status || 'Active'}</Badge></Td>
            <Td align="right"><div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="mms-act" title="Edit" onClick={() => openEdit(u)}><Icon n="edit" s={15} /></button>
              <button className="mms-act" title="Delete" onClick={() => remove(u)} disabled={u.id === me?.id} style={{ opacity: u.id === me?.id ? 0.4 : 1 }}><Icon n="trash" s={15} /></button>
            </div></Td>
          </>} />}
      </Card>

      <Modal open={modal} onClose={close} width={560} title={editing ? 'Edit User' : 'Add System User'}
        sub={editing ? editing.email : 'The role seeds a starting permission set — fine-tune it per user under User Permission.'}
        footer={<>
          <Btn variant="plain" onClick={close}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={save} disabled={busy}>{busy ? 'Saving...' : (editing ? 'Save Changes' : 'Create User')}</Btn>
        </>}>
        {err && <div style={{ background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', padding: '8px 12px', borderRadius: 'var(--r-s)', fontSize: 12.5, marginBottom: 14 }}>{err}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Full Name" full><Input value={form.name || ''} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Email"><Input type="email" value={form.email || ''} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} /></Field>
          <Field label="Role"><Select value={form.role || 'user'} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}>{ROLE_OPTIONS.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}</Select></Field>
          <Field label="Branch"><Select value={form.branch || ''} onChange={(e) => setForm((s) => ({ ...s, branch: e.target.value }))}><option value="">—</option>{branchSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
          <Field label="Status"><Select value={form.status || 'Active'} onChange={(e) => setForm((s) => ({ ...s, status: e.target.value }))}><option>Active</option><option>Inactive</option></Select></Field>
          <Field label={editing ? 'New Password (leave blank to keep)' : 'Password'}><Input type="password" value={form.password || ''} onChange={(e) => setForm((s) => ({ ...s, password: e.target.value }))} /></Field>
        </div>
      </Modal>
    </div>
  )
}

export function PermScreen({ go: _go }: { go: Go }) {
  const [matrix, setMatrix] = useState<PermissionMatrix | null>(null)
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const load = () => {
    setLoading(true); setMsg(null)
    permissionsApi.list()
      .then((d) => {
        setMatrix(d)
        setUserId((cur) => (cur && d.users.some((u) => u.id === cur)) ? cur : (d.users[0]?.id ?? null))
        setDirty(false)
      })
      .catch(() => setMsg({ tone: 'err', text: 'Failed to load permission matrix.' }))
      .finally(() => setLoading(false))
  }
  useEffect(load, []) // eslint-disable-line react-hooks/exhaustive-deps

  const key = userId != null ? String(userId) : ''
  const selectedUser = matrix?.users.find((u) => u.id === userId) || null
  const isAdminUser = selectedUser?.role === 'admin'

  const toggle = (m: string, a: string) => {
    if (!matrix || !key || isAdminUser) return
    setMatrix({
      ...matrix,
      matrix: { ...matrix.matrix, [key]: { ...matrix.matrix[key], [m]: { ...matrix.matrix[key][m], [a]: !matrix.matrix[key][m][a] } } },
    })
    setDirty(true); setMsg(null)
  }
  const bulkRow = (m: string, val: boolean) => {
    if (!matrix || !key || isAdminUser) return
    const row: Record<string, boolean> = {}
    matrix.actions.forEach((a) => row[a] = val)
    setMatrix({ ...matrix, matrix: { ...matrix.matrix, [key]: { ...matrix.matrix[key], [m]: row } } })
    setDirty(true); setMsg(null)
  }

  const save = async () => {
    if (!matrix || !userId || isAdminUser) return
    setSaving(true); setMsg(null)
    try {
      await permissionsApi.updateUser(userId, matrix.matrix[key])
      setDirty(false); setMsg({ tone: 'ok', text: 'Permissions saved.' })
    } catch (ex: any) {
      setMsg({ tone: 'err', text: ex?.response?.data?.message || 'Save failed' })
    } finally { setSaving(false) }
  }

  if (loading || !matrix) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading permissions…</div>

  const grid = matrix.matrix[key] || {}

  return (
    <div>
      <PageHead crumbs="Administration" title="User Permission" icon="shield" sub="Per-user access control matrix"
        actions={
          <Btn variant="primary" icon="check" onClick={save} disabled={saving || !dirty || isAdminUser}>
            {saving ? 'Saving...' : dirty ? 'Save Permissions' : 'Saved'}
          </Btn>
        } />

      {msg && (
        <div style={{ padding: '10px 14px', marginBottom: 12, borderRadius: 'var(--r-s)', fontSize: 13,
          background: msg.tone === 'ok' ? 'var(--ok-dim)' : 'var(--bad-dim)',
          color: msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)',
          border: '1px solid ' + (msg.tone === 'ok' ? 'var(--ok)' : 'var(--bad)') }}>{msg.text}</div>
      )}

      <Card pad={0}>
        <div className="row gap-2" style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <span className="t-2" style={{ fontSize: 12.5, marginRight: 6 }}>User:</span>
          <Select
            value={userId ?? ''}
            onChange={(e) => { if (dirty && !confirm('Discard unsaved changes?')) return; setUserId(Number(e.target.value)); setDirty(false); setMsg(null) }}
            style={{ minWidth: 260, maxWidth: 360 }}
          >
            {matrix.users.map((u) => <option key={u.id} value={u.id}>{u.name} — {u.email}{u.role === 'admin' ? ' (Admin)' : ''}</option>)}
          </Select>
        </div>

        {isAdminUser && (
          <div style={{ padding: '10px 18px', background: 'var(--ac-dim)', color: 'var(--ac-bright)', fontSize: 12.5, borderBottom: '1px solid var(--ac-line)' }}>
            Administrators have full access to every module by definition and cannot be modified.
          </div>
        )}

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '11px 18px', fontSize: 11, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)' }}>Module</th>
              {matrix.actions.map((a) => <th key={a} style={{ padding: '11px 14px', fontSize: 11, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: '1px solid var(--line)', width: 90 }}>{a}</th>)}
              <th style={{ padding: '11px 14px', fontSize: 11, color: 'var(--tx-2)', textTransform: 'uppercase', borderBottom: '1px solid var(--line)', width: 90 }}>All</th>
            </tr></thead>
            <tbody>{matrix.modules.map((m) => {
              const rowVals = matrix.actions.map((a) => grid[m]?.[a]) // booleans
              const allOn = rowVals.every(Boolean)
              return (
                <tr key={m} className="mms-tr">
                  <td style={{ padding: '10px 18px', borderBottom: '1px solid var(--line-soft)', fontWeight: 600, color: 'var(--tx-0)' }}>{m}</td>
                  {matrix.actions.map((a) => {
                    const on = !!grid[m]?.[a] || isAdminUser
                    return (
                      <td key={a} style={{ padding: '8px 14px', borderBottom: '1px solid var(--line-soft)', textAlign: 'center' }}>
                        <button onClick={() => toggle(m, a)} disabled={isAdminUser} style={{ width: 34, height: 20, borderRadius: 20, border: 'none', cursor: isAdminUser ? 'not-allowed' : 'pointer', background: on ? 'var(--ac)' : 'var(--bg-3)', position: 'relative', transition: 'background .18s', opacity: isAdminUser ? 0.6 : 1 }}>
                          <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .18s' }} />
                        </button>
                      </td>
                    )
                  })}
                  <td style={{ padding: '8px 14px', borderBottom: '1px solid var(--line-soft)', textAlign: 'center' }}>
                    <Btn variant="ghost" size="sm" disabled={isAdminUser} onClick={() => bulkRow(m, !allOn)}>{allOn ? 'None' : 'All'}</Btn>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export function CompanyScreen({ go: _go, setBrand }: { go: Go; setBrand?: (v: string) => void }) {
  const [data, setData] = useState<any>({ name: 'NMS-Auto', tagline: 'Spare Parts Distribution', address: '', phone: '', email: '', taxNo: '', currency: 'LKR — Sri Lankan Rupee' })
  const [accent, setAccent] = useState(document.documentElement.dataset.accent || 'blue')
  const [saving, setSaving] = useState(false)
  const swatches: [string, string, string][] = [['blue', 'Electric Blue', 'oklch(0.62 0.19 256)'], ['orange', 'Garage Orange', 'oklch(0.66 0.18 45)'], ['green', 'Service Green', 'oklch(0.66 0.15 158)'], ['violet', 'Performance Violet', 'oklch(0.6 0.2 290)'], ['red', 'Racing Red', 'oklch(0.6 0.21 22)']]
  const setTheme = (a: string) => { setAccent(a); document.documentElement.dataset.accent = a; localStorage.setItem('mms-accent', a) }

  useEffect(() => { companyApi.get().then((d: any) => { setData((s: any) => ({ ...s, ...d })); if (d?.name) setBrand?.(d.name) }).catch(() => {}) // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const save = async () => {
    setSaving(true)
    try {
      const updated = await companyApi.update(data)
      setData((s: any) => ({ ...s, ...updated }))
      setBrand?.(data.name || 'NMS-Auto')
    } finally { setSaving(false) }
  }
  const set = (k: string, v: any) => setData((s: any) => ({ ...s, [k]: v }))

  return (
    <div>
      <PageHead crumbs="Administration" title="Company Profile" icon="building" sub="Branding, identity & system theme"
        actions={<Btn variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</Btn>} />
      <div className="comp-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16, alignItems: 'start' }}>
        <div className="col gap-4">
          <Card>
            <div className="eyebrow" style={{ marginBottom: 16 }}>Company Details</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <Field label="Company Name" full><Input value={data.name || ''} onChange={(e) => set('name', e.target.value)} /></Field>
              <Field label="Tagline" full><Input value={data.tagline || ''} onChange={(e) => set('tagline', e.target.value)} /></Field>
              <Field label="Address" full><textarea value={data.address || ''} onChange={(e) => set('address', e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical' }} /></Field>
              <Field label="Phone"><Input value={data.phone || ''} onChange={(e) => set('phone', e.target.value)} /></Field>
              <Field label="Email"><Input value={data.email || ''} onChange={(e) => set('email', e.target.value)} /></Field>
              <Field label="Tax / VAT No"><Input value={data.taxNo || ''} onChange={(e) => set('taxNo', e.target.value)} /></Field>
              <Field label="Currency"><Select value={data.currency || ''} onChange={(e) => set('currency', e.target.value)}>{['LKR — Sri Lankan Rupee', 'PKR — Pakistani Rupee', 'INR — Indian Rupee', 'USD — US Dollar'].map((c) => <option key={c}>{c}</option>)}</Select></Field>
            </div>
          </Card>
          <Card>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Color Theme</div>
            <div className="t-2" style={{ fontSize: 12.5, marginBottom: 16 }}>Pick the system accent — applies instantly.</div>
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
                <div><div style={{ fontFamily: 'Saira', fontWeight: 800, fontSize: 18 }}>{data.name || 'NMS-Auto'}</div><div className="eyebrow" style={{ fontSize: 9 }}>{data.tagline}</div></div>
              </div>
              <Btn variant="primary" style={{ width: '100%', marginBottom: 8 }}>Primary Button</Btn>
              <div className="row gap-2"><Badge tone="blue" dot>Accent</Badge><Badge tone="green" dot>Success</Badge><Badge tone="amber" dot>Pending</Badge></div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function RepsScreen({ go: _go }: { go: Go }) {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false); const [form, setForm] = useState<any>({}); const [cred, setCred] = useState<{ name: string; login: string; pw: string } | null>(null)

  const refresh = () => { setLoading(true); api.reps.list().then((d) => setRows(d as any)).finally(() => setLoading(false)) }
  useEffect(() => { refresh() }, [])

  const add = async () => {
    const pw = 'Mms@' + Math.floor(1000 + Math.random() * 9000)
    const created: any = await api.reps.create({
      name: form.name, zone: form.zone, target: +form.target || 500000,
      achieved: 0, visits: 0, invoices: 0, avatar: (form.name || 'NA').split(' ').map((w: string) => w[0]).join('').slice(0, 2), appEnabled: true,
    } as any)
    setCred({ name: form.name, login: created?.login || (form.name || 'rep').toLowerCase().replace(/[^a-z]/g, '.') + '@mms', pw }); setModal(false); setForm({}); refresh()
  }
  return (
    <div>
      <PageHead crumbs="Administration" title="Sales Reps & Mobile App" icon="phone" sub="Field reps, app logins & on-the-road quotations"
        actions={<><Btn variant="solid" icon="phone">Preview Mobile App</Btn><Btn variant="primary" icon="plus" onClick={() => setModal(true)}>Add Sales Rep</Btn></>} />

      <div className="reps-hero" style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16, marginBottom: 16, alignItems: 'stretch' }}>
        <Card style={{ background: 'linear-gradient(135deg, var(--bg-1), var(--ac-dim))', border: '1px solid var(--ac-line)' }}>
          <div className="row gap-2" style={{ marginBottom: 10 }}><Badge tone="blue" dot>Field Sales Platform</Badge></div>
          <h3 style={{ fontSize: 22, maxWidth: 440, lineHeight: 1.2 }}>Reps create quotations &amp; invoices on the road — synced live to head office.</h3>
        </Card>
        <Card className="col" style={{ justifyContent: 'center' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>App Adoption</div>
          <div className="row gap-4" style={{ alignItems: 'center' }}>
            <Gauge pct={rows.length ? Math.round((rows.filter((r) => r.appEnabled ?? r.app).length / rows.length) * 100) : 0} label="active" />
            <div className="col gap-2">
              <div><div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira' }}>{rows.length}</div><div className="t-2" style={{ fontSize: 11.5 }}>Reps</div></div>
              <div><div className="num" style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Saira', color: 'var(--ok)' }}>{rows.reduce((a, r) => a + (r.invoices || 0), 0)}</div><div className="t-2" style={{ fontSize: 11.5 }}>Invoices</div></div>
            </div>
          </div>
        </Card>
      </div>

      <Card pad={0}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }} className="eyebrow">Sales Representatives</div>
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div> :
        <Table cols={[{ label: 'Rep' }, { label: 'Zone' }, { label: 'App Login' }, { label: 'Target', align: 'right' }, { label: 'Achieved', align: 'right' }, { label: 'Visits', align: 'right' }, { label: 'App', align: 'center' }, { label: '', align: 'right', w: 60 }]}
          rows={rows}
          render={(r) => <>
            <Td c="var(--tx-0)"><div className="row gap-2"><div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--ac-dim)', display: 'grid', placeItems: 'center', fontFamily: 'Saira', fontWeight: 700, fontSize: 12, color: 'var(--ac-bright)' }}>{r.avatar || (r.name || 'NA').split(' ').map((w: string) => w[0]).join('').slice(0, 2)}</div><span style={{ fontWeight: 600 }}>{r.name}</span></div></Td>
            <Td>{r.zone}</Td>
            <Td mono c="var(--tx-2)" style={{ fontSize: 12 }}>{r.login || '—'}</Td>
            <Td align="right" mono>{moneyK(r.target || 0)}</Td>
            <Td align="right" mono c={(r.achieved || 0) >= (r.target || 0) ? 'var(--ok)' : 'var(--tx-0)'} style={{ fontWeight: 600 }}>{moneyK(r.achieved || 0)}</Td>
            <Td align="right" mono>{r.visits || 0}</Td>
            <Td align="center"><Badge tone={(r.appEnabled ?? r.app) ? 'green' : 'neutral'} dot>{(r.appEnabled ?? r.app) ? 'Enabled' : 'Off'}</Badge></Td>
            <Td align="right"><button className="mms-act" onClick={() => setCred({ name: r.name, login: r.login || '—', pw: '••••••' })} title="Credentials"><Icon n="shield" s={15} /></button></Td>
          </>} />}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} width={560} title="Add Sales Rep" sub="A mobile-app login is generated automatically"
        footer={<><Btn variant="plain" onClick={() => setModal(false)}>Cancel</Btn><Btn variant="primary" icon="check" onClick={add} disabled={!form.name}>Create Rep &amp; Login</Btn></>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Full Name" full><Input value={form.name || ''} onChange={(e) => setForm((s: any) => ({ ...s, name: e.target.value }))} /></Field>
          <Field label="Sales Zone"><Input value={form.zone || ''} onChange={(e) => setForm((s: any) => ({ ...s, zone: e.target.value }))} placeholder="Colombo West" /></Field>
          <Field label="Monthly Target (Rs)"><Input type="number" value={form.target || ''} onChange={(e) => setForm((s: any) => ({ ...s, target: e.target.value }))} placeholder="500000" /></Field>
          <Field label="Mobile No"><Input placeholder="07X XXX XXXX" /></Field>
          <Field label="Branch"><Select>{branchSeed.map((b) => <option key={b}>{b}</option>)}</Select></Field>
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
          </div>
        )}
      </Modal>
    </div>
  )
}
