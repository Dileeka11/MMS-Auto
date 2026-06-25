/* NMS-Auto — app router + screen registry (replaces window.SCREENS) */
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Sidebar, Topbar } from './components/Shell'
import DB from './data'
import type { Go, ScreenProps } from './screens/types'
import Login from './screens/Login'
import { auth, type AuthUser } from './api'
import { canAccessRoute } from './lib/permissions'

import DashScreen from './screens/Dashboard'
import { DataModule, MASTERS } from './screens/Masters'
import { ItemMasterScreen, CustomerMasterScreen } from './screens/ItemMaster'
import { SupplierMasterScreen } from './screens/SupplierMaster'
import { POScreen, GRNScreen, CostingScreen, TrackingScreen } from './screens/Procurement'
import { QuoteScreen, InvoiceScreen } from './screens/Sales'
import { ReturnScreen, ReceiptScreen, ExpenseScreen } from './screens/Sales2'
import { LiveStockScreen, TransferScreen, AdjustScreen, BinCardScreen, PriceScreen } from './screens/Stores'
import ReportsScreen from './screens/Reports'
import { UsersScreen, PermScreen, CompanyScreen, RepsScreen } from './screens/Admin'

type ScreenComp = ComponentType<ScreenProps & { setBrand?: (v: string) => void }>

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
  'dc/invoice': InvoiceScreen,
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
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const go: Go = (r) => { setRoute(r); localStorage.setItem('mms-route', r); window.scrollTo(0, 0) }
  useEffect(() => { document.title = brand + ' — Admin Panel' }, [brand])

  useEffect(() => {
    const token = auth.getToken()
    if (!token) { setAuthReady(true); return }
    auth.me()
      .then((u) => setUser(u))
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
      <Sidebar route={effectiveRoute} go={go} open={open} setOpen={setOpen} company={brand} user={user} />
      <div className="mms-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar setOpen={setOpen} route={effectiveRoute} go={go} />
        <main key={effectiveRoute} className="fade-in" style={{ padding: '24px clamp(16px,3vw,32px) 60px', flex: 1 }}>
          {denied
            ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--bad)' }}>You do not have permission to view this screen.</div>
            : <Screen go={go} setBrand={setBrand} user={user} />}
        </main>
      </div>
    </div>
  )
}
