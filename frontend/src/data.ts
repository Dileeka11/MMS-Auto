/* ============================================================
   NMS-Auto — mock data layer (ported from prototype data.jsx)
   In production these arrays are replaced by API responses
   (see api.ts). Kept here so the UI runs standalone.
   ============================================================ */
import type {
  Item, Customer, Rep, PurchaseOrder, GRN, Quotation, Invoice,
  SalesReturn, Receipt, Expense, MonthlyPoint, Company,
} from './types'

export const money = (n: number) =>
  'Rs ' + Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })
export const moneyK = (n: number) => {
  if (Math.abs(n) >= 1e6) return 'Rs ' + (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return 'Rs ' + (n / 1e3).toFixed(1) + 'K'
  return 'Rs ' + n
}

export const brands = ['Toyota', 'Nissan', 'Honda', 'Suzuki', 'Mitsubishi', 'Mazda', 'Isuzu', 'Hyundai']
export const categories = ['Engine', 'Brakes', 'Suspension', 'Electrical', 'Filters', 'Body', 'Transmission', 'Cooling']
export const groups = ['Genuine', 'OEM', 'Aftermarket', 'Reconditioned']
export const branches = ['Main Store', 'City Branch', 'Highway Depot']
export const suppliers = ['Toyota Lanka PLC', 'United Motors', 'Diesel & Motor Eng.', 'AutoMart Imports', 'Global Parts Co', 'Nippon Trading']

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

// ---- Items (auto spare parts)
const itemNames: [string, string, string, string][] = [
  ['Brake Pad Set Front', 'Brakes', 'Toyota', 'BP-2201'],
  ['Brake Disc Rotor', 'Brakes', 'Nissan', 'BD-3310'],
  ['Oil Filter', 'Filters', 'Toyota', 'OF-1120'],
  ['Air Filter Element', 'Filters', 'Honda', 'AF-4420'],
  ['Spark Plug Iridium', 'Electrical', 'Suzuki', 'SP-7781'],
  ['Timing Belt Kit', 'Engine', 'Mitsubishi', 'TB-9920'],
  ['Shock Absorber Rear', 'Suspension', 'Toyota', 'SA-5540'],
  ['Clutch Plate Assembly', 'Transmission', 'Isuzu', 'CP-6610'],
  ['Radiator Assembly', 'Cooling', 'Nissan', 'RD-8830'],
  ['Alternator 12V', 'Electrical', 'Honda', 'AL-2245'],
  ['Wheel Bearing Kit', 'Suspension', 'Mazda', 'WB-3367'],
  ['Fuel Pump Assembly', 'Engine', 'Toyota', 'FP-1199'],
  ['Headlamp Assembly RH', 'Body', 'Suzuki', 'HL-7720'],
  ['Wiper Blade 22"', 'Body', 'Hyundai', 'WP-9981'],
  ['Engine Mount', 'Engine', 'Nissan', 'EM-4456'],
  ['CV Joint Boot Kit', 'Transmission', 'Toyota', 'CV-3322'],
  ['Battery 65Ah', 'Electrical', 'Mitsubishi', 'BT-5500'],
  ['Coolant Hose Upper', 'Cooling', 'Honda', 'CH-2278'],
  ['Tie Rod End', 'Suspension', 'Isuzu', 'TR-6643'],
  ['Cabin Air Filter', 'Filters', 'Mazda', 'CF-8814'],
  ['Drive Belt', 'Engine', 'Toyota', 'DB-1290'],
  ['Brake Master Cylinder', 'Brakes', 'Nissan', 'MC-7702'],
  ['Ignition Coil', 'Electrical', 'Suzuki', 'IC-3340'],
  ['Water Pump', 'Cooling', 'Honda', 'WP-5521'],
]

let id = 1000
export const items: Item[] = itemNames.map((it, i) => {
  const [name, cat, brand, code] = it
  const cost = Math.round((800 + Math.random() * 14000) / 10) * 10
  const margin = 1.18 + Math.random() * 0.35
  const fifoCost = Math.round(cost * (0.96 + Math.random() * 0.08))
  const reorder = 12
  // deliberately seed some low/out items for realistic alerts
  const force = i % 7 === 3 ? 0 : i % 5 === 2 ? Math.floor(Math.random() * 8) + 2 : null
  const stockByBranch =
    force != null
      ? [force, force > 0 ? Math.floor(force / 2) : 0, 0]
      : branches.map(() => 14 + Math.round(Math.random() * 55))
  const qty = stockByBranch.reduce((a, b) => a + b, 0)
  return {
    id: 'IT' + (++id), code, name, category: cat, brand,
    group: groups[i % groups.length],
    unit: ['Pcs', 'Set', 'Kit', 'Box'][i % 4],
    avgCost: cost, fifoCost,
    price: Math.round((cost * margin) / 10) * 10,
    qty, reorder, stockByBranch,
    rack: 'R' + (1 + (i % 8)) + '-' + ['A', 'B', 'C', 'D'][i % 4] + (1 + (i % 6)),
    status: qty === 0 ? 'out' : qty <= reorder ? 'low' : 'in',
  }
})

// ---- Customers
const custNames = ['Lanka Motors', 'Speedway Garage', 'AutoCare Center', 'Highway Spares', 'Galaxy Vehicles',
  'Prime Auto Works', 'Metro Service Hub', 'Royal Motors', 'Apex Garage', 'Silverline Autos',
  'City Wheels', 'Turbo Tech Center']
export const customers: Customer[] = custNames.map((n, i) => {
  const limit = [200000, 500000, 150000, 300000, 750000][i % 5]
  const out = Math.round(Math.random() * limit * 0.8)
  return {
    id: 'C' + (2200 + i), name: n, contact: '07' + (10000000 + Math.floor(Math.random() * 8999999)),
    city: ['Colombo', 'Kandy', 'Galle', 'Negombo', 'Jaffna'][i % 5],
    credit: [7, 15, 30, 45][i % 4], limit, outstanding: out,
    rep: ['R. Fernando', 'S. Perera', 'M. Iqbal', 'D. Silva'][i % 4],
    status: out > limit * 0.7 ? 'risk' : 'ok',
  }
})

// ---- Sales reps (mobile app users)
export const reps: Rep[] = [
  { id: 'REP-01', name: 'R. Fernando', zone: 'Colombo West', target: 1200000, achieved: 945000, visits: 38, invoices: 62, avatar: 'RF' },
  { id: 'REP-02', name: 'S. Perera', zone: 'Kandy Central', target: 900000, achieved: 1020000, visits: 41, invoices: 55, avatar: 'SP' },
  { id: 'REP-03', name: 'M. Iqbal', zone: 'Galle South', target: 800000, achieved: 610000, visits: 29, invoices: 44, avatar: 'MI' },
  { id: 'REP-04', name: 'D. Silva', zone: 'Negombo North', target: 750000, achieved: 702000, visits: 33, invoices: 48, avatar: 'DS' },
]

// ---- Documents
const today = new Date('2026-06-09')
const fmtD = (d: Date) => d.toISOString().slice(0, 10)
const dayOff = (n: number) => fmtD(new Date(today.getTime() - n * 86400000))
const pickItem = () => items[Math.floor(Math.random() * items.length)]

export const purchaseOrders: PurchaseOrder[] = Array.from({ length: 8 }).map((_, i) => {
  const lines = Array.from({ length: 2 + Math.floor(Math.random() * 4) }).map(() => {
    const it = pickItem(); const q = 5 + Math.floor(Math.random() * 40)
    return { item: it.name, code: it.code, qty: q, cost: it.avgCost, total: q * it.avgCost }
  })
  const total = lines.reduce((a, l) => a + l.total, 0)
  const st = ['Pending', 'Approved', 'Partial GRN', 'Completed'][i % 4]
  return { id: 'PO-' + (4400 + i), supplier: suppliers[i % suppliers.length], date: dayOff(i * 2), lines, total, status: st }
})

export const grns: GRN[] = Array.from({ length: 6 }).map((_, i) => ({
  id: 'GRN-' + (7700 + i), po: 'PO-' + (4400 + i), supplier: suppliers[i % suppliers.length],
  date: dayOff(i * 2 - 1 < 0 ? 0 : i * 2 - 1), items: 2 + Math.floor(Math.random() * 4),
  total: Math.round(rnd(80000, 420000)), status: ['Posted', 'Posted', 'Draft'][i % 3],
}))

export const quotations: Quotation[] = Array.from({ length: 10 }).map((_, i) => {
  const c = customers[i % customers.length]
  const total = Math.round(rnd(25000, 380000))
  return {
    id: 'QT-' + (9100 + i), customer: c.name, rep: c.rep, date: dayOff(i),
    total, items: 1 + Math.floor(Math.random() * 6),
    status: ['Open', 'Converted', 'Open', 'Expired'][i % 4], cost: ['FIFO', 'Average'][i % 2],
  }
})

export const invoices: Invoice[] = Array.from({ length: 12 }).map((_, i) => {
  const c = customers[i % customers.length]
  const total = Math.round(rnd(18000, 420000))
  const paid = [total, total, Math.round(total * 0.5), 0][i % 4]
  return {
    id: 'INV-' + (5500 + i), customer: c.name, rep: c.rep, date: dayOff(i),
    total, paid, due: total - paid, items: 1 + Math.floor(Math.random() * 7),
    cost: ['FIFO', 'Average'][i % 2],
    status: paid >= total ? 'Paid' : paid > 0 ? 'Partial' : 'Unpaid',
  }
})

export const returns: SalesReturn[] = Array.from({ length: 5 }).map((_, i) => {
  const inv = invoices[i]
  return {
    id: 'SR-' + (3300 + i), invoice: inv.id, customer: inv.customer, rep: inv.rep,
    date: dayOff(i), amount: Math.round(inv.total * rnd(0.1, 0.4)), items: 1 + Math.floor(Math.random() * 3),
    reason: ['Wrong part', 'Defective', 'Excess order', 'Damaged in transit'][i % 4],
    status: ['Pending Approval', 'Pending Approval', 'Approved', 'Rejected'][i % 4],
    raisedBy: ['R. Fernando', 'S. Perera', 'M. Iqbal'][i % 3],
  }
})

export const receipts: Receipt[] = Array.from({ length: 7 }).map((_, i) => ({
  id: 'RCP-' + (6600 + i), customer: customers[i % customers.length].name,
  date: dayOff(i), amount: Math.round(rnd(15000, 250000)),
  mode: ['Cash', 'Cheque', 'Bank Transfer', 'Card'][i % 4],
  against: i % 3 === 0 ? 'On Account' : 'INV-' + (5500 + i),
}))

export const expenses: Expense[] = Array.from({ length: 6 }).map((_, i) => ({
  id: 'EXP-' + (2100 + i), type: ['Fuel', 'Salary', 'Rent', 'Utilities', 'Transport', 'Misc'][i % 6],
  date: dayOff(i * 2), amount: Math.round(rnd(5000, 120000)),
  branch: branches[i % 3], note: '',
}))

// ---- chart series
export const monthlySales: MonthlyPoint[] = [
  { m: 'Jan', sales: 3.2, purchase: 2.4, profit: 0.8 },
  { m: 'Feb', sales: 3.8, purchase: 2.7, profit: 1.1 },
  { m: 'Mar', sales: 3.1, purchase: 2.6, profit: 0.5 },
  { m: 'Apr', sales: 4.4, purchase: 3.0, profit: 1.4 },
  { m: 'May', sales: 5.1, purchase: 3.4, profit: 1.7 },
  { m: 'Jun', sales: 4.7, purchase: 3.1, profit: 1.6 },
  { m: 'Jul', sales: 5.6, purchase: 3.7, profit: 1.9 },
  { m: 'Aug', sales: 6.0, purchase: 4.0, profit: 2.0 },
  { m: 'Sep', sales: 5.4, purchase: 3.6, profit: 1.8 },
  { m: 'Oct', sales: 6.4, purchase: 4.1, profit: 2.3 },
  { m: 'Nov', sales: 7.0, purchase: 4.5, profit: 2.5 },
  { m: 'Dec', sales: 7.8, purchase: 5.0, profit: 2.8 },
]
export const categoryShare = categories.map((c) => ({ label: c, value: Math.round(rnd(6, 22)) }))
export const dailyTrend = Array.from({ length: 30 }).map(() => Math.round(rnd(120, 420)))

export const company: Company = {
  name: 'NMS-Auto', tagline: 'Spare Parts Distribution', address: 'No. 142, Galle Road, Colombo 03',
  phone: '+94 11 234 5678', email: 'sales@mms-auto.lk',
}

export const DB = {
  money, moneyK, brands, categories, groups, branches, suppliers,
  items, customers, reps,
  purchaseOrders, grns, quotations, invoices, returns, receipts, expenses,
  monthlySales, categoryShare, dailyTrend, company,
}
export default DB
