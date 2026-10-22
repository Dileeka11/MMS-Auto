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
  taxNo?: string   // TIN / VAT no — shown on tax invoices
  address?: string
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
  discountPct?: number
  discountStatus?: 'pending' | 'approved' | 'rejected' | null
  vatApplied?: boolean // printed as a Tax Invoice
  vatPct?: number
  vatAmount?: number   // included in total
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

/* ---------- Accounting (Chart of Accounts / General Ledger) ----------
   Field names are camelCase: api.ts converts the Laravel snake_case payloads. */
export type NormalBalance = 'debit' | 'credit'
export type StatementType = 'BS' | 'PNL'

export interface AccountCategory {
  id: number
  code: string
  name: string
  normalBalance: NormalBalance
  statementType: StatementType
  groupsCount?: number
}

export interface AccountGroup {
  id: number
  categoryId: number
  code: string
  name: string
  accountsCount?: number
  category?: AccountCategory
}

/** A category nested with its groups — for dropdowns. */
export interface ChartCategory extends AccountCategory {
  groups: AccountGroup[]
}

/** A row of the flat Chart of Accounts list (joined up to group + category). */
export interface AccountRow {
  id: number
  code: string
  name: string
  isActive: boolean
  isDefault: boolean
  createdBy: string
  groupId: number
  parentId: number | null
  groupName: string
  groupCode: string
  categoryId: number
  categoryName: string
  type: StatementType
  /** True when the account has sub-accounts (a "header", not postable). */
  hasChildren: boolean
  /** True when the account is a leaf and may be posted to in journal entries. */
  isPostable: boolean
}

export interface JournalLine {
  id?: number
  entryId?: number
  accountId: number
  debit: string | number
  credit: string | number
  memo: string | null
  accountCode?: string
  accountName?: string
}

export interface JournalEntry {
  id: number
  financialYearId: number | null
  entryDate: string
  postingDate: string | null
  reference: string | null
  invoiceNumber: string | null
  customerName: string | null
  paymentMethod: 'cash_in_hand' | 'bank' | null
  paymentAccountId: number | null
  currency: string
  branch: string | null
  memo: string | null
  createdAt: string
  lines: JournalLine[]
}

export interface FinancialYear {
  id: number
  yearName: string
  startDate: string
  endDate: string
  isActive: boolean
  createdAt?: string
  updatedAt?: string
}

export interface OpeningBalanceAccount {
  accountId: number
  accountCode: string
  accountName: string
  groupId: number
  groupName: string | null
  categoryName: string | null
  parentId: number | null
  financialYearId: number
  debit: string
  credit: string
}

export interface OpeningBalancesResponse {
  financialYear: FinancialYear
  accounts: OpeningBalanceAccount[]
}

/** One editable row in the Manual Journal Entry grid. */
export interface JournalDraftLine {
  accountId: number | ''
  drCr: 'debit' | 'credit' | ''
  amount: string
  memo: string
}

export interface LedgerLine {
  entryId: number
  docNo: string
  date: string
  reference: string | null
  memo: string | null
  debit: number
  credit: number
  balance: number
}

export interface GeneralLedger {
  account: { id: number; code: string; name: string; normalBalance: NormalBalance }
  openingBalance: number
  lines: LedgerLine[]
  totalDebit: number
  totalCredit: number
  closingBalance: number
}

export interface TrialBalanceRow {
  code: string
  name: string
  debit: number
  credit: number
}

export interface TrialBalance {
  from: string | null
  to: string | null
  rows: TrialBalanceRow[]
  totalDebit: number
  totalCredit: number
  balanced: boolean
}
