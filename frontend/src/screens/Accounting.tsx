/* NMS-Auto — Accounting module (ported from Solidrow-admin Finance):
   Financial Year + Opening Balances, Chart of Accounts, Account Groups,
   Journal Entries (+ manual entry), General Ledger, Trial Balance. */
import { Fragment, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Card, PageHead, Btn, Badge, Field, Input, Select, DateInput, Modal, Table, Td } from '../components/ui'
import { Icon } from '../components/Icon'
import { useNotify } from '../components/Notify'
import { api } from '../api'
import { userCan } from '../lib/permissions'
import type {
  AccountCategory, AccountGroup, AccountRow, ChartCategory, FinancialYear, GeneralLedger,
  JournalDraftLine, JournalEntry, OpeningBalanceAccount, OpeningBalancesResponse, PostingSetup, RebuildResult, TrialBalance,
} from '../types'
import type { ScreenProps } from './types'

/* ---------- shared helpers ---------- */
const money = (n: string | number) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const docNo = (id: number) => 'JE-' + String(id).padStart(6, '0')
const today = () => new Date().toISOString().slice(0, 10)

/** First Laravel validation error, else the message, else the fallback. */
function errMsg(e: any, fallback: string): string {
  const d = e?.response?.data
  const first = d?.errors ? (Object.values(d.errors)[0] as string[] | undefined)?.[0] : undefined
  return first || d?.message || fallback
}

const Loading = () => <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx-2)' }}>Loading…</div>
const Empty = ({ children }: { children: ReactNode }) => (
  <div style={{ padding: '18px 20px', fontSize: 13, color: 'var(--tx-3)' }}>{children}</div>
)
const ErrBox = ({ children }: { children: ReactNode }) => (
  <div style={{ gridColumn: '1 / -1', padding: '8px 12px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 12.5 }}>
    {children}
  </div>
)
const ActiveBadge = ({ active }: { active: boolean }) => (
  <Badge tone={active ? 'green' : 'neutral'} dot>{active ? 'Active' : 'Inactive'}</Badge>
)
const ReadOnly = ({ children }: { children: ReactNode }) => (
  <div className="mono" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '9px 12px', fontSize: 13, color: 'var(--tx-2)' }}>
    {children}
  </div>
)
const thStyle = { fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase' as const, letterSpacing: '.06em' }
const totalCell = { fontWeight: 700, background: 'var(--bg-2)' }

/** Accounts grouped by their group, for <optgroup> dropdowns. */
function groupAccounts(accounts: AccountRow[]) {
  const map = new Map<string, { label: string; accounts: AccountRow[] }>()
  for (const a of accounts) {
    if (!map.has(a.groupCode)) map.set(a.groupCode, { label: `${a.groupCode} · ${a.groupName}`, accounts: [] })
    map.get(a.groupCode)!.accounts.push(a)
  }
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label))
}

/** A chart row plus its nested children (built from the flat parentId list). */
interface TreeNode extends AccountRow { children: TreeNode[] }

function buildTree(rows: AccountRow[]): TreeNode[] {
  const byId = new Map<number, TreeNode>()
  rows.forEach((r) => byId.set(r.id, { ...r, children: [] }))
  const roots: TreeNode[] = []
  byId.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) byId.get(node.parentId)!.children.push(node)
    else roots.push(node)
  })
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }))
    nodes.forEach((n) => sortRec(n.children))
  }
  sortRec(roots)
  return roots
}

/* =====================================================================
   Chart of Accounts
   ===================================================================== */
interface AccountSaveData { groupId?: number; parentId?: number; name: string; isActive: boolean }

