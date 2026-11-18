/* NMS-Auto — supplier / PO payment terms picker */
import { Input, Select } from './ui'

export const PAYMENT_TERMS = ['100% TT in advance', 'DP at sight', 'DA 30 Days', 'DA 60 Days', 'DA 90 Days', 'LC at sight']
/** Payment-terms picker: the standard list plus "Custom…", which takes any
 *  wording (e.g. "DA 120 Days", "50% advance, balance in 45 days"). */
export function PaymentTermsInput({ value, onChange, maxLength }: { value: string; onChange: (v: string) => void; maxLength?: number }) {
  // Anything outside the standard list (including blank, right after picking
  // "Custom…") is a custom term.
  const isCustom = !PAYMENT_TERMS.includes(value)
  return (
    <div className="col gap-2">
      <Select value={isCustom ? '__custom' : value} onChange={(e) => onChange(e.target.value === '__custom' ? '' : e.target.value)}>
        {PAYMENT_TERMS.map((t) => <option key={t}>{t}</option>)}
        <option value="__custom">Custom…</option>
      </Select>
      {isCustom && <Input autoFocus value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} placeholder="e.g. DA 120 Days" />}
    </div>
  )
}
