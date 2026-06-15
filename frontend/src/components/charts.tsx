/* NMS-Auto — animated SVG charts, ported from charts.jsx */
import { useEffect, useRef, useState, useMemo } from 'react'

interface Series { data: number[]; color: string }

/* Area + line chart with animated draw-on */
export function AreaChart({ series, height = 220, labels, format = (v: number) => String(v) }: { series: Series[]; height?: number; labels?: string[]; format?: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const pad = { l: 46, r: 14, t: 14, b: 26 }
  const all = series.flatMap((s) => s.data)
  const max = Math.max(...all) * 1.15, min = 0
  const W = w, H = height
  const X = (i: number, n: number) => pad.l + (i / (n - 1)) * (W - pad.l - pad.r)
  const Y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b)
  const n = series[0].data.length
  const line = (d: number[]) => d.map((v, i) => `${i ? 'L' : 'M'}${X(i, n).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')
  const area = (d: number[]) => line(d) + ` L${X(n - 1, n).toFixed(1)} ${Y(0)} L${X(0, n).toFixed(1)} ${Y(0)} Z`
  const ticks = 4
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={W} height={H} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={i} id={'ag' + i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.32" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = max * (1 - i / ticks); const y = Y(v)
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--line-soft)" strokeWidth="1" strokeDasharray="2 4" />
              <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--tx-3)" fontFamily="JetBrains Mono">{format(v)}</text>
            </g>
          )
        })}
        {labels && labels.map((l, i) => (
          <text key={i} x={X(i, n)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--tx-3)" fontFamily="JetBrains Mono">{l}</text>
        ))}
        {series.map((s, i) => (
          <g key={i}>
            <path d={area(s.data)} fill={'url(#ag' + i + ')'} style={{ opacity: 0, animation: `fade .6s ease ${0.3 + i * 0.15}s forwards` }} />
            <path d={line(s.data)} fill="none" stroke={s.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: `draw 1.1s var(--ease) ${i * 0.15}s forwards` }} />
            {s.data.map((v, j) => (
              <circle key={j} cx={X(j, n)} cy={Y(v)} r="2.6" fill="var(--bg-1)" stroke={s.color} strokeWidth="2" style={{ opacity: 0, animation: `fade .3s ease ${0.8 + j * 0.03}s forwards` }} />
            ))}
          </g>
        ))}
      </svg>
    </div>
  )
}

/* Grouped/stacked bar chart */
export function BarChart({ data, keys, colors, height = 220, format = (v: number) => String(v) }: { data: any[]; keys: string[]; colors: string[]; height?: number; format?: (v: number) => string }) {
  const ref = useRef<HTMLDivElement>(null); const [w, setW] = useState(640)
  useEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth)); ro.observe(el); setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  const pad = { l: 46, r: 10, t: 14, b: 26 }; const W = w, H = height
  const max = Math.max(...data.flatMap((d) => keys.map((k) => d[k]))) * 1.15
  const Y = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const gw = (W - pad.l - pad.r) / data.length; const bw = Math.min(14, (gw * 0.6) / keys.length)
  return (
    <div ref={ref} style={{ width: '100%' }}>
      <svg width={W} height={H} style={{ display: 'block' }}>
        {Array.from({ length: 5 }).map((_, i) => {
          const v = max * (1 - i / 4); const y = Y(v)
          return (
            <g key={i}>
              <line x1={pad.l} y1={y} x2={W - pad.r} y2={y} stroke="var(--line-soft)" strokeDasharray="2 4" />
              <text x={pad.l - 8} y={y + 3.5} textAnchor="end" fontSize="10.5" fill="var(--tx-3)" fontFamily="JetBrains Mono">{format(v)}</text>
            </g>
          )
        })}
        {data.map((d, i) => {
          const gx = pad.l + i * gw + gw / 2
          return (
            <g key={i}>
              {keys.map((k, j) => {
                const v = d[k]; const x = gx - (keys.length * bw) / 2 + j * bw; const y = Y(v); const h = H - pad.b - y
                return <rect key={j} x={x} y={y} width={bw - 2} height={Math.max(0, h)} rx="2" fill={colors[j]} style={{ transformOrigin: `${x}px ${H - pad.b}px`, animation: `growBar .7s var(--ease) ${i * 0.04 + j * 0.05}s both` }} />
              })}
              <text x={gx} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--tx-3)" fontFamily="JetBrains Mono">{d.label}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

/* Donut */
export function Donut({ data, size = 180, thickness = 22, center }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: string | number }) {
  const total = data.reduce((a, d) => a + d.value, 0)
  const R = size / 2, r = R - thickness / 2; const C = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="row gap-5" style={{ alignItems: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={R} cy={R} r={r} fill="none" stroke="var(--bg-3)" strokeWidth={thickness} />
        {data.map((d, i) => {
          const frac = d.value / total; const len = frac * C; const off = acc * C; acc += frac
          return <circle key={i} cx={R} cy={R} r={r} fill="none" stroke={d.color} strokeWidth={thickness} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-off} style={{ opacity: 0, animation: `fade .5s ease ${i * 0.08}s forwards` }} strokeLinecap="butt" />
        })}
        {center !== undefined && (
          <g style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
            <text x={R} y={R - 2} textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--tx-0)" fontFamily="Saira">{center}</text>
          </g>
        )}
      </svg>
      <div className="col gap-2">
        {data.map((d, i) => (
          <div key={i} className="row gap-2" style={{ fontSize: 12.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color }} />
            <span className="t-1" style={{ minWidth: 78 }}>{d.label}</span>
            <span className="mono t-2">{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* Sparkline */
export function Spark({ data, color = 'var(--ac)', w = 120, h = 34, fill = true }: { data: number[]; color?: string; w?: number; h?: number; fill?: boolean }) {
  const max = Math.max(...data), min = Math.min(...data)
  const X = (i: number) => (i / (data.length - 1)) * w
  const Y = (v: number) => h - 2 - ((v - min) / ((max - min) || 1)) * (h - 4)
  const d = data.map((v, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(' ')
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      {fill && <path d={d + ` L${w} ${h} L0 ${h} Z`} fill={color} opacity="0.12" />}
      <path d={d} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" pathLength={1} style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'draw 1s var(--ease) forwards' }} />
    </svg>
  )
}

/* Horizontal progress / ranking bar */
export function ProgressRow({ label, value, max, color = 'var(--ac)', right }: { label: string; value: number; max: number; color?: string; right?: string }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="col gap-2" style={{ marginBottom: 13 }}>
      <div className="row between" style={{ fontSize: 12.5 }}><span className="t-1">{label}</span><span className="mono t-2">{right}</span></div>
      <div style={{ height: 7, background: 'var(--bg-3)', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: color, borderRadius: 6, transformOrigin: 'left', animation: 'growW 1s var(--ease) both' }} />
      </div>
    </div>
  )
}

/* Radial gauge (target achievement) */
export function Gauge({ pct, size = 120, color = 'var(--ac)', label }: { pct: number; size?: number; color?: string; label?: string }) {
  const R = size / 2, r = R - 10, C = 2 * Math.PI * r * 0.75
  const off = C * (1 - Math.min(1, pct / 100))
  return (
    <div className="col center" style={{ position: 'relative' }}>
      <svg width={size} height={size * 0.78} viewBox={`0 0 ${size} ${size * 0.86}`} style={{ transform: 'rotate(135deg)' }}>
        <circle cx={R} cy={R} r={r} fill="none" stroke="var(--bg-3)" strokeWidth="9" strokeDasharray={`${C} ${2 * Math.PI * r}`} strokeLinecap="round" />
        <circle cx={R} cy={R} r={r} fill="none" stroke={color} strokeWidth="9" strokeDasharray={`${C} ${2 * Math.PI * r}`} strokeDashoffset={off} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.2s var(--ease)' }} />
      </svg>
      <div style={{ position: 'absolute', top: '42%', transform: 'translateY(-50%)', textAlign: 'center' }}>
        <div className="num" style={{ fontSize: 24, fontWeight: 700, fontFamily: 'Saira' }}>{pct}%</div>
        {label && <div className="t-2" style={{ fontSize: 10.5 }}>{label}</div>}
      </div>
    </div>
  )
}

export { useMemo }
