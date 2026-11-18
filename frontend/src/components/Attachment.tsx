/* NMS-Auto — attachment picker: upload a photo / PDF, then view or replace it.
   The value is the server path returned by POST /attachments; it is saved on
   the record (customer.brDoc, purchaseOrder.quotationDoc, expense.attachment…). */
import { useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from './Icon'
import { attachments, type AttachmentFolder } from '../api'

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf'
const labelSty: CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--tx-2)', textTransform: 'uppercase', letterSpacing: '.06em' }
const isPdf = (p: string) => /\.pdf$/i.test(p)

const errText = (e: any) => {
  const d = e?.response?.data
  if (e?.response?.status === 413) return 'File is too large for the server.'
  return (d?.errors && (Object.values(d.errors)[0] as string[])?.[0]) || d?.message || e?.message || 'Upload failed'
}

/** Open a saved attachment; reports failures through `onError`. */
export function openAttachment(path: string, onError?: (msg: string) => void) {
  attachments.open(path).catch((e) => { if (onError) onError(errText(e)) /* else: shown by the app-wide API error toast */ })
}

export function AttachmentField({ label, folder, value, onChange, required, full, hint, onBusy }: {
  label: string
  folder: AttachmentFolder
  value?: string | null
  onChange: (path: string | null) => void
  required?: boolean
  full?: boolean
  hint?: string
  /** Lets the parent disable Save while a file is still uploading. */
  onBusy?: (busy: boolean) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [name, setName] = useState('')
  const [err, setErr] = useState('')

  const pick = async (f: File | null | undefined) => {
    if (!f) return
    if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(f.type)) { setErr('Use a JPG, PNG, WEBP image or a PDF.'); return }
    setErr(''); setBusy(true); onBusy?.(true)
    try {
      const r = await attachments.upload(f, folder)
      setName(r.name); onChange(r.path)
    } catch (e) {
      setErr(errText(e))
    } finally {
      setBusy(false); onBusy?.(false)
      if (ref.current) ref.current.value = ''
    }
  }

  const missing = required && !value
  return (
    <div className="col gap-2" style={{ gridColumn: full ? '1/-1' : 'auto', minWidth: 0 }}>
      <span style={labelSty}>{label}{required ? ' *' : ''}</span>
      <input ref={ref} type="file" accept={ACCEPT} style={{ display: 'none' }} onChange={(e) => pick(e.target.files?.[0])} />
      <div className="row gap-2" style={{
        background: 'var(--bg-3)', border: '1px solid ' + (err ? 'var(--bad)' : missing ? 'var(--warn)' : 'var(--line)'),
        borderRadius: 'var(--r-s)', padding: '6px 8px 6px 12px', minHeight: 38, alignItems: 'center',
      }}>
        <Icon n={value ? (isPdf(value) ? 'doc' : 'check') : 'upload'} s={16} c={value ? 'var(--ok)' : 'var(--tx-2)'} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: value ? 'var(--tx-0)' : 'var(--tx-2)' }}>
          {busy ? 'Uploading…' : value ? (name || (isPdf(value) ? 'PDF attached' : 'Image attached')) : (hint || 'Photo or PDF')}
        </span>
        {value && !busy && <button type="button" className="mms-act" title="View" onClick={() => openAttachment(value, setErr)}><Icon n="eye" s={15} /></button>}
        <button type="button" className="mms-act" title={value ? 'Replace' : 'Choose file'} disabled={busy} onClick={() => ref.current?.click()}><Icon n="upload" s={15} /></button>
        {value && !busy && <button type="button" className="mms-act danger" title="Remove" onClick={() => { setName(''); onChange(null) }}><Icon n="x" s={15} /></button>}
      </div>
      {err && <span style={{ fontSize: 11.5, color: 'var(--bad)' }}>{err}</span>}
    </div>
  )
}

/** Small "view attachment" icon button for table rows / detail views. */
export function AttachmentLink({ path, title = 'View attachment' }: { path?: string | null; title?: string }) {
  if (!path) return null
  return (
    <button type="button" className="mms-act" title={title} onClick={() => openAttachment(path)}>
      <Icon n={isPdf(path) ? 'doc' : 'eye'} s={15} />
    </button>
  )
}
