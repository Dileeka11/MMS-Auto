/* Global double-click / double-submit guard.

   Works for every <button> in the app without touching each screen:
   - The button that started an API request (clicked ≤ ORIGIN_MS before it)
     shows a spinner and ignores further clicks until that request settles.
   - While any write (POST/PUT/PATCH/DELETE) is in flight, clicks on every
     button are swallowed, so a save/delete/approve can never be sent twice.

   Opt-outs (put on the element or any ancestor):
     data-guard="off"   never blocked or marked (toasts, etc.)
     data-guard="keep"  clicks here don't replace the origin button — used by the
                        confirm dialog so the spinner lands on the button that
                        opened it (e.g. the row's delete icon), not on "OK". */

const ORIGIN_MS = 600

let lastBtn: HTMLElement | null = null
let lastAt = 0
let writes = 0
const marks = new Map<HTMLElement, number>()

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())

function mark(el: HTMLElement) {
  const n = (marks.get(el) || 0) + 1
  marks.set(el, n)
  if (n === 1) el.setAttribute('data-mms-busy', '')
}

function unmark(el: HTMLElement) {
  const n = (marks.get(el) || 0) - 1
  if (n > 0) { marks.set(el, n); return }
  marks.delete(el)
  el.removeAttribute('data-mms-busy')
}

function syncRoot() {
  if (writes > 0) document.documentElement.setAttribute('data-saving', '')
  else document.documentElement.removeAttribute('data-saving')
}

/** Called from the axios request interceptor. Returns the button to release later. */
export function beginRequest(isWrite: boolean): HTMLElement | null {
  if (isWrite) { writes++; syncRoot() }
  const el = lastBtn && lastBtn.isConnected && now() - lastAt <= ORIGIN_MS ? lastBtn : null
  if (el) mark(el)
  return el
}

/** Called once the request finishes (success or failure). */
export function endRequest(isWrite: boolean, el: HTMLElement | null) {
  if (isWrite) { writes = Math.max(0, writes - 1); syncRoot() }
  if (el) unmark(el)
}

function onClickCapture(e: MouseEvent) {
  const target = e.target as Element | null
  const btn = target?.closest?.('button, [role="button"], input[type="submit"]') as HTMLElement | null
  if (!btn) return
  if (btn.closest('[data-guard="off"]')) return

  if (btn.hasAttribute('data-mms-busy') || writes > 0) {
    e.preventDefault()
    e.stopImmediatePropagation()
    return
  }

  if (btn.closest('[data-guard="keep"]') && lastBtn?.isConnected) {
    lastAt = now() // keep the original button, just refresh the window
    return
  }
  // Sidebar/tab navigation: screens show their own loaders, don't spin the nav item.
  if (btn.classList.contains('mms-nav')) { lastBtn = null; return }
  lastBtn = btn
  lastAt = now()
}

let installed = false
export function installClickGuard() {
  if (installed || typeof document === 'undefined') return
  installed = true
  // Capture on window so we run before React's root listener.
  window.addEventListener('click', onClickCapture, true)
}
