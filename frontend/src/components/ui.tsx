/* NMS-Auto — shared UI kit, ported from ui.jsx */
import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/* ---------- primitives ---------- */
type Variant = 'primary' | 'solid' | 'ghost' | 'danger' | 'ok' | 'plain'
interface BtnProps {
  children?: ReactNode
  variant?: Variant
  size?: 'sm' | 'md' | 'lg'
  icon?: string
  iconR?: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  style?: CSSProperties
  title?: string
}
export function Btn({ children, variant = 'ghost', size = 'md', icon, iconR, onClick, active, disabled, style, title }: BtnProps) {
  const base: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    fontFamily: 'IBM Plex Sans', fontWeight: 600,
    borderRadius: 'var(--r-s)', border: '1px solid transparent',
    padding: size === 'sm' ? '5px 10px' : size === 'lg' ? '11px 18px' : '8px 14px',
    fontSize: size === 'sm' ? 12.5 : 13.5, lineHeight: 1, transition: 'all .15s var(--ease)',
    opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto', whiteSpace: 'nowrap', ...style,
  }
  const V: Record<Variant, CSSProperties> = {
    primary: { background: 'var(--ac)', color: '#fff', boxShadow: '0 2px 10px -2px var(--ac-line)' },
    solid: { background: 'var(--bg-2)', color: 'var(--tx-0)', border: '1px solid var(--line)' },
    ghost: { background: active ? 'var(--ac-dim)' : 'transparent', color: active ? 'var(--ac-bright)' : 'var(--tx-1)', border: '1px solid ' + (active ? 'var(--ac-line)' : 'var(--line-soft)') },
    danger: { background: 'var(--bad-dim)', color: 'var(--bad)', border: '1px solid var(--bad)' },
    ok: { background: 'var(--ok-dim)', color: 'var(--ok)', border: '1px solid var(--ok)' },
    plain: { background: 'transparent', color: 'var(--tx-2)', border: '1px solid transparent' },
  }
  return (
    <button title={title} className="mms-btn" style={{ ...base, ...V[variant] }} onClick={onClick} disabled={disabled}>
      {icon && <Icon n={icon} s={size === 'sm' ? 14 : 16} />}
      {children}
      {iconR && <Icon n={iconR} s={size === 'sm' ? 14 : 16} />}
    </button>
  )
}

type Tone = 'neutral' | 'blue' | 'green' | 'amber' | 'red'
export function Badge({ children, tone = 'neutral', dot }: { children?: ReactNode; tone?: Tone; dot?: boolean }) {
  const T = ({
    neutral: { bg: 'var(--bg-3)', c: 'var(--tx-1)' },
    blue: { bg: 'var(--ac-dim)', c: 'var(--ac-bright)' },
    green: { bg: 'var(--ok-dim)', c: 'var(--ok)' },
    amber: { bg: 'var(--warn-dim)', c: 'var(--warn)' },
    red: { bg: 'var(--bad-dim)', c: 'var(--bad)' },
  } as Record<Tone, { bg: string; c: string }>)[tone] || { bg: 'var(--bg-3)', c: 'var(--tx-1)' }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: '100px', background: T.bg, color: T.c, fontSize: 11.5, fontWeight: 600, fontFamily: 'IBM Plex Sans', letterSpacing: '.01em', whiteSpace: 'nowrap' }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: '50%', background: T.c }} />}
      {children}
    </span>
  )
}

