// Shared domain types for NMS-Auto

export type Stock = 'in' | 'low' | 'out'

export interface Item {
  id: string
  code: string
  hsCode?: string
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

export interface Supplier {
  id: number | string
  code?: string
  name: string
  contact?: string
  email?: string
  city?: string
  country?: string
  taxNo?: string
  paymentTerms?: string
  currency?: string
  address?: string
  notes?: string
  status?: string
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

export interface POLine {
  id?: number; item: string; code: string; hsCode?: string; qty: number; cost: number; total: number;
  balanceQty?: number; receivedQty?: number;
}
export interface PurchaseOrder {
  id: string; code?: string; supplier: string; supplierContact?: string;
  date: string; lines: POLine[]; total: number; status: string;
  piNumber?: string; piDate?: string; orderRequiredMonth?: string; paymentTerms?: string; incoTerms?: string;
  currency?: string; notes?: string; shipments?: Shipment[];
  approver1Id?: number | null; approver1At?: string | null; approver1?: { id: number; name: string } | null;
  approver2Id?: number | null; approver2At?: string | null; approver2?: { id: number; name: string } | null;
  rejectedById?: number | null; rejectedAt?: string | null; rejectReason?: string | null;
  rejectedBy?: { id: number; name: string } | null;
  approvalsCount?: number; approvalsRequired?: number;
}
export interface ShipmentLine {
  id?: number; code: string; hsCode?: string; item: string; qty: number; cost: number;
  total: number; landedCost?: number; landedTotal?: number; shipmentLineId?: number;
  purchaseOrderLineId?: number;
  fobLkr?: number; freightLkr?: number; insuranceLkr?: number;
  cid?: number; pal?: number; cess?: number; vat?: number; sscl?: number; duty?: number;
  other1?: number; other2?: number; other3?: number;
  bankingAlloc?: number; clearanceAlloc?: number; slpaAlloc?: number; demurrageAlloc?: number;
  totalPriceWoVat?: number; totalPriceWithVat?: number;
  unitCostWoVat?: number; unitCostWithVat?: number;
  sellingPriceWoVat?: number; sellingPriceWithVat?: number;
}
export interface ShipmentExtra { id?: number; label: string; amount: number }
export interface ComplexChargeShape {
  amountUsd?: number; amountLkr?: number;
  agent?: string; invoiceNo?: string; policyNo?: string; invoiceValue?: number;
}
export interface Shipment {
  id?: number; code: string; poCode: string; seq: number; date: string;
  vessel?: string; blNumber?: string; eta?: string;
  status: string; itemsTotal: number; extrasTotal: number; landedTotal: number;
  lines?: ShipmentLine[]; extras?: ShipmentExtra[];
  costFileName?: string; costFileData?: string;
  invoiceNo?: string; noOfPackages?: number; grossWeight?: number; netWeight?: number;
  shipmentType?: string; shipmentVolume?: string;
  etd?: string; etaDate?: string;
  cusdecNo?: string; cusdecDate?: string;
  bankingRate?: number; customRate?: number; settlementRate?: number;
  cidAmount?: number; palAmount?: number; dutyAmount?: number; dutyDate?: string;
  cessAmount?: number; vatAmount?: number; ssclAmount?: number;
  other1Amount?: number; other2Amount?: number; other3Amount?: number;
  freight?: ComplexChargeShape; insurance?: ComplexChargeShape;
  banking?: ComplexChargeShape; clearance?: ComplexChargeShape;
  slpa?: ComplexChargeShape; demurrage?: ComplexChargeShape;
  itemsTotalUsd?: number; itemsTotalLkr?: number; chargesTotalLkr?: number;
  approver1Id?: number | null; approver1At?: string | null; approver1?: { id: number; name: string } | null;
  approver2Id?: number | null; approver2At?: string | null; approver2?: { id: number; name: string } | null;
  rejectedById?: number | null; rejectedAt?: string | null; rejectReason?: string | null;
  rejectedBy?: { id: number; name: string } | null;
  approvalsCount?: number; approvalsRequired?: number;
}
export interface GRN {
  id: string; po: string; shipmentCode?: string; supplier: string;
  date: string; items: number; total: number; status: string;
  approver1Id?: number | null; approver1At?: string | null; approver1?: { id: number; name: string } | null;
  approver2Id?: number | null; approver2At?: string | null; approver2?: { id: number; name: string } | null;
  rejectedById?: number | null; rejectedAt?: string | null; rejectReason?: string | null;
  rejectedBy?: { id: number; name: string } | null;
  approvalsCount?: number; approvalsRequired?: number;
}
export interface TrackingRow {
  poCode: string; supplier: string; piNumber?: string; date: string;
  currency?: string; total: number; orderedQty: number; receivedQty: number;
  balanceQty: number; progress: number; status: string; stockValue?: number;
  shipments: { code: string; seq: number; date: string; status: string;
    itemsTotal: number; extrasTotal: number; landedTotal: number;
    invoiceNo?: string; shipmentType?: string; shipmentVolume?: string }[];
}
export interface Quotation {
  id: string; customer: string; rep: string; date: string; total: number; items: number; status: string; cost: string
}
export interface Invoice {
  id: string; code?: string; customer: string; rep: string; date: string; total: number; paid: number; due: number; items: number; cost: string; status: string
  source?: string // 'web' (admin) | 'app' (rep mobile app)
  terms?: string  // Cash | Cheque | Credit (30 days)
  lines?: Array<{ id?: number; code?: string; name: string; qty: number; rate: number }>
}
export interface SalesOrder {
  id: string | number; code: string; customer: string; rep?: string; source?: string; date: string
  total: number; items: number; status: string // pending | dispatched | invoiced | cancelled
  dispatchNo?: string | null; dispatchDate?: string | null; invoiceCode?: string | null
  lines?: Array<{ id?: number; code?: string; name: string; qty: number; rate: number; method?: string }>
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
