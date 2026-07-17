/* NMS-Auto — app shell (sidebar, topbar), ported from shell.jsx */
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { Btn } from './ui'
import { NotificationBell, useNotify } from './Notify'
import DB from '../data'
import { auth, type AuthUser } from '../api'
import { canAccessRoute } from '../lib/permissions'

export interface NavLeaf { id: string; label: string; icon: string; star?: boolean }
export interface NavSection { section: string; icon: string; items: NavLeaf[] }
export type NavNode = NavLeaf | NavSection

export const NAV: NavNode[] = [
  { id: 'dash', label: 'Dashboard', icon: 'dash' },
  { section: 'Master Files', icon: 'folder', items: [
    { id: 'm/item', label: 'Item Master', icon: 'pkg', star: true },
    { id: 'm/customer', label: 'Customer Master', icon: 'users', star: true },
    { id: 'm/supplier', label: 'Supplier Master', icon: 'truck', star: true },
    { id: 'm/salesExec', label: 'Sales Executive', icon: 'target' },
    { id: 'm/vehicleBrand', label: 'Vehicle Brand', icon: 'car' },
    { id: 'm/vehicleModel', label: 'Vehicle Model', icon: 'car' },
    { id: 'm/brand', label: 'Brand Master', icon: 'tag' },
    { id: 'm/brandCat', label: 'Brand Category', icon: 'tag' },
    { id: 'm/group', label: 'Group Master', icon: 'layers' },
    { id: 'm/services', label: 'Services', icon: 'wrench' },
    { id: 'm/department', label: 'Department', icon: 'building' },
    { id: 'm/employee', label: 'Employee Master', icon: 'users' },
    { id: 'm/payment', label: 'Payment Master', icon: 'wallet' },
    { id: 'm/bank', label: 'Bank Master', icon: 'building' },
    { id: 'm/country', label: 'Country Master', icon: 'pin' },
    { id: 'm/branch', label: 'Branch Master', icon: 'store' },
    { id: 'm/expenseType', label: 'Expense Type', icon: 'coins' },
    { id: 'm/credit', label: 'Credit Period', icon: 'clock' },
    { id: 'm/remark', label: 'Invoice Remark', icon: 'doc' },
  ] },
  { section: 'Data Capture', icon: 'doc', items: [
    { id: 'dc/po', label: 'Purchase Order', icon: 'cart' },
    { id: 'dc/costing', label: 'Costing & Shipment', icon: 'box' },
    { id: 'dc/grn', label: 'GRN', icon: 'truck' },
    { id: 'dc/tracking', label: 'PO Tracking', icon: 'chart' },
    { id: 'dc/quote', label: 'Quotation', icon: 'doc' },
    { id: 'dc/dispatch', label: 'Dispatch Notes', icon: 'truck', star: true },
    { id: 'dc/invoice', label: 'Sales Invoice', icon: 'receipt' },
    { id: 'dc/settlement', label: 'Outstanding Settlement', icon: 'wallet', star: true },
    { id: 'dc/return', label: 'Sales Return', icon: 'refund' },
    { id: 'dc/receipt', label: 'Payment Receipt', icon: 'wallet' },
    { id: 'dc/expense', label: 'Expense', icon: 'coins' },
  ] },
  { section: 'Stores', icon: 'store', items: [
    { id: 'st/transfer', label: 'Stock Transfer', icon: 'swap' },
    { id: 'st/adjust', label: 'Stock Adjustment', icon: 'adjust' },
    { id: 'st/bin', label: 'BIN Card', icon: 'list' },
    { id: 'st/live', label: 'Live Stock', icon: 'box' },
    { id: 'st/price', label: 'Price Control', icon: 'tag' },
  ] },
  { id: 'reports', label: 'Reports', icon: 'chart' },
  { section: 'Administration', icon: 'shield', items: [
    { id: 'ad/reps', label: 'Sales Reps & App', icon: 'phone', star: true },
    { id: 'ad/users', label: 'User Management', icon: 'users' },
    { id: 'ad/perm', label: 'User Permission', icon: 'shield' },
    { id: 'ad/company', label: 'Company Profile', icon: 'building' },
  ] },
]

export const flatNav: Record<string, NavLeaf> = {}
NAV.forEach((n) => {
  if ('items' in n) n.items.forEach((i) => (flatNav[i.id] = i))
  else flatNav[n.id] = n
})

function NavItem({ item, active, sub, onClick }: { item: NavLeaf; active: boolean; sub?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={'mms-nav' + (active ? ' active' : '')} style={{
      display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
      padding: sub ? '8px 10px 8px 12px' : '9px 10px', marginTop: 2,
      background: active ? 'var(--ac-dim)' : 'transparent', border: '1px solid ' + (active ? 'var(--ac-line)' : 'transparent'),
      borderRadius: 'var(--r-s)', color: active ? 'var(--ac-bright)' : 'var(--tx-1)', fontSize: 13, fontWeight: active ? 600 : 500,
      transition: 'all .14s',
    }}>
      <Icon n={item.icon} s={17} c={active ? 'var(--ac-bright)' : 'var(--tx-2)'} />
      <span style={{ flex: 1 }}>{item.label}</span>
      {item.star && <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--ac)', opacity: active ? 0 : 0.7 }} />}
    </button>
  )
}

