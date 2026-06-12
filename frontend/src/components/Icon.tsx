/* MMS-Auto — icon set (stroke line icons), ported from ui.jsx */
import type { CSSProperties, ReactNode } from 'react'

interface IconProps {
  n: string
  s?: number
  c?: string
  sw?: number
  style?: CSSProperties
}

export function Icon({ n, s = 18, c = 'currentColor', sw = 1.75, style }: IconProps) {
  const P = {
    width: s, height: s, viewBox: '0 0 24 24', fill: 'none', stroke: c,
    strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, style,
  }
  const paths: Record<string, ReactNode> = {
    dash: <><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></>,
    folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
    box: <><path d="M21 8 12 3 3 8v8l9 5 9-5z" /><path d="m3 8 9 5 9-5M12 13v8" /></>,
    cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="18" cy="20" r="1.4" /><path d="M2 3h2.2l2.2 12.4a1.6 1.6 0 0 0 1.6 1.3h8.7a1.6 1.6 0 0 0 1.6-1.2L21 7H5.2" /></>,
    truck: <><path d="M3 6a1 1 0 0 1 1-1h10v10H3z" /><path d="M14 8h4l3 3v3h-7z" /><circle cx="7.5" cy="17" r="1.6" /><circle cx="17.5" cy="17" r="1.6" /></>,
    doc: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v4h4M9 13h6M9 17h6M9 9h2" /></>,
    receipt: <><path d="M5 3h14v18l-3-1.5L13 21l-3-1.5L7 21l-2-1.5z" /><path d="M9 8h6M9 12h6" /></>,
    refund: <><path d="M3 7v6h6" /><path d="M3.5 13a9 9 0 1 0 2.3-9.3L3 7" /></>,
    wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 10h18M16 14.5h2" /></>,
    coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M9 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /></>,
    store: <><path d="M4 9h16v11H4z" /><path d="M3 4h18l-1 5H4z" /><path d="M9 20v-5h6v5" /></>,
    swap: <><path d="M7 4 3 8l4 4" /><path d="M3 8h12M17 20l4-4-4-4" /><path d="M21 16H9" /></>,
    adjust: <><circle cx="7" cy="8" r="2.4" /><circle cx="17" cy="16" r="2.4" /><path d="M9.5 8H21M3 16h11.5" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5z" /><path d="m3 13 9 5 9-5" /></>,
    tag: <><path d="M3 12V4a1 1 0 0 1 1-1h8l8 8-9 9z" /><circle cx="8" cy="8" r="1.3" /></>,
    chart: <><path d="M3 3v18h18" /><path d="m7 14 3-4 3 3 5-7" /></>,
    pie: <><path d="M12 3a9 9 0 1 0 9 9h-9z" /><path d="M12 3v9h9A9 9 0 0 0 12 3z" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0" /><path d="M16 5.5a3 3 0 0 1 0 5.5M21 20a6 6 0 0 0-4-5.6" /></>,
    shield: <><path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></>,
    building: <><path d="M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17" /><path d="M15 9h3a1 1 0 0 1 1 1v11M3 21h18M8 7h2M8 11h2M8 15h2" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.5 21a2 2 0 0 0 3 0" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    chev: <path d="m9 6 6 6-6 6" />,
    chevd: <path d="m6 9 6 6 6-6" />,
    x: <path d="M6 6 18 18M18 6 6 18" />,
    check: <path d="m5 12 5 5L20 6" />,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 21h16" /></>,
    excel: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></>,
    filter: <path d="M3 5h18l-7 8v5l-4 2v-7z" />,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M14 6l4 4" /></>,
    trash: <><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.6" /></>,
    print: <><path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-2" /><path d="M6 14h12v7H6z" /></>,
    cog: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V19a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 6.6 17.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 2.7 11.8H2.6a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 6.6l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9.4a1.6 1.6 0 0 0 1-1.5V2.6a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V8.6a1.6 1.6 0 0 0 1.5 1H22a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></>,
    logout: <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></>,
    bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
    pkg: <><path d="M16 3.1 7.5 7.5 3 5.3 12 1z" /><path d="M3 5.3v8.4l9 4.3 9-4.3V5.3M12 9.6v8.4M3 5.3l9 4.3 9-4.3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    arrowUp: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
    arrowDown: <path d="M12 5v14m0 0 6-6m-6 6-6-6" />,
    pin: <><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z" /><circle cx="12" cy="10" r="2.4" /></>,
    target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" /></>,
    menu: <path d="M3 6h18M3 12h18M3 18h18" />,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" /><rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" /></>,
    phone: <><rect x="6" y="2" width="12" height="20" rx="2.5" /><path d="M10 18h4" /></>,
    home: <><path d="M3 11 12 3l9 8" /><path d="M5 10v10h14V10" /></>,
    list: <><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="3.5" cy="6" r="1" /><circle cx="3.5" cy="12" r="1" /><circle cx="3.5" cy="18" r="1" /></>,
    upload: <><path d="M12 21V9m0 0 4 4m-4-4-4 4" /><path d="M4 3h16" /></>,
    car: <><path d="M5 13l1.5-4.5A2 2 0 0 1 8.4 7h7.2a2 2 0 0 1 1.9 1.5L19 13" /><path d="M3 17v-2a2 2 0 0 1 1.2-1.8L5 13h14l.8.2A2 2 0 0 1 21 15v2a1 1 0 0 1-1 1h-1v1a1 1 0 0 1-2 0v-1H7v1a1 1 0 0 1-2 0v-1H4a1 1 0 0 1-1-1z" /><circle cx="7.5" cy="15.5" r="1" /><circle cx="16.5" cy="15.5" r="1" /></>,
    wrench: <path d="M14.5 5.5a4 4 0 0 0 5 5L21 9l-2-2 1-3-3 1-2-2-1.5 1.5a4 4 0 0 0-1 1.5zM12.5 9.5 4 18a2 2 0 1 0 2 2l8.5-8.5" />,
  }
  return <svg {...P}>{paths[n] || paths.box}</svg>
}

export default Icon
