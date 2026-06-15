/* NMS-Auto â€” Notification & Alert system
   Provides:
   - <NotifyProvider>   app-wide context
   - useNotify()        toast + confirm + center API
   - <NotificationBell> bell icon w/ unread badge and dropdown
   System alerts are generated on first mount from DB (low stock, overdue, credit risk).
*/
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Icon } from './Icon'
import { Btn } from './ui'
import { api } from '../api'

export type AlertKind = 'success' | 'error' | 'warning' | 'info'

interface Toast { id: number; kind: AlertKind; title: string; msg?: string; ttl: number }
export interface AppNotice {
  id: number
  kind: AlertKind
  title: string
  msg?: string
  at: number
  read?: boolean
  route?: string
  source?: string
}

interface ConfirmOpts { title: string; msg?: string; okText?: string; cancelText?: string; danger?: boolean }
interface PendingConfirm extends ConfirmOpts { resolve: (v: boolean) => void }

interface NotifyCtx {
  toast: (kind: AlertKind, title: string, msg?: string, ttl?: number) => void
  success: (title: string, msg?: string) => void
  error: (title: string, msg?: string) => void
  warning: (title: string, msg?: string) => void
  info: (title: string, msg?: string) => void
  confirm: (opts: ConfirmOpts) => Promise<boolean>
  push: (n: Omit<AppNotice, 'id' | 'at'>) => void
  notices: AppNotice[]
  unread: number
  markAllRead: () => void
  clear: () => void
  remove: (id: number) => void
  go?: (r: string) => void
  setRouter: (fn: (r: string) => void) => void
}

const Ctx = createContext<NotifyCtx | null>(null)
export const useNotify = (): NotifyCtx => {
  const c = useContext(Ctx)
  if (!c) throw new Error('useNotify must be used inside <NotifyProvider>')
  return c
}

let _id = 1
const nextId = () => _id++

/* ---------- generate live system alerts from the API ---------- */
async function loadSystemAlerts(): Promise<Omit<AppNotice, 'id' | 'at'>[]> {
  const out: Omit<AppNotice, 'id' | 'at'>[] = []
  try {
    const d: any = await api.dashboard()
    const k = d?.kpis || {}
    if (k.outOfStock > 0) out.push({ kind: 'error', title: 'Out of stock', msg: `${k.outOfStock} items at zero`, route: 'st/live', source: 'stock' })
    if (k.lowStock > 0) out.push({ kind: 'warning', title: 'Low stock', msg: `${k.lowStock} items below reorder`, route: 'st/live', source: 'stock' })
    if (d?.pendingReturns > 0) out.push({ kind: 'warning', title: 'Returns awaiting approval', msg: `${d.pendingReturns} pending`, route: 'dc/return', source: 'return' })
  } catch { /* ignore */ }
  return out
}

/* ---------- persistence ---------- */
const LS_KEY = 'mms-notices'

function loadStored(): AppNotice[] | null {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (raw == null) return null
    const arr = JSON.parse(raw) as AppNotice[]
    if (!Array.isArray(arr)) return null
    arr.forEach((n) => { if (n.id >= _id) _id = n.id + 1 })
    return arr
  } catch {
    return null
  }
}
function saveStored(arr: AppNotice[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(arr)) } catch { /* quota */ }
}