export function Sidebar({ route, go, open, setOpen, company, user }: { route: string; go: (r: string) => void; open: boolean; setOpen: (b: boolean) => void; company: string; user?: AuthUser | null }) {
  // Filter NAV by permission: drop hidden leaves and collapse empty sections.
  const visibleNav: NavNode[] = NAV
    .map((n) => {
      if ('section' in n) {
        const items = n.items.filter((i) => canAccessRoute(user, i.id))
        return items.length ? { ...n, items } : null
      }
      return canAccessRoute(user, n.id) ? n : null
    })
    .filter((n): n is NavNode => n !== null)

  const [exp, setExp] = useState<Record<string, boolean>>(() => {
    // All sections collapsed by default; only auto-expand the one containing the active route.
    const o: Record<string, boolean> = {}
    NAV.forEach((n) => {
      if ('section' in n) o[n.section] = n.items.some((i) => i.id === route)
    })
    return o
  })
  return (
    <>
      <div onClick={() => setOpen(false)} className="sb-scrim" style={{ display: open ? 'block' : 'none' }} />
      <aside className={'mms-sb' + (open ? ' open' : '')} style={{ width: 'var(--sb-w)' }}>
        <div className="row gap-3" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', minHeight: 'var(--topbar-h)' }}>
          <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--ac)', display: 'grid', placeItems: 'center', color: '#fff', flexShrink: 0, boxShadow: '0 2px 12px -2px var(--ac-line)' }}><Icon n="wrench" s={19} /></div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontFamily: 'Saira', fontWeight: 800, fontSize: 17, letterSpacing: '-0.01em' }} id="brand-name">{company}</div>
            <div className="eyebrow" style={{ fontSize: 9 }}>{DB.company.tagline}</div>
          </div>
        </div>
        <nav style={{ padding: '10px 10px 24px', overflowY: 'auto', flex: 1 }}>
          {visibleNav.map((n, i) => {
            if (!('section' in n)) return <NavItem key={n.id} item={n} active={route === n.id} onClick={() => { go(n.id); setOpen(false) }} />
            const open2 = exp[n.section]
            return (
              <div key={n.section} style={{ marginTop: i ? 8 : 0 }}>
                <button onClick={() => setExp((e) => ({ ...e, [n.section]: !e[n.section] }))} className="row between" style={{ width: '100%', background: 'none', border: 'none', padding: '7px 10px', color: 'var(--tx-2)' }}>
                  <span className="eyebrow" style={{ fontSize: 10 }}>{n.section}</span>
                  <Icon n="chevd" s={13} style={{ transform: open2 ? 'none' : 'rotate(-90deg)', transition: 'transform .2s' }} />
                </button>
                <div style={{ maxHeight: open2 ? n.items.length * 40 + 'px' : 0, overflow: 'hidden', transition: 'max-height .3s var(--ease)' }}>
                  {n.items.map((it) => <NavItem key={it.id} item={it} active={route === it.id} sub onClick={() => { go(it.id); setOpen(false) }} />)}
                </div>
              </div>
            )
          })}
        </nav>
      </aside>
    </>
  )
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() => document.documentElement.dataset.theme || 'dark')
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('mms-theme', next)
  }
  const isDark = theme === 'dark'
  return (
    <button
      className="mms-icobtn"
      onClick={toggle}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, color: 'var(--tx-1)' }}
    >
      <Icon n={isDark ? 'sun' : 'moon'} s={18} />
    </button>
  )
}

export function Topbar({ setOpen, go }: { setOpen: (fn: (o: boolean) => boolean) => void; route: string; go: (r: string) => void }) {
  const notify = useNotify()
  // Let notification-center clicks navigate via the app router.
  useEffect(() => { notify.setRouter(go) }, [notify, go])
  const headStyle: CSSProperties = { height: 'var(--topbar-h)', padding: '0 20px', borderBottom: '1px solid var(--line)', background: 'var(--top-bg)', backdropFilter: 'blur(10px)', position: 'sticky', top: 0, zIndex: 50 }
  return (
    <header className="mms-top row between" style={headStyle}>
      <div className="row gap-3">
        <button className="mms-burger" onClick={() => setOpen((o) => !o)} style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, color: 'var(--tx-1)', display: 'none' }}><Icon n="menu" s={18} /></button>
        <div className="topsearch row gap-2" style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)', padding: '8px 12px', width: 300, maxWidth: '40vw' }}>
          <Icon n="search" s={16} c="var(--tx-2)" />
          <input placeholder="Search items, invoices, customers…" style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-0)', fontSize: 13, width: '100%' }} />
          <kbd style={{ fontSize: 10, color: 'var(--tx-3)', border: '1px solid var(--line)', borderRadius: 4, padding: '1px 5px', fontFamily: 'JetBrains Mono' }}>⌘K</kbd>
        </div>
      </div>
      <div className="row gap-3">
        <Btn variant="ghost" size="sm" icon="plus" onClick={() => go('dc/invoice')}>New Invoice</Btn>
        <ThemeToggle />
        <NotificationBell />
        <div className="row gap-2" style={{ paddingLeft: 6, borderLeft: '1px solid var(--line)' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--bg-3)', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', fontFamily: 'Saira', fontWeight: 700, fontSize: 13, color: 'var(--ac-bright)' }}>AD</div>
          <div className="hide-sm" style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Admin User</div>
            <div className="t-2" style={{ fontSize: 11 }}>Administrator</div>
          </div>
          <button
            className="mms-icobtn"
            title="Logout"
            aria-label="Logout"
            onClick={async () => {
              try { await auth.logout() } catch {}
              auth.setToken(null)
              localStorage.removeItem('mms-route')
              window.location.reload()
            }}
            style={{ background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, color: 'var(--tx-1)', marginLeft: 6 }}
          >
            <Icon n="logout" s={18} />
          </button>
        </div>
      </div>
    </header>
  )
}