function AccountModal({ open, editing, parent, chart, accounts, onClose, onSave }: {
  open: boolean
  editing: AccountRow | null
  /** When set, we're adding a sub-account under this row (group is inherited). */
  parent: AccountRow | null
  chart: ChartCategory[]
  /** Full accounts list used to populate the optional parent dropdown. */
  accounts: AccountRow[]
  onClose: () => void
  onSave: (data: AccountSaveData) => Promise<void>
}) {
  const [groupId, setGroupId] = useState<number | ''>('')
  const [selectedParentId, setSelectedParentId] = useState<number | ''>('')
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // A sub-account inherits its group from the parent prop (via the table "+" button).
  // When adding top-level, the user may optionally pick a parent from the dropdown.
  const isSubAccount = !editing && !!parent
  const showGroupSelector = !editing && !parent && !selectedParentId
  const chosenParent = selectedParentId ? accounts.find((a) => a.id === Number(selectedParentId)) : null

  useEffect(() => {
    if (!open) return
    setError('')
    setGroupId(editing?.groupId ?? '')
    setSelectedParentId('')
    setName(editing?.name ?? '')
    setIsActive(editing ? editing.isActive : true)
  }, [open, editing, parent])

  const title = editing ? 'Edit Account' : isSubAccount || selectedParentId ? 'Add Sub-account' : 'Add Account'

  async function handleSave() {
    if (showGroupSelector && !groupId) { setError('Please select a group.'); return }
    if (!name.trim()) { setError('Account name is required.'); return }
    setBusy(true); setError('')
    try {
      const data: AccountSaveData = { name: name.trim(), isActive }
      if (isSubAccount && parent) data.parentId = parent.id
      else if (selectedParentId) data.parentId = Number(selectedParentId)
      else if (showGroupSelector) data.groupId = Number(groupId)
      await onSave(data)
    } catch (e) {
      setError(errMsg(e, 'Could not save. Please check the fields.'))
    } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={onClose} width={480} title={title}
      sub={editing ? undefined : 'The account code is generated automatically.'}
      footer={<>
        <Btn variant="plain" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" icon="check" onClick={handleSave} disabled={busy}>{busy ? 'Saving…' : editing ? 'Update' : 'Add'}</Btn>
      </>}>
      <div className="col gap-3">
        {/* Sub-account: parent shown read-only (group is inherited). */}
        {isSubAccount && parent && (
          <Field label="Under"><ReadOnly>{parent.code} · {parent.name}</ReadOnly></Field>
        )}

        {/* Top-level new account: optional parent account selector. */}
        {!editing && !parent && (
          <Field label="Parent Account (optional)">
            <Select value={selectedParentId} onChange={(e) => { setSelectedParentId(e.target.value ? Number(e.target.value) : ''); setGroupId('') }}>
              <option value="">None (top-level account)</option>
              {accounts.filter((a) => a.isActive).map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
            </Select>
            {chosenParent && <span className="t-2" style={{ fontSize: 12 }}>Group: {chosenParent.groupCode} · {chosenParent.groupName}</span>}
          </Field>
        )}

        {/* Top-level account: pick the group it rolls up to (only when no parent selected). */}
        {showGroupSelector && (
          <Field label="Group">
            <Select value={groupId} onChange={(e) => setGroupId(e.target.value ? Number(e.target.value) : '')}>
              <option value="" disabled>Select a group…</option>
              {chart.map((cat) => (
                <optgroup key={cat.id} label={`${cat.code} · ${cat.name}`}>
                  {cat.groups.map((g) => <option key={g.id} value={g.id}>{g.code} · {g.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
        )}

        {/* Editing: show the (locked) code for context. */}
        {editing && <Field label="Code (auto-generated · locked)"><ReadOnly>{editing.code}</ReadOnly></Field>}

        <Field label="Account Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Petty Cash" />
        </Field>

        <label className="row gap-2" style={{ fontSize: 13.5, cursor: 'pointer' }}>
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        {error && <ErrBox>{error}</ErrBox>}
      </div>
    </Modal>
  )
}

export function ChartOfAccountsScreen(_: ScreenProps) {
  const notify = useNotify()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [chart, setChart] = useState<ChartCategory[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<AccountRow | null>(null)
  const [parentFor, setParentFor] = useState<AccountRow | null>(null)

  async function load() {
    setLoading(true)
    try {
      const [acc, ch] = await Promise.all([api.accounting.accounts.list(), api.accounting.chart()])
      setAccounts(acc as AccountRow[])
      setChart(ch as ChartCategory[])
    } catch {
      setAccounts([]); setChart([])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const categoryNames = useMemo(() => Array.from(new Set(accounts.map((a) => a.categoryName))).sort(), [accounts])
  const filtersActive = Boolean(search.trim() || categoryFilter || typeFilter || statusFilter)

  // Flat, filtered list — used only when a search/filter is active (so matches
  // aren't hidden behind a collapsed branch).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return accounts.filter((a) => {
      if (q && !(a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))) return false
      if (categoryFilter && a.categoryName !== categoryFilter) return false
      if (typeFilter && a.type !== typeFilter) return false
      if (statusFilter === 'active' && !a.isActive) return false
      if (statusFilter === 'inactive' && a.isActive) return false
      return true
    })
  }, [accounts, search, categoryFilter, typeFilter, statusFilter])

  const tree = useMemo(() => buildTree(accounts), [accounts])

  // Flatten the tree into render rows, honouring collapsed branches.
  const treeRows = useMemo(() => {
    const out: { node: AccountRow; depth: number; hasChildren: boolean }[] = []
    const walk = (nodes: TreeNode[], depth: number) => {
      nodes.forEach((node) => {
        out.push({ node, depth, hasChildren: node.children.length > 0 })
        if (node.children.length && !collapsed.has(node.id)) walk(node.children, depth + 1)
      })
    }
    walk(tree, 0)
    return out
  }, [tree, collapsed])

  const rows = filtersActive
    ? filtered.map((a) => ({ node: a, depth: 0, hasChildren: a.hasChildren }))
    : treeRows

  function toggleCollapse(id: number) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const openAddRoot = () => { setEditing(null); setParentFor(null); setModalOpen(true) }
  const openAddChild = (row: AccountRow) => { setEditing(null); setParentFor(row); setModalOpen(true) }
  const openEdit = (a: AccountRow) => { setEditing(a); setParentFor(null); setModalOpen(true) }

  async function handleSave(data: AccountSaveData) {
    if (editing) {
      await api.accounting.accounts.update(editing.id, { name: data.name, isActive: data.isActive })
      notify.success('Account updated')
    } else {
      await api.accounting.accounts.create(data)
      notify.success(data.parentId ? 'Sub-account added' : 'Account added')
    }
    setModalOpen(false)
    await load()
  }

  async function handleDelete(a: AccountRow) {
    const ok = await notify.confirm({ title: `Delete account "${a.code} · ${a.name}"?`, msg: 'This action cannot be undone.', danger: true, okText: 'Delete' })
    if (!ok) return
    try {
      await api.accounting.accounts.remove(a.id)
      notify.success('Account deleted')
      await load()
    } catch (e) {
      notify.error('Delete failed', errMsg(e, 'Could not delete the account.'))
    }
  }

  const locked = { opacity: 0.35, cursor: 'not-allowed' }

  return (
    <div>
      <PageHead crumbs="Accounting" title="Chart of Accounts" icon="list"
        sub={<>{accounts.length} ledger accounts across {chart.length} categories · use <b>+</b> on any account to add a sub-account under it</>}
        actions={<Btn variant="primary" icon="plus" onClick={openAddRoot}>Add Account</Btn>} />

      <Card pad={0}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by code or name…" />
          <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All categories</option>
            {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All statements</option>
            <option value="BS">Balance Sheet</option>
            <option value="PNL">Profit &amp; Loss</option>
          </Select>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>

        {loading ? <Loading /> : (
          <Table cols={[
            { label: 'Code', w: 170 }, { label: 'Account' }, { label: 'Group' }, { label: 'Category' },
            { label: 'Type', align: 'center', w: 70 }, { label: 'Status', align: 'center', w: 100 },
            { label: 'Actions', align: 'right', w: 120 },
          ]}
            rows={rows}
            empty={filtersActive ? 'No accounts match your filters.' : 'No accounts yet.'}
            render={({ node: a, depth, hasChildren }) => (
              <>
                <Td mono style={{ fontWeight: 600 }}>
                  <span className="row" style={{ paddingLeft: depth * 18 }}>
                    {hasChildren && !filtersActive ? (
                      <button onClick={() => toggleCollapse(a.id)} title={collapsed.has(a.id) ? 'Expand' : 'Collapse'}
                        style={{ background: 'none', border: 'none', color: 'var(--tx-2)', padding: 0, marginRight: 6, display: 'grid', placeItems: 'center' }}>
                        <Icon n={collapsed.has(a.id) ? 'chev' : 'chevd'} s={14} />
                      </button>
                    ) : <span style={{ display: 'inline-block', width: depth > 0 ? 20 : 0 }} />}
                    <span style={{ color: 'var(--ac-bright)' }}>{a.code}</span>
                    {a.isDefault && <span title="System default account" style={{ marginLeft: 6, fontSize: 10, color: 'var(--ac)' }}>★</span>}
                  </span>
                </Td>
                <Td c="var(--tx-0)" style={{ fontWeight: hasChildren ? 700 : 500 }}>
                  {a.name}
                  {hasChildren && <span className="t-2" style={{ marginLeft: 8, fontSize: 11, fontWeight: 600 }}>· header</span>}
                </Td>
                <Td c="var(--tx-2)">{a.groupName}</Td>
                <Td c="var(--tx-2)">{a.categoryName}</Td>
                <Td align="center" mono c="var(--tx-2)">{a.type}</Td>
                <Td align="center"><ActiveBadge active={a.isActive} /></Td>
                <Td align="right">
                  <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                    <button className="mms-act" title="Add sub-account" onClick={() => openAddChild(a)}><Icon n="plus" s={15} /></button>
                    <button className="mms-act" disabled={a.isDefault} style={a.isDefault ? locked : undefined}
                      title={a.isDefault ? 'System account — cannot edit' : 'Edit'} onClick={() => !a.isDefault && openEdit(a)}>
                      <Icon n="edit" s={15} />
                    </button>
                    <button className="mms-act danger" disabled={a.isDefault} style={a.isDefault ? locked : undefined}
                      title={a.isDefault ? 'System account — cannot delete' : 'Delete'} onClick={() => !a.isDefault && handleDelete(a)}>
                      <Icon n="trash" s={15} />
                    </button>
                  </div>
                </Td>
              </>
            )} />
        )}
      </Card>

      <AccountModal open={modalOpen} editing={editing} parent={parentFor} chart={chart} accounts={accounts}
        onClose={() => setModalOpen(false)} onSave={handleSave} />
    </div>
  )
}

/* =====================================================================
   Account Groups — read-only view of the chart's fixed skeleton.
   Categories (Assets…) and groups (Current Assets…) are seeded and locked;
   each group can be expanded to preview the (nested) accounts under it.
   ===================================================================== */
export function AccountGroupsScreen(_: ScreenProps) {
  const [categories, setCategories] = useState<AccountCategory[]>([])
  const [groups, setGroups] = useState<AccountGroup[]>([])
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  useEffect(() => {
    Promise.all([api.accounting.categories(), api.accounting.groups(), api.accounting.accounts.list()])
      .then(([c, g, a]) => { setCategories(c); setGroups(g); setAccounts(a) })
      .catch(() => { setCategories([]); setGroups([]); setAccounts([]) })
      .finally(() => setLoading(false))
  }, [])

  const groupsByCategory = (categoryId: number) => groups.filter((g) => g.categoryId === categoryId)

  // groupId -> nested account tree, computed once.
  const treeByGroup = useMemo(() => {
    const map = new Map<number, TreeNode[]>()
    groups.forEach((g) => map.set(g.id, buildTree(accounts.filter((a) => a.groupId === g.id))))
    return map
  }, [groups, accounts])

  function toggle(groupId: number) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId); else next.add(groupId)
      return next
    })
  }

  const renderNodes = (nodes: TreeNode[], depth: number): ReactNode => nodes.map((n) => (
    <Fragment key={n.id}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px', columnGap: 16, padding: '9px 20px 9px 44px', fontSize: 13, alignItems: 'center', borderBottom: '1px solid var(--line-soft)', background: 'var(--bg-0)' }}>
        <div className="mono row" style={{ fontWeight: 600 }}>
          <span style={{ display: 'inline-block', width: depth * 18 }} />
          {n.children.length > 0 && <span className="t-2" style={{ marginRight: 6 }}>└</span>}
          {n.code}
        </div>
        <div style={{ fontWeight: n.children.length > 0 ? 700 : 500, color: 'var(--tx-0)' }}>
          {n.name}
          {n.children.length > 0 && <span className="t-2" style={{ marginLeft: 8, fontSize: 11, fontWeight: 600 }}>· header</span>}
        </div>
        <div style={{ textAlign: 'right' }}><ActiveBadge active={n.isActive} /></div>
      </div>
      {n.children.length > 0 && renderNodes(n.children, depth + 1)}
    </Fragment>
  ))

  return (
    <div style={{ maxWidth: 900 }}>
      <PageHead crumbs="Accounting" title="Account Groups" icon="layers"
        sub={`${categories.length} categories · ${groups.length} groups — click a group to see its accounts`} />

      {loading && <Loading />}
      {!loading && categories.map((cat) => (
        <Card key={cat.id} pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
          <div className="row gap-3" style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)', background: 'var(--bg-2)' }}>
            <span className="mono" style={{ fontWeight: 700, fontSize: 15, color: 'var(--ac-bright)' }}>{cat.code}</span>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{cat.name}</span>
            <Badge>{cat.normalBalance === 'debit' ? 'Debit' : 'Credit'} · {cat.statementType}</Badge>
          </div>

          {groupsByCategory(cat.id).length === 0 && <Empty>No groups in this category.</Empty>}
          {groupsByCategory(cat.id).map((g) => {
            const isOpen = expanded.has(g.id)
            const roots = treeByGroup.get(g.id) ?? []
            return (
              <div key={g.id}>
                <div className="mms-row" onClick={() => toggle(g.id)}
                  style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px', columnGap: 16, padding: '11px 20px', fontSize: 13.5, alignItems: 'center', borderBottom: '1px solid var(--line-soft)', cursor: 'pointer', userSelect: 'none' }}>
                  <div className="mono row gap-2" style={{ fontWeight: 600 }}>
                    <Icon n={isOpen ? 'chevd' : 'chev'} s={14} c="var(--tx-2)" />
                    {g.code}
                  </div>
                  <div style={{ fontWeight: 500, color: 'var(--tx-0)' }}>{g.name}</div>
                  <div className="t-2" style={{ fontSize: 12, textAlign: 'right' }}>{g.accountsCount ?? 0} accounts</div>
                </div>
                {isOpen && (roots.length === 0
                  ? <div style={{ padding: '10px 20px 10px 44px', fontSize: 13, color: 'var(--tx-3)', borderBottom: '1px solid var(--line-soft)' }}>No accounts in this group yet.</div>
                  : renderNodes(roots, 0))}
              </div>
            )
          })}
        </Card>
      ))}
    </div>
  )
}

/* =====================================================================
   Journal Entries (list)
   ===================================================================== */
/** Source filter options — keys match the backend's journal source_type values. */
const SOURCES: [string, string][] = [
  ['manual', 'Manual'], ['invoice', 'Sales Invoice'], ['receipt', 'Payment Receipt'], ['expense', 'Expense'],
  ['grn', 'GRN'], ['sales_return', 'Sales Return'], ['stock_adjustment', 'Stock Adjustment'], ['opening_balance', 'Opening Balance'],
]

const SourceBadge = ({ e }: { e: JournalEntry }) => (
  <Badge tone={e.sourceType ? 'blue' : 'neutral'}>{e.sourceLabel ?? 'Manual'}</Badge>
)

export function JournalEntriesScreen({ go, user }: ScreenProps) {
  const notify = useNotify()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [source, setSource] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [search, setSearch] = useState('')

  async function load() {
    setLoading(true)
    try {
      setEntries(await api.accounting.journal.list({
        source: source || undefined, from: from || undefined, to: to || undefined, search: search.trim() || undefined,
      }) as JournalEntry[])
    } catch {
      setEntries([])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [source, from, to]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete(e: JournalEntry) {
    const ok = await notify.confirm({ title: `Delete ${docNo(e.id)}?`, msg: 'This manual voucher will be removed from the ledger.', danger: true, okText: 'Delete' })
    if (!ok) return
    try {
      await api.accounting.journal.remove(e.id)
      notify.success('Journal entry deleted')
      await load()
    } catch (err) {
      notify.error('Delete failed', errMsg(err, 'Could not delete the entry.'))
    }
  }

  const canDelete = userCan(user, 'Accounting', 'Delete')
  const entryTotal = (e: JournalEntry) => e.lines.reduce((sum, l) => sum + Number(l.debit), 0)
  const cols = '120px 100px 140px 1fr 130px'

  return (
    <div style={{ maxWidth: 1080 }}>
      <PageHead crumbs="Accounting" title="Journal Entries" icon="doc"
        sub={<>{entries.length} entries{entries.length >= 500 ? ' (latest 500 — narrow the filters to see more)' : ''} · invoices, receipts, expenses, GRNs, returns and stock adjustments post here automatically</>}
        actions={userCan(user, 'Accounting', 'Create') && <Btn variant="primary" icon="plus" onClick={() => go('ac/journal-new')}>New Entry</Btn>} />

      <Card pad={0} style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--line)' }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && load()}
            placeholder="Search reference / memo, Enter…" />
          <Select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="">All sources</option>
            {SOURCES.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </Select>
          <DateInput value={from} onChange={setFrom} />
          <DateInput value={to} onChange={setTo} />
        </div>
        {loading && <Loading />}
        {!loading && entries.length === 0 && <Empty>No journal entries match.</Empty>}
        {!loading && entries.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 680 }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '10px 20px', borderBottom: '1px solid var(--line)', ...thStyle }}>
                <div>Doc No</div><div>Date</div><div>Source</div><div>Reference · Memo</div><div style={{ textAlign: 'right' }}>Amount</div>
              </div>
              {entries.map((e) => {
                const open = expanded === e.id
                return (
                  <div key={e.id} style={{ borderBottom: '1px solid var(--line-soft)' }}>
                    <div className="mms-row" onClick={() => setExpanded(open ? null : e.id)}
                      style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '12px 20px', fontSize: 13, alignItems: 'center', cursor: 'pointer', background: open ? 'var(--bg-2)' : 'transparent' }}>
                      <span className="mono" style={{ fontWeight: 600, color: 'var(--ac-bright)' }}>{docNo(e.id)}</span>
                      <span className="mono">{e.entryDate}</span>
                      <span><SourceBadge e={e} /></span>
                      <span className="t-2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {e.reference ? `${e.reference} · ` : ''}{e.memo ?? '—'}
                      </span>
                      <span className="mono" style={{ textAlign: 'right', fontWeight: 600, color: 'var(--tx-0)' }}>{money(entryTotal(e))}</span>
                    </div>

                    {open && (
                      <div style={{ padding: '4px 20px 16px', background: 'var(--bg-0)' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', columnGap: 12, padding: '8px 0', borderBottom: '1px solid var(--line)', ...thStyle }}>
                          <div>Account</div><div style={{ textAlign: 'right' }}>Debit</div><div style={{ textAlign: 'right' }}>Credit</div>
                        </div>
                        {e.lines.map((l) => (
                          <div key={l.id} style={{ display: 'grid', gridTemplateColumns: '1fr 120px 120px', columnGap: 12, padding: '8px 0', fontSize: 13, borderBottom: '1px solid var(--line-soft)' }}>
                            <div>
                              <span className="mono t-2" style={{ marginRight: 8 }}>{l.accountCode}</span>
                              {l.accountName}
                              {l.memo && <span className="t-2"> · {l.memo}</span>}
                            </div>
                            <div className="mono" style={{ textAlign: 'right' }}>{Number(l.debit) ? money(l.debit) : '—'}</div>
                            <div className="mono" style={{ textAlign: 'right' }}>{Number(l.credit) ? money(l.credit) : '—'}</div>
                          </div>
                        ))}
                        <div className="row between wrap gap-2" style={{ marginTop: 8 }}>
                          <div className="t-2" style={{ fontSize: 12 }}>
                            Posting date: {e.postingDate ?? e.entryDate} · Currency: {e.currency}
                            {e.sourceType && <> · Posted automatically — change the {e.sourceLabel} to change this entry</>}
                          </div>
                          {!e.sourceType && canDelete && (
                            <Btn size="sm" variant="plain" icon="trash" onClick={() => handleDelete(e)} style={{ color: 'var(--bad)' }}>Delete voucher</Btn>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}

/* =====================================================================
   Manual Journal Entry
   ===================================================================== */
const emptyLine = (): JournalDraftLine => ({ accountId: '', drCr: '', amount: '', memo: '' })

export function ManualJournalScreen({ go }: ScreenProps) {
  const notify = useNotify()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [entryDate, setEntryDate] = useState(today())
  const [postingDate, setPostingDate] = useState(today())
  const [reference, setReference] = useState('')
  const [memo, setMemo] = useState('')
  const [lines, setLines] = useState<JournalDraftLine[]>([emptyLine(), emptyLine()])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.accounting.accounts.list()
      // Only leaf (postable) accounts — header accounts roll up their children.
      .then((d) => setAccounts((d as AccountRow[]).filter((a) => a.isActive && a.isPostable)))
      .catch(() => setAccounts([]))
  }, [])

  const accountGroups = useMemo(() => groupAccounts(accounts), [accounts])

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    for (const l of lines) {
      const amt = parseFloat(l.amount) || 0
      if (l.drCr === 'debit') debit += amt
      else if (l.drCr === 'credit') credit += amt
    }
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 }
  }, [lines])

  const balanced = totals.diff === 0 && totals.debit > 0

  const updateLine = (i: number, patch: Partial<JournalDraftLine>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const addLine = () => setLines((prev) => [...prev, emptyLine()])
  const removeLine = (i: number) => setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)))

  async function handlePost() {
    // Keep only rows the user actually filled in.
    const cleaned = lines
      .filter((l) => l.accountId !== '' && l.drCr !== '' && parseFloat(l.amount) > 0)
      .map((l) => ({ accountId: Number(l.accountId), drCr: l.drCr, amount: parseFloat(l.amount), memo: l.memo.trim() || null }))

    if (cleaned.length < 2) {
      notify.error('Cannot post', 'A journal entry needs at least two lines (a debit and a credit).')
      return
    }
    if (!balanced) {
      notify.error('Cannot post', `Entry is not balanced. Debit ${money(totals.debit)} ≠ Credit ${money(totals.credit)}.`)
      return
    }

    setSaving(true)
    try {
      await api.accounting.journal.create({
        entryDate,
        postingDate,
        reference: reference.trim() || null,
        memo: memo.trim() || null,
        lines: cleaned,
      })
      notify.success('Journal entry posted')
      go('ac/ledger')
    } catch (e) {
      notify.error('Could not post the entry', errMsg(e, 'Could not post the entry.'))
    } finally { setSaving(false) }
  }

  const cols = 'minmax(220px,1fr) 120px 150px minmax(160px,1fr) 44px'

  return (
    <div style={{ maxWidth: 1000 }}>
      <PageHead crumbs="Accounting · Journal Entries" title="Manual Journal Entry" icon="doc" sub="Post a balanced double-entry voucher."
        actions={<Btn variant="ghost" icon="list" onClick={() => go('ac/journal')}>All Entries</Btn>} />

      {/* Header */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <Field label="Document Date"><DateInput value={entryDate} onChange={setEntryDate} /></Field>
          <Field label="Posting Date"><DateInput value={postingDate} onChange={setPostingDate} /></Field>
          <Field label="Reference"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Optional" /></Field>
          <Field label="Memo"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="Optional" /></Field>
        </div>
      </Card>

      {/* Lines */}
      <Card pad={0} style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: 720 }}>
            <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '10px 20px', borderBottom: '1px solid var(--line)', ...thStyle }}>
              <div>Account</div><div>Dr / Cr</div><div>Amount</div><div>Text</div><div />
            </div>
            {lines.map((line, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '10px 20px', alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
                <Select value={line.accountId} onChange={(e) => updateLine(i, { accountId: e.target.value ? Number(e.target.value) : '' })}>
                  <option value="">Select account…</option>
                  {accountGroups.map((grp) => (
                    <optgroup key={grp.label} label={grp.label}>
                      {grp.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
                <Select value={line.drCr} onChange={(e) => updateLine(i, { drCr: e.target.value as JournalDraftLine['drCr'] })}>
                  <option value="">—</option>
                  <option value="debit">Debit</option>
                  <option value="credit">Credit</option>
                </Select>
                <Input type="number" min="0" step="0.01" value={line.amount} onChange={(e) => updateLine(i, { amount: e.target.value })}
                  placeholder="0.00" style={{ textAlign: 'right' }} />
                <Input value={line.memo} onChange={(e) => updateLine(i, { memo: e.target.value })} placeholder="Line text" />
                <button className="mms-act danger" onClick={() => removeLine(i)} disabled={lines.length <= 2} title="Remove line"
                  style={lines.length <= 2 ? { opacity: 0.35, cursor: 'not-allowed' } : undefined}>
                  <Icon n="trash" s={15} />
                </button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding: '12px 20px' }}>
          <Btn variant="plain" size="sm" icon="plus" onClick={addLine} style={{ color: 'var(--ac-bright)' }}>Add line</Btn>
        </div>
      </Card>

      {/* Balance bar + actions */}
      <Card>
        <div className="row between wrap gap-4">
          <div className="row gap-6 wrap" style={{ fontSize: 13.5 }}>
            <div><span className="t-2">Debit </span><b className="mono">{money(totals.debit)}</b></div>
            <div><span className="t-2">Credit </span><b className="mono">{money(totals.credit)}</b></div>
            <div style={{ fontWeight: 700, color: balanced ? 'var(--ok)' : 'var(--bad)' }}>
              {balanced ? '✓ Balanced' : `Difference ${money(Math.abs(totals.diff))}`}
            </div>
          </div>
          <Btn variant="primary" icon="check" onClick={handlePost} disabled={saving || !balanced}>{saving ? 'Posting…' : 'Post Entry'}</Btn>
        </div>
      </Card>
    </div>
  )
}

/* =====================================================================
   General Ledger — running balance for one account over a date range
   ===================================================================== */
export function GeneralLedgerScreen(_: ScreenProps) {
  const notify = useNotify()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [accountId, setAccountId] = useState<number | ''>('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [ledger, setLedger] = useState<GeneralLedger | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.accounting.accounts.list().then((d) => setAccounts(d as AccountRow[])).catch(() => setAccounts([]))
  }, [])

  const accountGroups = useMemo(() => groupAccounts(accounts), [accounts])

  async function run() {
    if (!accountId) { notify.error('Please select an account.'); return }
    setLoading(true)
    try {
      setLedger(await api.accounting.ledger({ accountId: Number(accountId), from: from || undefined, to: to || undefined }) as GeneralLedger)
    } catch (e) {
      notify.error('Could not load the ledger', errMsg(e, 'Could not load the ledger.'))
      setLedger(null)
    } finally { setLoading(false) }
  }

  return (
    <div>
      <PageHead crumbs="Accounting" title="General Ledger" icon="wallet" sub="Running balance for a single account over a date range." />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="Account" style={{ gridColumn: 'span 2' }}>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Select account…</option>
              {accountGroups.map((grp) => (
                <optgroup key={grp.label} label={grp.label}>
                  {grp.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="To"><DateInput value={to} onChange={setTo} /></Field>
          <Btn variant="primary" icon="search" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'View'}</Btn>
        </div>
      </Card>

      {ledger && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--line)' }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              <span className="mono" style={{ color: 'var(--ac-bright)' }}>{ledger.account.code}</span> · {ledger.account.name}
            </div>
            <div className="t-2" style={{ fontSize: 13 }}>Opening balance: <b className="mono" style={{ color: 'var(--tx-0)' }}>{money(ledger.openingBalance)}</b></div>
          </div>
          <Table cols={[
            { label: 'Doc No', w: 110 }, { label: 'Date', w: 110 }, { label: 'Source', w: 140 }, { label: 'Reference · Memo' },
            { label: 'Debit', align: 'right', w: 130 }, { label: 'Credit', align: 'right', w: 130 }, { label: 'Balance', align: 'right', w: 140 },
          ]}
            rows={[
              ...(ledger.lines.length ? ledger.lines.map((l) => ({ kind: 'line' as const, l })) : [{ kind: 'empty' as const }]),
              { kind: 'total' as const },
            ]}
            render={(r) => {
              if (r.kind === 'empty') return <td colSpan={7} style={{ padding: '16px 14px', fontSize: 13, color: 'var(--tx-3)' }}>No postings in this range.</td>
              if (r.kind === 'total') return (
                <>
                  <Td style={totalCell} />
                  <Td c="var(--tx-0)" style={totalCell}>Totals</Td>
                  <Td style={totalCell} />
                  <Td style={totalCell} />
                  <Td align="right" mono c="var(--tx-0)" style={totalCell}>{money(ledger.totalDebit)}</Td>
                  <Td align="right" mono c="var(--tx-0)" style={totalCell}>{money(ledger.totalCredit)}</Td>
                  <Td align="right" mono c="var(--tx-0)" style={totalCell}>{money(ledger.closingBalance)}</Td>
                </>
              )
              const l = r.l
              return (
                <>
                  <Td mono style={{ fontSize: 12 }}>{l.docNo}</Td>
                  <Td mono>{l.date}</Td>
                  <Td c="var(--tx-2)">{l.source}</Td>
                  <Td c="var(--tx-2)" style={{ whiteSpace: 'normal' }}>{l.reference ? `${l.reference} · ` : ''}{l.memo ?? '—'}</Td>
                  <Td align="right" mono>{l.debit ? money(l.debit) : '—'}</Td>
                  <Td align="right" mono>{l.credit ? money(l.credit) : '—'}</Td>
                  <Td align="right" mono c="var(--tx-0)" style={{ fontWeight: 600 }}>{money(l.balance)}</Td>
                </>
              )
            }} />
        </Card>
      )}
    </div>
  )
}

/* =====================================================================
   Trial Balance — every account with a movement; Dr must equal Cr
   ===================================================================== */
export function TrialBalanceScreen(_: ScreenProps) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [tb, setTb] = useState<TrialBalance | null>(null)
  const [loading, setLoading] = useState(false)

  async function run() {
    setLoading(true)
    try {
      setTb(await api.accounting.trialBalance({ from: from || undefined, to: to || undefined }) as TrialBalance)
    } catch {
      setTb(null)
    } finally { setLoading(false) }
  }
  useEffect(() => { run() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ maxWidth: 820 }}>
      <PageHead crumbs="Accounting" title="Trial Balance" icon="chart" sub="Every account with a movement — total debits must equal total credits." />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Field label="From"><DateInput value={from} onChange={setFrom} /></Field>
          <Field label="To"><DateInput value={to} onChange={setTo} /></Field>
          <Btn variant="primary" icon="bolt" onClick={run} disabled={loading}>{loading ? 'Loading…' : 'Run'}</Btn>
        </div>
      </Card>

      {tb && (
        <Card pad={0} style={{ overflow: 'hidden' }}>
          <Table cols={[{ label: 'Code', w: 110 }, { label: 'Account' }, { label: 'Debit', align: 'right', w: 140 }, { label: 'Credit', align: 'right', w: 140 }]}
            rows={[
              ...(tb.rows.length ? tb.rows.map((row) => ({ kind: 'row' as const, row })) : [{ kind: 'empty' as const }]),
              { kind: 'total' as const },
            ]}
            render={(r) => {
              if (r.kind === 'empty') return <td colSpan={4} style={{ padding: '16px 14px', fontSize: 13, color: 'var(--tx-3)' }}>No movements in this range.</td>
              if (r.kind === 'total') return (
                <>
                  <Td style={totalCell} />
                  <Td c={tb.balanced ? 'var(--ok)' : 'var(--bad)'} style={totalCell}>{tb.balanced ? '✓ Balanced' : '✗ Not balanced'}</Td>
                  <Td align="right" mono c="var(--tx-0)" style={totalCell}>{money(tb.totalDebit)}</Td>
                  <Td align="right" mono c="var(--tx-0)" style={totalCell}>{money(tb.totalCredit)}</Td>
                </>
              )
              return (
                <>
                  <Td mono c="var(--ac-bright)" style={{ fontWeight: 600 }}>{r.row.code}</Td>
                  <Td c="var(--tx-0)">{r.row.name}</Td>
                  <Td align="right" mono>{r.row.debit ? money(r.row.debit) : '—'}</Td>
                  <Td align="right" mono>{r.row.credit ? money(r.row.credit) : '—'}</Td>
                </>
              )
            }} />
        </Card>
      )}
    </div>
  )
}

/* =====================================================================
   Financial Year + Opening Balances
   ===================================================================== */
type YearForm = { yearName: string; startDate: string; endDate: string; isActive: boolean }
const EMPTY_FORM: YearForm = { yearName: '', startDate: '', endDate: '', isActive: false }

function OpeningBalanceScreen({ year, onBack }: { year: FinancialYear; onBack: () => void }) {
  const notify = useNotify()
  const [data, setData] = useState<OpeningBalancesResponse | null>(null)
  const [saving, setSaving] = useState(false)
  // local edits: accountId → { debit, credit }
  const [edits, setEdits] = useState<Record<number, { debit: string; credit: string }>>({})

  useEffect(() => {
    api.accounting.years.openingBalances(year.id)
      .then((res: OpeningBalancesResponse) => {
        setData(res)
        const init: Record<number, { debit: string; credit: string }> = {}
        res.accounts.forEach((a) => { init[a.accountId] = { debit: a.debit, credit: a.credit } })
        setEdits(init)
      })
      .catch(() => notify.error('Could not load opening balances.'))
  }, [year.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const setField = (accountId: number, field: 'debit' | 'credit', value: string) =>
    setEdits((prev) => ({ ...prev, [accountId]: { ...prev[accountId], [field]: value } }))

  const totals = useMemo(() => {
    let debit = 0
    let credit = 0
    Object.values(edits).forEach((v) => { debit += parseFloat(v.debit) || 0; credit += parseFloat(v.credit) || 0 })
    return { debit, credit, diff: Math.round((debit - credit) * 100) / 100 }
  }, [edits])

  async function save() {
    setSaving(true)
    try {
      const balances = Object.entries(edits).map(([id, v]) => ({ accountId: Number(id), debit: v.debit || '0', credit: v.credit || '0' }))
      await api.accounting.years.saveOpeningBalances(year.id, balances)
      notify.success('Opening balances saved and posted to the ledger.')
    } catch (e) {
      notify.error('Could not save opening balances', errMsg(e, 'Please check the balances.'))
    } finally { setSaving(false) }
  }

  if (!data) return <Loading />

  // Group accounts by category → group for display
  const groups: Record<string, { group: string; category: string; accounts: OpeningBalanceAccount[] }> = {}
  data.accounts.forEach((a) => {
    const key = `${a.categoryName}__${a.groupName}`
    if (!groups[key]) groups[key] = { category: a.categoryName ?? '', group: a.groupName ?? '', accounts: [] }
    groups[key].accounts.push(a)
  })
  const cols = '90px 1fr 170px 170px'

  return (
    <div>
      <PageHead crumbs="Accounting · Financial Year" title="Opening Balances" icon="coins"
        sub={<>{year.yearName} · {year.startDate} → {year.endDate}</>}
        actions={<Btn variant="ghost" icon="refund" onClick={onBack}>Back</Btn>} />

      {Object.values(groups).map(({ category, group, accounts }) => (
        <Card key={`${category}-${group}`} pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
          <div style={{ padding: '10px 20px', background: 'var(--bg-2)', borderBottom: '1px solid var(--line)' }}>
            <span className="eyebrow">{category}</span>
            <span style={{ fontSize: 13, fontWeight: 700, marginLeft: 10 }}>{group}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '8px 20px', borderBottom: '1px solid var(--line)', ...thStyle }}>
                <div>Code</div><div>Account</div><div style={{ textAlign: 'right' }}>Debit (LKR)</div><div style={{ textAlign: 'right' }}>Credit (LKR)</div>
              </div>
              {accounts.map((acc) => {
                const e = edits[acc.accountId] ?? { debit: '0.00', credit: '0.00' }
                return (
                  <div key={acc.accountId} style={{ display: 'grid', gridTemplateColumns: cols, columnGap: 12, padding: '8px 20px', alignItems: 'center', borderBottom: '1px solid var(--line-soft)', fontSize: 13.5 }}>
                    <div className="mono t-2" style={{ fontSize: 13 }}>{acc.accountCode}</div>
                    <div style={{ paddingLeft: acc.parentId ? 16 : 0, color: 'var(--tx-0)', fontWeight: acc.isHeader ? 700 : 400 }}>
                      {acc.accountName}
                      {acc.isHeader && <span className="t-2" style={{ marginLeft: 8, fontSize: 11, fontWeight: 600 }}>· header — enter on sub-accounts</span>}
                    </div>
                    <Input type="number" min="0" step="0.01" value={e.debit} disabled={acc.isHeader} onChange={(ev) => setField(acc.accountId, 'debit', ev.target.value)} style={{ textAlign: 'right' }} />
                    <Input type="number" min="0" step="0.01" value={e.credit} disabled={acc.isHeader} onChange={(ev) => setField(acc.accountId, 'credit', ev.target.value)} style={{ textAlign: 'right' }} />
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      ))}

      <Card style={{ position: 'sticky', bottom: 0, marginTop: 8 }}>
        <div className="row between wrap gap-4">
          <div className="row gap-6 wrap" style={{ fontSize: 13.5 }}>
            <div><span className="t-2">Debit </span><b className="mono">{money(totals.debit)}</b></div>
            <div><span className="t-2">Credit </span><b className="mono">{money(totals.credit)}</b></div>
            <div style={{ fontWeight: 700, color: totals.diff === 0 ? 'var(--ok)' : 'var(--bad)' }}>
              {totals.diff === 0 ? '✓ Balanced' : `Difference ${money(Math.abs(totals.diff))}`}
            </div>
          </div>
          <div className="row gap-2">
            <Btn variant="plain" onClick={onBack}>Cancel</Btn>
            <Btn variant="primary" icon="check" onClick={save} disabled={saving || totals.diff !== 0}>{saving ? 'Saving…' : 'Save Opening Balances'}</Btn>
          </div>
        </div>
      </Card>
    </div>
  )
}

export function FinancialYearScreen(_: ScreenProps) {
  const notify = useNotify()
  const [years, setYears] = useState<FinancialYear[]>([])
  const [loading, setLoading] = useState(true)

  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<FinancialYear | null>(null)
  const [form, setForm] = useState<YearForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  // Opening-balance sub-screen
  const [obYear, setObYear] = useState<FinancialYear | null>(null)

  async function load() {
    setLoading(true)
    try { setYears(await api.accounting.years.list() as FinancialYear[]) }
    catch { setYears([]) }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  function openAdd() { setEditing(null); setForm(EMPTY_FORM); setFormError(''); setModalOpen(true) }
  function openEdit(y: FinancialYear) {
    setEditing(y)
    setForm({ yearName: y.yearName, startDate: y.startDate, endDate: y.endDate, isActive: y.isActive })
    setFormError(''); setModalOpen(true)
  }

  async function save() {
    if (!form.yearName.trim()) { setFormError('Year name is required.'); return }
    if (!form.startDate) { setFormError('Start date is required.'); return }
    if (!form.endDate) { setFormError('End date is required.'); return }
    if (form.endDate <= form.startDate) { setFormError('End date must be after start date.'); return }
    setSaving(true); setFormError('')
    try {
      if (editing) {
        await api.accounting.years.update(editing.id, form)
        notify.success('Financial year updated.')
      } else {
        await api.accounting.years.create(form)
        notify.success('Financial year created.')
      }
      setModalOpen(false)
      await load()
    } catch (e) {
      setFormError(errMsg(e, 'Could not save.'))
    } finally { setSaving(false) }
  }

  async function handleDelete(y: FinancialYear) {
    if (y.isActive) { notify.error('Cannot delete the active financial year.'); return }
    const ok = await notify.confirm({ title: `Delete financial year "${y.yearName}"?`, msg: 'This action cannot be undone.', danger: true, okText: 'Delete' })
    if (!ok) return
    try {
      await api.accounting.years.remove(y.id)
      notify.success('Deleted.')
      await load()
    } catch { notify.error('Could not delete.') }
  }

  async function handleSetActive(y: FinancialYear) {
    try {
      await api.accounting.years.setActive(y.id)
      notify.success(`"${y.yearName}" set as active year.`)
      await load()
    } catch { notify.error('Could not set active year.') }
  }

  // Show opening-balance screen when a year is selected.
  if (obYear) return <OpeningBalanceScreen year={obYear} onBack={() => setObYear(null)} />

  return (
    <div>
      <PageHead crumbs="Accounting" title="Financial Years" icon="calendar"
        sub={`${years.length} financial year${years.length !== 1 ? 's' : ''} defined`}
        actions={<Btn variant="primary" icon="plus" onClick={openAdd}>New Financial Year</Btn>} />

      <Card pad={0}>
        {loading ? <Loading /> : (
          <Table cols={[
            { label: 'Year' }, { label: 'Start Date' }, { label: 'End Date' }, { label: 'Status', align: 'center' },
            { label: '' }, { label: 'Actions', align: 'right', w: 100 },
          ]}
            rows={years}
            empty="No financial years yet."
            render={(y) => (
              <>
                <Td c="var(--tx-0)" style={{ fontWeight: 700 }}>{y.yearName}</Td>
                <Td mono c="var(--tx-2)">{y.startDate}</Td>
                <Td mono c="var(--tx-2)">{y.endDate}</Td>
                <Td align="center"><ActiveBadge active={y.isActive} /></Td>
                <Td>
                  <div className="row gap-2">
                    <Btn size="sm" variant="ghost" icon="coins" onClick={() => setObYear(y)}>Opening Balances</Btn>
                    {!y.isActive && <Btn size="sm" variant="plain" icon="check" onClick={() => handleSetActive(y)}>Set Active</Btn>}
                  </div>
                </Td>
                <Td align="right">
                  <div className="row gap-1" style={{ justifyContent: 'flex-end' }}>
                    <button className="mms-act" title="Edit" onClick={() => openEdit(y)}><Icon n="edit" s={15} /></button>
                    <button className="mms-act danger" title="Delete" onClick={() => handleDelete(y)}><Icon n="trash" s={15} /></button>
                  </div>
                </Td>
              </>
            )} />
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} width={500}
        title={editing ? 'Edit Financial Year' : 'New Financial Year'}
        footer={<>
          <Btn variant="plain" onClick={() => setModalOpen(false)}>Cancel</Btn>
          <Btn variant="primary" icon="check" onClick={save} disabled={saving}>{saving ? 'Saving…' : editing ? 'Update' : 'Create'}</Btn>
        </>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Year Name *" full>
            <Input autoFocus value={form.yearName} placeholder="e.g. 2027/2028" onChange={(e) => setForm({ ...form, yearName: e.target.value })} />
          </Field>
          <Field label="Start Date *"><DateInput value={form.startDate} onChange={(v) => setForm({ ...form, startDate: v })} /></Field>
          <Field label="End Date *"><DateInput value={form.endDate} onChange={(v) => setForm({ ...form, endDate: v })} /></Field>
          <label className="row gap-2" style={{ gridColumn: '1 / -1', fontSize: 13.5, cursor: 'pointer' }}>
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Set as active financial year
          </label>
          {formError && <ErrBox>{formError}</ErrBox>}
        </div>
      </Modal>
    </div>
  )
}

/* =====================================================================
   Posting Setup — which ledger account each auto-posting role uses
   (sales invoices, receipts, expenses, GRNs, returns, stock adjustments
   post journals automatically), plus a full re-post of every document.
   ===================================================================== */
export function PostingSetupScreen({ user }: ScreenProps) {
  const notify = useNotify()
  const [setup, setSetup] = useState<PostingSetup | null>(null)
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [result, setResult] = useState<RebuildResult | null>(null)
  const isAdmin = user?.role === 'admin'

  async function load() {
    const [s, a] = await Promise.all([api.accounting.posting.setup(), api.accounting.accounts.list()])
    setSetup(s as PostingSetup)
    setAccounts((a as AccountRow[]).filter((x) => x.isActive && x.isPostable))
    setEdits({})
  }
  useEffect(() => { load().catch(() => notify.error('Could not load the posting setup.')) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const accountGroups = useMemo(() => groupAccounts(accounts), [accounts])
  const changed = Object.keys(edits).length > 0

  async function save() {
    setSaving(true)
    try {
      setSetup(await api.accounting.posting.save(Object.entries(edits).map(([key, accountId]) => ({ key, accountId }))) as PostingSetup)
      setEdits({})
      notify.success('Posting setup saved', 'New documents post to these accounts. Re-post to move existing ones.')
    } catch (e) {
      notify.error('Could not save', errMsg(e, 'Could not save the posting setup.'))
    } finally { setSaving(false) }
  }

  async function rebuild() {
    const ok = await notify.confirm({
      title: 'Re-post all documents?',
      msg: 'Every invoice, receipt, expense, GRN, approved return, stock adjustment and opening balance is posted again with the current setup. Manual journal entries are not touched.',
      okText: 'Re-post',
    })
    if (!ok) return
    setRebuilding(true)
    try {
      const r = await api.accounting.posting.rebuild() as RebuildResult
      setResult(r)
      if (r.errors.length) notify.error('Re-post finished with errors', `${r.errors.length} document(s) could not be posted.`)
      else notify.success('All documents re-posted')
      await load()
    } catch (e) {
      notify.error('Re-post failed', errMsg(e, 'Could not re-post the documents.'))
    } finally { setRebuilding(false) }
  }

  if (!setup) return <Loading />
  const problems = setup.roles.filter((r) => r.problem && !edits[r.key]).length

  return (
    <div style={{ maxWidth: 1080 }}>
      <PageHead crumbs="Accounting" title="Posting Setup" icon="bolt"
        sub="Sales, receipts, expenses, GRNs, returns and stock adjustments post journal entries automatically — choose the ledger account for each role."
        actions={isAdmin && <Btn variant="ghost" icon="bolt" onClick={rebuild} disabled={rebuilding || changed}>{rebuilding ? 'Re-posting…' : 'Re-post all documents'}</Btn>} />

      {problems > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)', borderRadius: 'var(--r-s)', fontSize: 13 }}>
          {problems} posting role{problems > 1 ? 's need' : ' needs'} an account — documents that use {problems > 1 ? 'them' : 'it'} will be refused until fixed.
        </div>
      )}

      <Card pad={0} style={{ overflow: 'hidden', marginBottom: 16 }}>
        <Table cols={[{ label: 'Role', w: 230 }, { label: 'Used for' }, { label: 'Ledger account', w: 330 }]}
          rows={setup.roles}
          render={(r) => (
            <>
              <Td c="var(--tx-0)" style={{ fontWeight: 600 }}>{r.label}</Td>
              <Td c="var(--tx-2)" style={{ whiteSpace: 'normal', fontSize: 12.5 }}>
                {r.usage}
                {r.problem && !edits[r.key] && <div style={{ color: 'var(--bad)', marginTop: 4 }}>{r.problem}</div>}
              </Td>
              <Td>
                <Select value={edits[r.key] ?? r.accountId ?? ''} disabled={!isAdmin}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setEdits((prev) => {
                      const next = { ...prev }
                      if (!v || v === r.accountId) delete next[r.key]; else next[r.key] = v
                      return next
                    })
                  }}>
                  {!r.accountId && <option value="">Select account…</option>}
                  {r.accountId && !accounts.some((a) => a.id === r.accountId) && (
                    <option value={r.accountId}>{r.accountCode} · {r.accountName} (not postable)</option>
                  )}
                  {accountGroups.map((grp) => (
                    <optgroup key={grp.label} label={grp.label}>
                      {grp.accounts.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                    </optgroup>
                  ))}
                </Select>
              </Td>
            </>
          )} />
        {isAdmin && (
          <div className="row gap-2" style={{ justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--line)' }}>
            <Btn variant="plain" onClick={() => setEdits({})} disabled={!changed}>Reset</Btn>
            <Btn variant="primary" icon="check" onClick={save} disabled={saving || !changed}>{saving ? 'Saving…' : 'Save Setup'}</Btn>
          </div>
        )}
      </Card>

      <Card>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Journal entries by source</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {setup.posted.map((p) => (
            <div key={p.type} style={{ padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--r-s)' }}>
              <div className="t-2" style={{ fontSize: 12 }}>{p.label}</div>
              <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--tx-0)' }}>{p.entries}</div>
            </div>
          ))}
        </div>
        {result && (
          <div style={{ marginTop: 14, fontSize: 13 }}>
            <div className="t-2">
              Last re-post: {Object.values(result.posted).reduce((s, n) => s + n, 0)} documents posted
              {result.removed > 0 && <> · {result.removed} journal(s) of deleted documents removed</>}
            </div>
            {result.errors.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--bad)' }}>
                {result.errors.map((err, i) => <li key={i}>{err}</li>)}
              </ul>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}