/* ---------- provider ---------- */
export function NotifyProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [notices, setNotices] = useState<AppNotice[]>(() => loadStored() || [])
  const [confirms, setConfirms] = useState<PendingConfirm[]>([])
  const routerRef = useRef<((r: string) => void) | undefined>(undefined)
  const seeded = useRef(false)

  // refresh system alerts (low/out stock, pending returns) once per session from the live API
  useEffect(() => {
    if (seeded.current) return
    seeded.current = true
    loadSystemAlerts().then((seeds) => {
      if (!seeds.length) return
      const now = Date.now()
      setNotices((cur) => [
        ...seeds.map((n, i) => ({ ...n, id: nextId(), at: now - i * 1000 })),
        ...cur.filter((n) => n.source === 'action'),
      ])
    })
  }, [])

  // persist notices to localStorage on every change
  useEffect(() => { saveStored(notices) }, [notices])

  const removeToast = useCallback((id: number) => {
    setToasts((ts) => ts.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback((kind: AlertKind, title: string, msg?: string, ttl = 4200) => {
    const id = nextId()
    setToasts((ts) => [...ts, { id, kind, title, msg, ttl }])
    if (ttl > 0) window.setTimeout(() => removeToast(id), ttl)
  }, [removeToast])

  const push = useCallback((n: Omit<AppNotice, 'id' | 'at'>) => {
    setNotices((arr) => [{ ...n, id: nextId(), at: Date.now() }, ...arr])
  }, [])

  const api = useMemo<NotifyCtx>(() => ({
    toast,
    success: (t, m) => { toast('success', t, m); push({ kind: 'success', title: t, msg: m, source: 'action' }) },
    error: (t, m) => { toast('error', t, m, 6000); push({ kind: 'error', title: t, msg: m, source: 'action' }) },
    warning: (t, m) => { toast('warning', t, m, 5000); push({ kind: 'warning', title: t, msg: m, source: 'action' }) },
    info: (t, m) => { toast('info', t, m); push({ kind: 'info', title: t, msg: m, source: 'action' }) },
    confirm: (opts) => new Promise<boolean>((resolve) => setConfirms((c) => [...c, { ...opts, resolve }])),
    push,
    notices,
    unread: notices.filter((n) => !n.read).length,
    markAllRead: () => setNotices((arr) => arr.map((n) => ({ ...n, read: true }))),
    clear: () => setNotices([]),
    remove: (id) => setNotices((arr) => arr.filter((n) => n.id !== id)),
    go: routerRef.current,
    setRouter: (fn) => { routerRef.current = fn },
  }), [toast, push, notices])

  const onConfirm = (idx: number, ok: boolean) => {
    setConfirms((c) => {
      c[idx]?.resolve(ok)
      return c.filter((_, i) => i !== idx)
    })
  }

  return (
    <Ctx.Provider value={api}>
      {children}
      <ToastStack toasts={toasts} onClose={removeToast} />
      {confirms.map((c, i) => (
        <ConfirmDialog key={i} opts={c} onClose={(ok) => onConfirm(i, ok)} />
      ))}
    </Ctx.Provider>
  )
}

/* ---------- styling helpers ---------- */
const KIND_COLOR: Record<AlertKind, { bg: string; line: string; fg: string; icon: string }> = {
  success: { bg: 'var(--ok-dim)', line: 'var(--ok)', fg: 'var(--ok)', icon: 'check' },
  error:   { bg: 'var(--bad-dim)', line: 'var(--bad)', fg: 'var(--bad)', icon: 'x' },
  warning: { bg: 'var(--warn-dim)', line: 'var(--warn)', fg: 'var(--warn)', icon: 'bell' },
  info:    { bg: 'var(--ac-dim)', line: 'var(--ac-line)', fg: 'var(--ac-bright)', icon: 'doc' },
}

/* ---------- toast stack ---------- */
function ToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  const wrap: CSSProperties = {
    position: 'fixed', top: 18, right: 18, zIndex: 400,
    display: 'flex', flexDirection: 'column', gap: 10, pointerEvents: 'none', maxWidth: 380,
  }
  return (
    <div style={wrap}>
      {toasts.map((t) => {
        const c = KIND_COLOR[t.kind]
        return (
          <div key={t.id} className="fade-in" style={{
            pointerEvents: 'auto', background: 'var(--bg-1)', border: '1px solid ' + c.line,
            borderLeft: '3px solid ' + c.line, borderRadius: 'var(--r-m)', padding: '12px 14px',
            boxShadow: 'var(--sh-3, 0 10px 30px -10px rgb(0 0 0 / .5))',
            display: 'flex', gap: 11, alignItems: 'flex-start', minWidth: 280,
          }}>
            <div style={{ width: 28, height: 28, borderRadius: 7, background: c.bg, color: c.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <Icon n={c.icon} s={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx-0)' }}>{t.title}</div>
              {t.msg && <div className="t-2" style={{ fontSize: 12.5, marginTop: 2, lineHeight: 1.4 }}>{t.msg}</div>}
            </div>
            <button onClick={() => onClose(t.id)} aria-label="Dismiss" style={{
              background: 'transparent', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 2,
            }}>
              <Icon n="x" s={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}

/* ---------- confirm dialog ---------- */
function ConfirmDialog({ opts, onClose }: { opts: ConfirmOpts; onClose: (ok: boolean) => void }) {
  return (
    <div onClick={() => onClose(false)} style={{
      position: 'fixed', inset: 0, zIndex: 350, background: 'oklch(0 0 0 / 0.55)', backdropFilter: 'blur(3px)',
      display: 'grid', placeItems: 'center', padding: 20, animation: 'fade .15s ease both',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 'min(440px,100%)', background: 'var(--bg-1)', border: '1px solid var(--line)',
        borderRadius: 'var(--r-l)', boxShadow: 'var(--sh-3, 0 30px 60px -20px rgb(0 0 0 / .6))', overflow: 'hidden',
        animation: 'slideIn .2s var(--ease) both',
      }}>
        <div style={{ padding: '20px 22px 6px' }}>
          <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
            <div style={{
              width: 36, height: 36, borderRadius: 9, flexShrink: 0,
              background: opts.danger ? 'var(--bad-dim)' : 'var(--ac-dim)',
              color: opts.danger ? 'var(--bad)' : 'var(--ac-bright)',
              display: 'grid', placeItems: 'center',
            }}>
              <Icon n={opts.danger ? 'trash' : 'bell'} s={18} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: 17 }}>{opts.title}</h3>
              {opts.msg && <div className="t-2" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{opts.msg}</div>}
            </div>
          </div>
        </div>
        <div className="row gap-2" style={{ padding: '14px 22px', justifyContent: 'flex-end', borderTop: '1px solid var(--line)', marginTop: 14 }}>
          <Btn variant="plain" onClick={() => onClose(false)}>{opts.cancelText || 'Cancel'}</Btn>
          <Btn variant={opts.danger ? 'danger' : 'primary'} icon={opts.danger ? 'trash' : 'check'} onClick={() => onClose(true)}>
            {opts.okText || (opts.danger ? 'Delete' : 'Confirm')}
          </Btn>
        </div>
      </div>
    </div>
  )
}

/* ---------- bell ---------- */
function timeAgo(at: number) {
  const s = Math.floor((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return Math.floor(s / 60) + 'm ago'
  if (s < 86400) return Math.floor(s / 3600) + 'h ago'
  return Math.floor(s / 86400) + 'd ago'
}

export function NotificationBell() {
  const n = useNotify()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const handleClick = (item: AppNotice) => {
    n.remove(item.id)
    if (item.route && n.go) n.go(item.route)
    setOpen(false)
  }

  const handleClearAll = async () => {
    const ok = await n.confirm({
      title: 'Clear all notifications?',
      msg: `This will remove all ${n.notices.length} notifications from the inbox.`,
      danger: true,
      okText: 'Clear all',
    })
    if (!ok) return
    n.clear()
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen((o) => !o); if (!open) n.markAllRead() }}
        className="mms-icobtn"
        title="Notifications"
        style={{ position: 'relative', background: 'var(--bg-2)', border: '1px solid var(--line)', borderRadius: 8, padding: 8, color: 'var(--tx-1)' }}
      >
        <Icon n="bell" s={18} />
        {n.unread > 0 && (
          <span style={{
            position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 10, background: 'var(--bad)', color: '#fff', fontSize: 10, fontWeight: 700,
            display: 'grid', placeItems: 'center', border: '2px solid var(--bg-1)', fontFamily: 'JetBrains Mono',
          }}>{n.unread > 99 ? '99+' : n.unread}</span>
        )}
      </button>
      {open && (
        <div className="fade-in" style={{
          position: 'absolute', top: 'calc(100% + 10px)', right: 0, width: 380, maxHeight: '70vh',
          background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-l)',
          boxShadow: '0 20px 60px -15px rgb(0 0 0 / .6)', zIndex: 100, display: 'flex', flexDirection: 'column',
        }}>
          <div className="row between" style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-0)' }}>Notifications</div>
              <div className="t-2" style={{ fontSize: 11, marginTop: 1 }}>{n.notices.length} total</div>
            </div>
            {n.notices.length > 0 && (
              <button onClick={handleClearAll} style={{
                background: 'transparent', border: '1px solid var(--line-soft)', borderRadius: 'var(--r-s)',
                padding: '5px 9px', color: 'var(--tx-2)', fontSize: 11.5, cursor: 'pointer',
              }}>Clear all</button>
            )}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {n.notices.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-3)', display: 'grid', placeItems: 'center', margin: '0 auto 12px', color: 'var(--tx-3)' }}>
                  <Icon n="bell" s={22} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--tx-2)' }}>You're all caught up</div>
              </div>
            ) : n.notices.map((it) => {
              const c = KIND_COLOR[it.kind]
              return (
                <div key={it.id} onClick={() => handleClick(it)} style={{
                  display: 'flex', gap: 11, padding: '12px 14px', borderBottom: '1px solid var(--line-soft)',
                  cursor: 'pointer', transition: 'background .12s',
                }} onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-2)')}
                   onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                  <div style={{ width: 28, height: 28, borderRadius: 7, background: c.bg, color: c.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                    <Icon n={c.icon} s={15} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row between" style={{ gap: 6 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.title}</div>
                      <div className="t-3" style={{ fontSize: 10.5, flexShrink: 0, fontFamily: 'JetBrains Mono' }}>{timeAgo(it.at)}</div>
                    </div>
                    {it.msg && <div className="t-2" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>{it.msg}</div>}
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); n.remove(it.id) }} aria-label="Dismiss" style={{
                    background: 'transparent', border: 'none', color: 'var(--tx-3)', cursor: 'pointer', padding: 2, alignSelf: 'flex-start',
                  }}>
                    <Icon n="x" s={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
