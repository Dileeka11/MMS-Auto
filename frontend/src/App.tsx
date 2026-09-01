/* NMS-Auto — app router + screen registry (replaces window.SCREENS) */
import { lazy, Suspense, useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Sidebar, Topbar } from './components/Shell'
import DB from './data'
import type { Go, ScreenProps } from './screens/types'
import Login from './screens/Login'
import { auth, company as companyApi, type AuthUser } from './api'
import { canAccessRoute } from './lib/permissions'

// MASTERS is config (route keys are needed synchronously to register routes),
// so its module stays eager. Every other screen is code-split via lazy() below —
// each becomes its own chunk that only downloads when the user first opens it.
import { DataModule, MASTERS } from './screens/Masters'

const DashScreen = lazy(() => import('./screens/Dashboard'))
const ReportsScreen = lazy(() => import('./screens/Reports'))
const named = <M, K extends keyof M>(loader: () => Promise<M>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] as unknown as ComponentType<any> })))

const ItemMasterScreen = named(() => import('./screens/ItemMaster'), 'ItemMasterScreen')
const CustomerMasterScreen = named(() => import('./screens/ItemMaster'), 'CustomerMasterScreen')
const SupplierMasterScreen = named(() => import('./screens/SupplierMaster'), 'SupplierMasterScreen')
const POScreen = named(() => import('./screens/Procurement'), 'POScreen')
const GRNScreen = named(() => import('./screens/Procurement'), 'GRNScreen')
const CostingScreen = named(() => import('./screens/Procurement'), 'CostingScreen')
const TrackingScreen = named(() => import('./screens/Procurement'), 'TrackingScreen')
const QuoteScreen = named(() => import('./screens/Sales'), 'QuoteScreen')
const InvoiceScreen = named(() => import('./screens/Sales'), 'InvoiceScreen')
const DispatchScreen = named(() => import('./screens/Dispatch'), 'DispatchScreen')
const SettlementScreen = named(() => import('./screens/Dispatch'), 'SettlementScreen')
const ReturnScreen = named(() => import('./screens/Sales2'), 'ReturnScreen')
const ReceiptScreen = named(() => import('./screens/Sales2'), 'ReceiptScreen')
const ExpenseScreen = named(() => import('./screens/Sales2'), 'ExpenseScreen')
const LiveStockScreen = named(() => import('./screens/Stores'), 'LiveStockScreen')
const TransferScreen = named(() => import('./screens/Stores'), 'TransferScreen')
const AdjustScreen = named(() => import('./screens/Stores'), 'AdjustScreen')
const BinCardScreen = named(() => import('./screens/Stores'), 'BinCardScreen')
const PriceScreen = named(() => import('./screens/Stores'), 'PriceScreen')
const UsersScreen = named(() => import('./screens/Admin'), 'UsersScreen')
const PermScreen = named(() => import('./screens/Admin'), 'PermScreen')
const CompanyScreen = named(() => import('./screens/Admin'), 'CompanyScreen')
const RepsScreen = named(() => import('./screens/Admin'), 'RepsScreen')

type ScreenComp = ComponentType<ScreenProps & { setBrand?: (v: string) => void; setLogoUrl?: (v: string) => void }>

// Shown only for the split-second a screen chunk is downloading on first visit.
function ScreenLoader() {
  return (
    <div className="row center" style={{ padding: 80, color: 'var(--tx-3)', gap: 10 }}>
      <span className="mms-spin" style={{ width: 18, height: 18, border: '2px solid var(--line)', borderTopColor: 'var(--ac)', borderRadius: '50%', display: 'inline-block' }} />
      <span style={{ fontSize: 13 }}>Loading…</span>
    </div>
  )
}

const SCREENS: Record<string, ScreenComp> = {
  dash: DashScreen,
  'm/item': ItemMasterScreen,
  'm/customer': CustomerMasterScreen,
  'm/supplier': SupplierMasterScreen,
  'dc/po': POScreen,
  'dc/costing': CostingScreen,
  'dc/grn': GRNScreen,
  'dc/tracking': TrackingScreen,
  'dc/quote': QuoteScreen,
  'dc/dispatch': DispatchScreen,
  'dc/invoice': InvoiceScreen,
  'dc/settlement': SettlementScreen,
  'dc/return': ReturnScreen,
  'dc/receipt': ReceiptScreen,
  'dc/expense': ExpenseScreen,
  'st/transfer': TransferScreen,
  'st/adjust': AdjustScreen,
  'st/bin': BinCardScreen,
  'st/live': LiveStockScreen,
  'st/price': PriceScreen,
  reports: ReportsScreen,
  'ad/reps': RepsScreen,
  'ad/users': UsersScreen,
  'ad/perm': PermScreen,
  'ad/company': CompanyScreen,
}
// register the config-driven master files
Object.keys(MASTERS).forEach((k) => {
  SCREENS['m/' + k] = (({ go }: ScreenProps) => <DataModule cfg={MASTERS[k]} go={go} type={k} />) as ScreenComp
})

export default function App() {
  const [route, setRoute] = useState<string>(() => localStorage.getItem('mms-route') || 'dash')
  const [open, setOpen] = useState(false)
  const [brand, setBrand] = useState(DB.company.name)
  const [logoUrl, setLogoUrl] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const go: Go = (r) => { setRoute(r); localStorage.setItem('mms-route', r); window.scrollTo(0, 0) }
  useEffect(() => { document.title = brand + ' — Admin Panel' }, [brand])

  useEffect(() => {
    const token = auth.getToken()
    if (!token) { setAuthReady(true); return }
    auth.me()
      .then((u) => {
        setUser(u)
        companyApi.get().then((d: any) => {
          if (d?.name) setBrand(d.name)
          if (d?.logoUrl) setLogoUrl(d.logoUrl)
          localStorage.setItem('mms-company', JSON.stringify({ name: d?.name, logoUrl: d?.logoUrl }))
        }).catch(() => {})
      })
      .catch(() => auth.setToken(null))
      .finally(() => setAuthReady(true))
  }, [])

  if (!authReady) return null
  if (!user) return <Login onAuth={setUser} />

  // Permission gate: silently downgrade to dashboard if user lacks access to the
  // saved route (e.g. after a permission change). The Sidebar already hides the
  // entries they can't reach, but the route may be persisted in localStorage.
  const effectiveRoute = canAccessRoute(user, route) ? route : 'dash'
  const Screen = SCREENS[effectiveRoute] || (() => <div style={{ padding: 40 }} className="t-2">Screen not found</div>)
  const denied = !canAccessRoute(user, route)
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar route={effectiveRoute} go={go} open={open} setOpen={setOpen} company={brand} logoUrl={logoUrl} user={user} />
      <div className="mms-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar setOpen={setOpen} route={effectiveRoute} go={go} />
        <main key={effectiveRoute} className="fade-in" style={{ padding: '24px clamp(16px,3vw,32px) 60px', flex: 1 }}>
          {denied
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--bad)' }}>You do not have permission to view this screen.</div>
            : <Suspense fallback={<ScreenLoader />}><Screen go={go} setBrand={setBrand} setLogoUrl={setLogoUrl} user={user} /></Suspense>}
        </main>
      </div>
    </div>
  )
}