export function Card({ children, style, pad = 20, className = '' }: { children?: ReactNode; style?: CSSProperties; pad?: number; className?: string }) {
  return (
    <div className={'mms-card ' + className} style={{ background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-l)', padding: pad, boxShadow: 'var(--sh-1)', ...style }}>
      {children}
    </div>
  )
}

export function PageHead({ title, sub, crumbs, actions, icon }: { title: string; sub?: ReactNode; crumbs?: ReactNode; actions?: ReactNode; icon?: string }) {
  return (
    <div className="row between wrap gap-4" style={{ marginBottom: 20 }}>
      <div className="row gap-3" style={{ alignItems: 'flex-start' }}>
        {icon && (
          <div style={{ width: 42, height: 42, borderRadius: 'var(--r-m)', background: 'var(--ac-dim)', border: '1px solid var(--ac-line)', display: 'grid', placeItems: 'center', color: 'var(--ac-bright)', flexShrink: 0 }}>
            <Icon n={icon} s={22} />
          </div>
        )}
        <div>
          {crumbs && <div className="eyebrow" style={{ marginBottom: 5 }}>{crumbs}</div>}
          <h1 style={{ fontSize: 25, letterSpacing: '-0.02em' }}>{title}</h1>
          {sub && <div className="t-2" style={{ fontSize: 13, marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      {actions && <div className="row gap-2 wrap">{actions}</div>}
    </div>
  )
}

export function Field({ label, children, style, full }: { label?: ReactNode; children?: ReactNode; style?: CSSProperties; full?: boolean }) {
  return (
    <label className="col gap-2" style={{ gridColumn: full ? '1/-1' : 'auto', ...style }}>
      {label && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>}
      {children}
    </label>
  )
}

export const inputStyle: CSSProperties = {
  background: 'var(--bg-3)', border: '1px solid var(--line)', borderRadius: 'var(--r-s)',
  padding: '9px 12px', color: 'var(--tx-0)', fontSize: 13.5, fontFamily: 'IBM Plex Sans', width: '100%', outline: 'none',
}
export function Input(p: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} style={{ ...inputStyle, ...(p.style || {}) }} />
}
/** DateInput — accepts/emits ISO `yyyy-mm-dd`, displays dd-mm-yyyy, opens native calendar. */
const isoToDmy = (iso: string) => {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[3]}-${m[2]}-${m[1]}` : ''
}
const dmyToIso = (dmy: string): string | null => {
  const s = (dmy || '').trim().replace(/[./]/g, '-')
  const m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2}|\d{4})$/)
  if (!m) return null
  let [, d, mo, y] = m
  if (y.length === 2) y = (Number(y) >= 70 ? '19' : '20') + y
  const dd = d.padStart(2, '0'); const mm = mo.padStart(2, '0')
  const dt = new Date(`${y}-${mm}-${dd}`)
  if (isNaN(dt.getTime())) return null
  return `${y}-${mm}-${dd}`
}
export function DateInput({ value, onChange, placeholder = 'dd-mm-yyyy', style, disabled }: {
  value?: string
  onChange?: (iso: string) => void
  placeholder?: string
  style?: CSSProperties
  disabled?: boolean
}) {
  const [text, setText] = useState(isoToDmy(value || ''))
  const hidden = useRef<HTMLInputElement>(null)
  useEffect(() => { setText(isoToDmy(value || '')) }, [value])

  const commit = (raw: string) => {
    if (!raw.trim()) { onChange?.(''); return }
    const iso = dmyToIso(raw)
    if (iso) onChange?.(iso)
    else setText(isoToDmy(value || ''))
  }
  const openPicker = () => {
    const el = hidden.current; if (!el) return
    // showPicker is supported on modern Chromium/Firefox; fall back to focus
    if (typeof (el as any).showPicker === 'function') (el as any).showPicker()
    else el.focus()
  }
  return (
    <div style={{ position: 'relative', ...style }}>
      <input
        type="text"
        value={text}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit((e.target as HTMLInputElement).value) } }}
        style={{ ...inputStyle, paddingRight: 34 }}
      />
      <button type="button" onClick={openPicker} disabled={disabled} title="Pick date"
        style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--tx-2)', padding: 4, display: 'flex', alignItems: 'center',
        }}>
        <Icon n="calendar" s={16} />
      </button>
      <input
        ref={hidden}
        type="date"
        value={value || ''}
        onChange={(e) => { onChange?.(e.target.value); setText(isoToDmy(e.target.value)) }}
        tabIndex={-1}
        aria-hidden
        style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
      />
    </div>
  )
}

export function Select({ children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div style={{ position: 'relative' }}>
      <select {...p} style={{ ...inputStyle, appearance: 'none', paddingRight: 32, cursor: 'pointer', ...(p.style || {}) }}>{children}</select>
      <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: 'var(--tx-2)' }}>
        <Icon n="chevd" s={15} />
      </span>
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ open, onClose, title, sub, children, width = 560, footer }: { open?: boolean; onClose?: () => void; title?: ReactNode; sub?: ReactNode; children?: ReactNode; width?: number; footer?: ReactNode }) {
  if (!open) return null
  return createPortal(
    <div onClick={onClose} className="mms-modal-overlay" style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'oklch(0 0 0 / 0.6)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 20, paddingLeft: 'calc(var(--sb-w) + 20px)', animation: 'fade .2s ease both' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(' + width + 'px,100%)', maxHeight: '90vh', overflow: 'auto', background: 'var(--bg-1)', border: '1px solid var(--line)', borderRadius: 'var(--r-l)', boxShadow: 'var(--sh-3)', animation: 'slideIn .25s var(--ease) both' }}>
        <div className="row between" style={{ padding: '18px 22px', borderBottom: '1px solid var(--line)', position: 'sticky', top: 0, background: 'var(--bg-1)', zIndex: 1 }}>
          <div>
            <h3 style={{ fontSize: 18 }}>{title}</h3>
            {sub && <div className="t-2" style={{ fontSize: 12.5, marginTop: 2 }}>{sub}</div>}
          </div>
          <Btn variant="plain" size="sm" icon="x" onClick={onClose} style={{ padding: 6 }} />
        </div>
        <div style={{ padding: 22 }}>{children}</div>
        {footer && <div className="row between gap-2" style={{ padding: '14px 22px', borderTop: '1px solid var(--line)', position: 'sticky', bottom: 0, background: 'var(--bg-1)' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/* ---------- Table ---------- */
export interface Col { label: ReactNode; align?: 'left' | 'right' | 'center'; w?: number | string }
export function Table<T = any>({ cols, rows, render, empty = 'No records', onRow }: { cols: Col[]; rows: T[]; render: (r: T, i: number) => ReactNode; empty?: string; onRow?: (r: T) => void }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {cols.map((c, i) => (
              <th key={i} style={{ textAlign: c.align || 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--bg-1)', width: c.w }}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} style={{ padding: '40px', textAlign: 'center', color: 'var(--tx-3)' }}>{empty}</td></tr>
          )}
          {rows.map((r, ri) => (
            <tr key={ri} className="mms-tr" onClick={onRow ? () => onRow(r) : undefined} style={{ cursor: onRow ? 'pointer' : 'default', transition: 'background .12s' }}>
              {render(r, ri)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
export function Td({ children, align, mono, c, style }: { children?: ReactNode; align?: 'left' | 'right' | 'center'; mono?: boolean; c?: string; style?: CSSProperties }) {
  return (
    <td style={{ padding: '11px 14px', textAlign: align || 'left', borderBottom: '1px solid var(--line-soft)', color: c || 'var(--tx-1)', fontFamily: mono ? 'JetBrains Mono' : 'inherit', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', whiteSpace: 'nowrap', ...style }}>
      {children}
    </td>
  )
}

export function statusTone(s: string): Tone {
  s = (s || '').toLowerCase()
  if (/(paid|approved|posted|completed|converted|in|ok|active)/.test(s)) return 'green'
  if (/(pending|partial|draft|open|low|risk)/.test(s)) return 'amber'
  if (/(unpaid|rejected|expired|out|overdue|inactive)/.test(s)) return 'red'
  return 'neutral'
}
