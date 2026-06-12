// Shared domain types for MMS-Auto

export type Stock = 'in' | 'low' | 'out'

export interface Item {
  id: string
  code: string
  name: string
  category: string
  brand: string
  group: string
  unit: string
  avgCost: number
  fifoCost: number
  price: number
  qty: number
  reorder: number
  stockByBranch: number[]
  rack: string
  status: Stock
}

export interface Customer {
  id: string
  name: string
  contact: string
  city: string
  credit: number
  limit: number
  outstanding: number
  rep: string
  status: 'ok' | 'risk'
}

export interface Rep {
  id: string
  name: string
  zone: string
  target: number
  achieved: number
  visits: number
  invoices: number
  avatar: string
}

export interface POLine { item: string; code: string; qty: number; cost: number; total: number }
export interface PurchaseOrder {
  id: string; supplier: string; date: string; lines: POLine[]; total: number; status: string
}
export interface GRN {
  id: string; po: string; supplier: string; date: string; items: number; total: number; status: string
}
export interface Quotation {
  id: string; customer: string; rep: string; date: string; total: number; items: number; status: string; cost: string
}
export interface Invoice {
  id: string; customer: string; rep: string; date: string; total: number; paid: number; due: number; items: number; cost: string; status: string
}
export interface SalesReturn {
  id: string; invoice: string; customer: string; rep: string; date: string; amount: number; items: number; reason: string; status: string; raisedBy: string
}
export interface Receipt {
  id: string; customer: string; date: string; amount: number; mode: string; against: string
}
export interface Expense {
  id: string; type: string; date: string; amount: number; branch: string; note: string
}

export interface MonthlyPoint { m: string; sales: number; purchase: number; profit: number }
export interface Company {
  name: string; tagline: string; address: string; phone: string; email: string
}

// line used by the editable line-item table (PO / Quote / Invoice / Transfer)
export interface EditorLine {
  id: string
  code: string
  name: string
  qty: number
  rate: number
  cost: number
  fifo: number
  avg: number
  method: 'FIFO' | 'Average'
  max?: number
}
