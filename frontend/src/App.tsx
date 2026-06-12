/* MMS-Auto — app router + screen registry (replaces window.SCREENS) */
import { useEffect, useState } from 'react'
import type { ComponentType } from 'react'
import { Sidebar, Topbar } from './components/Shell'
import DB from './data'
import type { Go, ScreenProps } from './screens/types'

import DashScreen from './screens/Dashboard'
import { DataModule, MASTERS } from './screens/Masters'
import { ItemMasterScreen, CustomerMasterScreen } from './screens/ItemMaster'
import { POScreen, GRNScreen } from './screens/Procurement'
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
  'dc/po': POScreen,
  'dc/grn': GRNScreen,
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
  SCREENS['m/' + k] = (({ go }: ScreenProps) => <DataModule cfg={MASTERS[k]} go={go} />) as ScreenComp
})

export default function App() {
  const [route, setRoute] = useState<string>(() => localStorage.getItem('mms-route') || 'dash')
  const [open, setOpen] = useState(false)
  const [brand, setBrand] = useState(DB.company.name)
  const go: Go = (r) => { setRoute(r); localStorage.setItem('mms-route', r); window.scrollTo(0, 0) }
  useEffect(() => { document.title = brand + ' — Admin Panel' }, [brand])

  const Screen = SCREENS[route] || (() => <div style={{ padding: 40 }} className="t-2">Screen not found</div>)
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar route={route} go={go} open={open} setOpen={setOpen} company={brand} />
      <div className="mms-main" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <Topbar setOpen={setOpen} route={route} go={go} />
        <main key={route} className="fade-in" style={{ padding: '24px clamp(16px,3vw,32px) 60px', flex: 1 }}>
          <Screen go={go} setBrand={setBrand} />
        </main>
      </div>
    </div>
  )
}
