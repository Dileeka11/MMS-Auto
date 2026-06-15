/* Frontend mirror of backend/app/Support/Costing.php. Used by the Costing
   screen for live preview while the user is filling in the form. Backend
   recomputes on submit so any drift is corrected server-side. */

export interface ComplexCharge {
  amountUsd?: number
  amountLkr?: number
  agent?: string
  invoiceNo?: string
  policyNo?: string
  invoiceValue?: number
}

export interface CostingInput {
  bankingRate: number
  freight?: ComplexCharge | null
  insurance?: ComplexCharge | null
  banking?: ComplexCharge | null
  clearance?: ComplexCharge | null
  slpa?: ComplexCharge | null
  demurrage?: ComplexCharge | null
  cidAmount?: number
  palAmount?: number
  dutyAmount?: number
  cessAmount?: number
  vatAmount?: number
  ssclAmount?: number
  other1Amount?: number
  other2Amount?: number
  other3Amount?: number
  lines: Array<{
    code?: string
    hsCode?: string
    item: string
    qty: number
    cost: number
    sellingPriceWoVat?: number
    sellingPriceWithVat?: number
  }>
}

export interface CostedLine {
  code?: string
  hsCode?: string
  item: string
  qty: number
  cost: number
  total: number
  fobLkr: number
  freightLkr: number
  insuranceLkr: number
  cid: number
  pal: number
  cess: number
  vat: number
  sscl: number
  duty: number
  other1: number
  other2: number
  other3: number
  bankingAlloc: number
  clearanceAlloc: number
  slpaAlloc: number
  demurrageAlloc: number
  totalPriceWoVat: number
  totalPriceWithVat: number
  unitCostWoVat: number
  unitCostWithVat: number
  sellingPriceWoVat: number
  sellingPriceWithVat: number
}

export interface CostedShipment {
  itemsTotalUsd: number
  itemsTotalLkr: number
  chargesTotalLkr: number
  landedTotal: number
  freightLkr: number
  insuranceLkr: number
  bankingLkr: number
  clearanceLkr: number
  slpaLkr: number
  demurrageLkr: number
  lines: CostedLine[]
}

const round2 = (n: number) => Math.round(n * 100) / 100
const round4 = (n: number) => Math.round(n * 10000) / 10000

function chargeLkr(c: ComplexCharge | null | undefined, bankingRate: number): number {
  if (!c) return 0
  if (c.amountLkr && c.amountLkr > 0) return c.amountLkr
  if (c.amountUsd && c.amountUsd > 0) return round2(c.amountUsd * bankingRate)
  return 0
}

export function computeCosting(input: CostingInput): CostedShipment {
  const br = input.bankingRate || 0
  const lines = input.lines || []

  let itemsTotalUsd = 0
  let itemsTotalLkr = 0
  const perLineFobLkr: number[] = []
  lines.forEach((l, i) => {
    const fobUsd = (l.qty || 0) * (l.cost || 0)
    const fobLkr = round2(fobUsd * br)
    itemsTotalUsd += fobUsd
    itemsTotalLkr += fobLkr
    perLineFobLkr[i] = fobLkr
  })

  const freightLkr = chargeLkr(input.freight, br)
  const insuranceLkr = chargeLkr(input.insurance, br)
  const bankingChargeLkr = chargeLkr(input.banking, br)
  const clearanceLkr = chargeLkr(input.clearance, br)
  const slpaLkr = chargeLkr(input.slpa, br)
  const demurrageLkr = chargeLkr(input.demurrage, br)

  const cid = input.cidAmount || 0
  const pal = input.palAmount || 0
  const duty = input.dutyAmount || 0
  const cess = input.cessAmount || 0
  const vat = input.vatAmount || 0
  const sscl = input.ssclAmount || 0
  const o1 = input.other1Amount || 0
  const o2 = input.other2Amount || 0
  const o3 = input.other3Amount || 0

  const chargesTotalLkr =
    freightLkr + insuranceLkr + bankingChargeLkr + clearanceLkr + slpaLkr + demurrageLkr
    + cid + pal + duty + cess + vat + sscl + o1 + o2 + o3

  const costed: CostedLine[] = lines.map((l, i) => {
    const share = itemsTotalLkr > 0
      ? perLineFobLkr[i] / itemsTotalLkr
      : (lines.length > 0 ? 1 / lines.length : 0)
    const aFreight = round2(freightLkr * share)
    const aIns = round2(insuranceLkr * share)
    const aBank = round2(bankingChargeLkr * share)
    const aClear = round2(clearanceLkr * share)
    const aSlpa = round2(slpaLkr * share)
    const aDem = round2(demurrageLkr * share)
    const aCid = round2(cid * share)
    const aPal = round2(pal * share)
    const aDuty = round2(duty * share)
    const aCess = round2(cess * share)
    const aVat = round2(vat * share)
    const aSscl = round2(sscl * share)
    const aO1 = round2(o1 * share)
    const aO2 = round2(o2 * share)
    const aO3 = round2(o3 * share)

    const totalWoVat = perLineFobLkr[i]
      + aFreight + aIns
      + aCid + aPal + aCess + aSscl + aDuty
      + aO1 + aO2 + aO3
      + aBank + aClear + aSlpa + aDem
    const totalWithVat = totalWoVat + aVat
    const qty = l.qty || 0

    return {
      code: l.code,
      hsCode: l.hsCode,
      item: l.item,
      qty,
      cost: l.cost,
      total: round2(qty * l.cost),
      fobLkr: perLineFobLkr[i],
      freightLkr: aFreight,
      insuranceLkr: aIns,
      cid: aCid, pal: aPal, cess: aCess, vat: aVat, sscl: aSscl, duty: aDuty,
      other1: aO1, other2: aO2, other3: aO3,
      bankingAlloc: aBank, clearanceAlloc: aClear, slpaAlloc: aSlpa, demurrageAlloc: aDem,
      totalPriceWoVat: round2(totalWoVat),
      totalPriceWithVat: round2(totalWithVat),
      unitCostWoVat: qty > 0 ? round4(totalWoVat / qty) : 0,
      unitCostWithVat: qty > 0 ? round4(totalWithVat / qty) : 0,
      sellingPriceWoVat: l.sellingPriceWoVat || 0,
      sellingPriceWithVat: l.sellingPriceWithVat || 0,
    }
  })

  return {
    itemsTotalUsd: round2(itemsTotalUsd),
    itemsTotalLkr: round2(itemsTotalLkr),
    chargesTotalLkr: round2(chargesTotalLkr),
    landedTotal: round2(itemsTotalLkr + chargesTotalLkr),
    freightLkr, insuranceLkr, bankingLkr: bankingChargeLkr,
    clearanceLkr, slpaLkr, demurrageLkr,
    lines: costed,
  }
}
