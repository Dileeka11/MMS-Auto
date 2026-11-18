/* Lightweight Excel export: an HTML table saved as .xls (opens in Excel
   without loading the SheetJS bundle). */

type Cell = string | number | null | undefined
export interface XlsSection { title?: string; headers: string[]; rows: Cell[][] }

const esc = (v: Cell) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' } as Record<string, string>)[c])

function save(filename: string, body: string) {
  const html = '﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body>' + body + '</body></html>'
  const blob = new Blob([html], { type: 'application/vnd.ms-excel' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const table = (s: XlsSection) =>
  (s.title ? `<h3>${esc(s.title)}</h3>` : '') +
  '<table border="1"><thead><tr>' + s.headers.map((h) => `<th>${esc(h)}</th>`).join('') + '</tr></thead><tbody>' +
  s.rows.map((r) => '<tr>' + r.map((c) => `<td${typeof c === 'number' ? ' style="mso-number-format:\'0.00\'"' : ''}>${esc(c)}</td>`).join('') + '</tr>').join('') +
  '</tbody></table>'

export function downloadXls(filename: string, headers: string[], rows: Cell[][]) {
  save(filename, table({ headers, rows }))
}

/** Several titled tables, one under the other, in a single sheet. */
export function downloadXlsSections(filename: string, sections: XlsSection[]) {
  save(filename, sections.map(table).join('<br/>'))
}

/** yyyy-mm-dd stamp for export file names. */
export const stamp = () => {
  const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
  return d.toISOString().slice(0, 10)
}
