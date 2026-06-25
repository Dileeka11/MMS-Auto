/* Re-usable two-admin approval UI: small inline counter + a full panel
   used inside view modals. Used by PO, Shipment (Costing) and GRN screens. */
import type { CSSProperties } from 'react'
import { Badge } from './ui'
import DB from '../data'

export interface ApprovableLike {
  status?: string
  approver1?: { id: number; name: string } | null
  approver2?: { id: number; name: string } | null
  approver1At?: string | null
  approver2At?: string | null
  rejectedBy?: { id: number; name: string } | null
  rejectedAt?: string | null
  rejectReason?: string | null
  approvalsCount?: number
  approvalsRequired?: number
}

export function canApprove(po: ApprovableLike, isAdmin: boolean, userId?: number) {
  return isAdmin
    && po.status === 'Awaiting Approval'
    && po.approver1?.id !== userId
    && po.approver2?.id !== userId
}

export function canReject(po: ApprovableLike, isAdmin: boolean) {
  return isAdmin && po.status === 'Awaiting Approval'
}

export function ApprovalCounter({ po }: { po: ApprovableLike }) {
  if (!po.status || po.status === 'Approved' || po.status === 'Rejected') return null
  const c = po.approvalsCount ?? 0
  const r = po.approvalsRequired ?? 2
  return <span className="t-3 mono" style={{ fontSize: 10 }}>{c}/{r} approved</span>
}

export function ApprovalPanel({ po }: { po: ApprovableLike }) {
  const c = po.approvalsCount ?? 0
  const r = po.approvalsRequired ?? 2
  const wrap: CSSProperties = {
    border: '1px solid var(--line)', borderRadius: 'var(--r-m)',
    padding: 14, marginBottom: 16, background: 'var(--bg-0)',
  }
  return (
    <div style={wrap}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <div className="eyebrow" style={{ fontSize: 10 }}>Approval Trail</div>
        <Badge tone={po.status === 'Approved' ? 'green' : po.status === 'Rejected' ? 'red' : 'amber'}>
          {c}/{r} approved
        </Badge>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12.5 }}>
        <Slot label="Approver 1" user={po.approver1} at={po.approver1At} />
        <Slot label="Approver 2" user={po.approver2} at={po.approver2At} />
        {po.rejectedBy && (
          <div style={{ gridColumn: '1 / -1', paddingTop: 8, borderTop: '1px solid var(--line-soft)' }}>
            <div className="t-3" style={{ fontSize: 10, textTransform: 'uppercase', marginBottom: 4, color: 'var(--bad)' }}>Rejected By</div>
            <div style={{ fontWeight: 600, color: 'var(--bad)' }}>{po.rejectedBy.name}</div>
            <div className="mono t-3" style={{ fontSize: 11 }}>{DB.fmtDate(po.rejectedAt)}</div>
            {po.rejectReason && <div className="t-2" style={{ fontSize: 12, marginTop: 4 }}>Reason: {po.rejectReason}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

function Slot({ label, user, at }: { label: string; user?: { name: string } | null; at?: string | null }) {
  return (
    <div>
      <div className="t-3" style={{ fontSize: 10, textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      {user ? (
        <>
          <div style={{ fontWeight: 600 }}>{user.name}</div>
          <div className="mono t-3" style={{ fontSize: 11 }}>{DB.fmtDate(at)}</div>
        </>
      ) : <div className="t-3">— Pending —</div>}
    </div>
  )
}

/** Common alert-on-error wrapper used for approve/reject API calls. */
export async function runApprovalAction<T>(fn: () => Promise<T>): Promise<T | null> {
  try { return await fn() }
  catch (ex: any) {
    const msg = ex?.response?.data?.message
      || ex?.response?.data?.errors?.status?.[0]
      || ex?.response?.data?.errors?.po?.[0]
      || 'Action failed'
    alert(msg)
    return null
  }
}
