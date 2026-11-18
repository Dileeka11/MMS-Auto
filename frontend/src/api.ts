/* Axios client for the Laravel API. Base URL is proxied to http://localhost:8000 in dev (see vite.config.ts). */
import axios from 'axios'
import { beginRequest, endRequest } from './lib/clickGuard'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30_000,
  headers: {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
})

const genReqId = () =>
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36))

/* ---------- request activity + events (drives preloaders & notifications) ----------
   Every request bumps a pending counter that the top progress bar and table
   skeletons subscribe to. Finished writes and failures are published as events
   that <NotifyProvider> turns into toasts. Pass `silent: true` in the request
   config to keep a call out of both (background polling, etc.). */
declare module 'axios' {
  interface AxiosRequestConfig { silent?: boolean }
}

export interface ApiActivity { total: number; reads: number }
type ActivityFn = (a: ApiActivity) => void
const activity: ApiActivity = { total: 0, reads: 0 }
const activitySubs = new Set<ActivityFn>()
export const subscribeActivity = (fn: ActivityFn) => { activitySubs.add(fn); fn({ ...activity }); return () => { activitySubs.delete(fn) } }
export const getActivity = (): ApiActivity => ({ ...activity })
const bump = (isRead: boolean, d: 1 | -1) => {
  activity.total = Math.max(0, activity.total + d)
  if (isRead) activity.reads = Math.max(0, activity.reads + d)
  const snap = { ...activity }
  activitySubs.forEach((fn) => fn(snap))
}

export type ApiEvent =
  | { type: 'write'; method: string; url: string }
  | { type: 'error'; status: number; title: string; msg?: string; method: string; url: string }
type EventFn = (e: ApiEvent) => void
const eventSubs = new Set<EventFn>()
export const onApiEvent = (fn: EventFn) => { eventSubs.add(fn); return () => { eventSubs.delete(fn) } }
const emit = (e: ApiEvent) => eventSubs.forEach((fn) => fn(e))

/** First human-readable message from a Laravel error response. */
export function apiErrorText(err: any, fallback = 'Something went wrong'): string {
  const d = err?.response?.data
  const first = d?.errors && (Object.values(d.errors)[0] as string[] | undefined)?.[0]
  if (first) return first
  if (d?.message && d.message !== 'The given data was invalid.') return d.message
  if (err?.code === 'ECONNABORTED') return 'The server took too long to respond.'
  if (err && !err.response && err.message === 'Network Error') return 'Cannot reach the server. Check your connection.'
  return d?.message || fallback
}

function errorTitle(status: number, method: string): string {
  if (!status) return 'Connection problem'
  if (status === 403) return 'Access denied'
  if (status === 404) return 'Not found'
  if (status === 409) return 'Conflict'
  if (status === 413) return 'File too large'
  if (status === 422) return method === 'get' ? 'Invalid request' : 'Could not save'
  if (status === 429) return 'Too many requests'
  if (status >= 500) return 'Server error'
  return 'Request failed'
}

http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('mms-token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  cfg.headers['X-Request-Id'] = genReqId()
  if (!cfg.silent) {
    const isRead = (cfg.method || 'get').toLowerCase() === 'get'
    bump(isRead, 1)
    ;(cfg as any)._tracked = true
    // Spin + lock the button that triggered this request (see lib/clickGuard).
    ;(cfg as any)._origin = beginRequest(!isRead)
  }
  return cfg
})

/* ---------- list cache (stale-while-fresh) ----------
   GET list endpoints are cached for a short window so re-visiting a screen is
   instant instead of round-tripping the server every time. Any successful write
   (POST/PUT/DELETE) clears the whole cache, so lists never go stale after a
   mutation — correctness over cleverness. */
const LIST_CACHE_TTL = 30_000
const listCache = new Map<string, { ts: number; data: any[] }>()
const listInflight = new Map<string, Promise<any[]>>()
export const clearListCache = (name?: string) => { if (name) listCache.delete(name); else listCache.clear() }

const untrack = (cfg: any) => {
  if (cfg?._tracked) {
    cfg._tracked = false
    const isRead = (cfg.method || 'get').toLowerCase() === 'get'
    bump(isRead, -1)
    endRequest(!isRead, cfg._origin || null)
    cfg._origin = null
  }
}

let unauthorizedHandled = false
http.interceptors.response.use(
  (r) => {
    untrack(r.config)
    const m = r.config.method?.toLowerCase()
    if (m && m !== 'get') {
      listCache.clear()
      const url = r.config.url || ''
      if (!r.config.silent && !/^\/?(login|logout|attachments)\b/.test(url)) emit({ type: 'write', method: m, url })
    }
    return r
  },
  (err) => {
    untrack(err?.config)
    const status = err?.response?.status
    if (status === 401 && localStorage.getItem('mms-token') && !unauthorizedHandled) {
      unauthorizedHandled = true
      localStorage.removeItem('mms-token')
      try { sessionStorage.setItem('mms-logout-reason', 'Your session expired. Please sign in again.') } catch { /* ignore */ }
      window.location.reload()
    }
    const cfg = err?.config || {}
    const url = String(cfg.url || '')
    if (!axios.isCancel(err) && status !== 401 && !cfg.silent && !/^\/?(login|rep\/login)\b/.test(url)) {
      const method = String(cfg.method || 'get').toLowerCase()
      emit({ type: 'error', status: status || 0, method, url, title: errorTitle(status || 0, method), msg: apiErrorText(err) })
    }
    if (status === 429 && import.meta.env.DEV) {
      console.warn('[api] rate limited; retry after', err?.response?.headers?.['retry-after'])
    }
    return Promise.reject(err)
  },
)

/* ---------- snake_case <-> camelCase mapping ----------
   Laravel returns snake_case (avg_cost, stock_by_branch, raised_by).
   The React screens use camelCase. Transform at the API boundary
   so neither side has to care about the other's naming. */
const toCamel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
const toSnake = (s: string) => s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())

function deepMap(v: any, key: (s: string) => string): any {
  if (Array.isArray(v)) return v.map((x) => deepMap(x, key))
  if (v && typeof v === 'object' && v.constructor === Object) {
    const out: Record<string, any> = {}
    for (const k of Object.keys(v)) out[key(k)] = deepMap(v[k], key)
    return out
  }
  return v
}

const camelize = (v: any) => deepMap(v, toCamel)
const snakeize = (v: any) => deepMap(v, toSnake)

/* Generic CRUD helper. All requests/responses are auto-converted. */
export function resource<T = any>(name: string) {
  return {
    list: () => {
      const hit = listCache.get(name)
      if (hit && Date.now() - hit.ts < LIST_CACHE_TTL) return Promise.resolve(hit.data.slice() as T[])
      // Share one request between callers that ask at the same moment
      // (e.g. several dropdown hooks loading branches on the same screen).
      let p = listInflight.get(name)
      if (!p) {
        p = http.get(`/${name}`).then((r) => {
          const data = camelize(r.data) as any[]
          listCache.set(name, { ts: Date.now(), data })
          return data
        }).finally(() => listInflight.delete(name))
        listInflight.set(name, p)
      }
      return p.then((d) => d.slice() as T[])
    },
    get: (id: string | number) => http.get(`/${name}/${id}`).then((r) => camelize(r.data) as T),
    create: (body: Partial<T>) => http.post(`/${name}`, snakeize(body)).then((r) => camelize(r.data) as T),
    update: (id: string | number, body: Partial<T>) => http.put(`/${name}/${id}`, snakeize(body)).then((r) => camelize(r.data) as T),
    remove: (id: string | number) => http.delete(`/${name}/${id}`).then((r) => r.data),
  }
}

export interface AuthUser {
  id: number; name: string; email: string;
  role?: string;
  branch?: string | null;
  status?: 'Active' | 'Inactive';
  /** Flat list of "Module:Action" strings the role is allowed to perform. */
  permissions?: string[];
}

export interface PermUser {
  id: number; name: string; email: string; role?: string;
}

export interface PermissionMatrix {
  users: PermUser[];
  modules: string[];
  actions: string[];
  /** Keyed by user id (as string). */
  matrix: Record<string, Record<string, Record<string, boolean>>>;
}

export const permissionsApi = {
  list: () => http.get<PermissionMatrix>('/permissions').then((r) => r.data),
  updateUser: (userId: number, modules: Record<string, Record<string, boolean>>) =>
    http.put(`/permissions/${userId}`, { modules }).then((r) => r.data),
}

export const auth = {
  login: (email: string, password: string) =>
    http.post<{ token: string; user: AuthUser }>('/login', { email, password }).then((r) => r.data),
  me: () => http.get<AuthUser>('/me').then((r) => r.data),
  logout: () => http.post('/logout', null, { silent: true }).then((r) => r.data),
  setToken: (t: string | null) => {
    if (t) localStorage.setItem('mms-token', t)
    else localStorage.removeItem('mms-token')
  },
  getToken: () => localStorage.getItem('mms-token'),
}

export const company = {
  get: () => http.get('/company-profile').then((r) => camelize(r.data)),
  update: (body: any) => http.put('/company-profile', snakeize(body)).then((r) => camelize(r.data)),
  uploadLogo: (file: File) => {
    const formData = new FormData()
    formData.append('logo', file)
    return http.post('/company-profile/logo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => camelize(r.data))
  },
}

/* ---------- attachments (BR copy, shop photo, PO quotation, expense bill) ----------
   Files are private on the server: upload returns a `path` to save on the
   record, and viewing fetches the file with the bearer token. Photos are
   shrunk in the browser first so phone pictures stay well under PHP's
   upload limit. */
export type AttachmentFolder = 'customers' | 'purchase-orders' | 'expenses'

async function shrinkImage(file: File, maxSide = 1800, quality = 0.82): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400_000) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    bmp.close()
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch { return file }
}

export const attachments = {
  upload: async (file: File, folder: AttachmentFolder) => {
    const fd = new FormData()
    fd.append('file', await shrinkImage(file))
    fd.append('folder', folder)
    const r = await http.post('/attachments', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120_000 })
    return r.data as { path: string; name: string }
  },
  /** Open a stored attachment in a new tab. The tab is opened synchronously
   *  (before the download) so popup blockers allow it. */
  open: async (path: string) => {
    const w = window.open('', '_blank')
    try {
      const r = await http.get('/attachments', { params: { path }, responseType: 'blob', timeout: 120_000 })
      const url = URL.createObjectURL(r.data as Blob)
      if (w) w.location.href = url
      else window.location.href = url
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      w?.close()
      throw e
    }
  },
}

export const api = {
  items: {
    ...resource('items'),
    bulk: (items: any[]) => http.post('/items/bulk', { items: items.map((i) => snakeize(i)) }).then((r) => camelize(r.data)),
    bulkPrice: (items: { code: string; price: number }[]) => http.post('/items/bulk-price', { items }).then((r) => r.data as { updated: number; unchanged: number; notFound: string[] }),
    clearAll: () => http.delete('/items').then((r) => r.data),
    nextCode: () => http.get('/items/next-code').then((r) => (r.data?.code as string) || ''),
  },
  customers: resource('customers'),
  reps: resource('sales-reps'),
  users: resource('users'),
  suppliers: resource('suppliers'),
  purchaseOrders: {
    ...resource('purchase-orders'),
    approve: (id: string | number) => http.post(`/purchase-orders/${id}/approve`).then((r) => camelize(r.data)),
    reject: (id: string | number, reason?: string) => http.post(`/purchase-orders/${id}/reject`, { reason }).then((r) => camelize(r.data)),
  },
  shipments: {
    ...resource('shipments'),
    byPo: (poCode: string) => http.get('/shipments', { params: { po: poCode } }).then((r) => camelize(r.data)),
    approve: (id: string | number) => http.post(`/shipments/${id}/approve`).then((r) => camelize(r.data)),
    reject: (id: string | number, reason?: string) => http.post(`/shipments/${id}/reject`, { reason }).then((r) => camelize(r.data)),
  },
  grns: {
    ...resource('grns'),
    approve: (id: string | number) => http.post(`/grns/${id}/approve`).then((r) => camelize(r.data)),
    reject: (id: string | number, reason?: string) => http.post(`/grns/${id}/reject`, { reason }).then((r) => camelize(r.data)),
  },
  tracking: () => http.get('/po-tracking').then((r) => camelize(r.data)),
  quotations: resource('quotations'),
  salesOrders: {
    list: (status?: string) =>
      http.get('/sales-orders', { params: status ? { status } : {} }).then((r) => camelize(r.data) as any[]),
    dispatch: (id: string | number, body: { date?: string; lines: any[] }) =>
      http.post(`/sales-orders/${id}/dispatch`, snakeize(body)).then((r) => camelize(r.data)),
    invoice: (id: string | number, body: { terms?: string; date?: string; vatApplied?: boolean }) =>
      http.post(`/sales-orders/${id}/invoice`, snakeize(body)).then((r) => camelize(r.data)),
    remove: (id: string | number) => http.delete(`/sales-orders/${id}`).then((r) => r.data),
  },
  invoices: {
    ...resource('invoices'),
    pay: (id: string | number, body: { amount: number; mode?: string; reference?: string; chequeNo?: string; bankAcc?: string; chequeBankName?: string; chequeDate?: string }) =>
      http.post(`/invoices/${id}/pay`, snakeize(body)).then((r) => camelize(r.data)),
    approveDiscount: (id: string | number) => http.post(`/invoices/${id}/approve-discount`).then((r) => camelize(r.data)),
    rejectDiscount: (id: string | number) => http.post(`/invoices/${id}/reject-discount`).then((r) => camelize(r.data)),
  },
  returns: resource('sales-returns'),
  receipts: resource('receipts'),
  expenses: resource('expenses'),
  stockTransfers: resource('stock-transfers'),
  stockAdjustments: resource('stock-adjustments'),
  master: (type: string) => resource(`masters/${type}`),
  accounting: {
    stats: () => http.get('/accounting/stats').then((r) => camelize(r.data)),
    chart: () => http.get('/accounting/chart').then((r) => camelize(r.data) as any[]),
    categories: () => http.get('/accounting/categories').then((r) => camelize(r.data) as any[]),
    groups: () => http.get('/accounting/groups').then((r) => camelize(r.data) as any[]),
    accounts: {
      list: () => http.get('/accounting/accounts').then((r) => camelize(r.data) as any[]),
      create: (body: any) => http.post('/accounting/accounts', snakeize(body)).then((r) => camelize(r.data)),
      update: (id: number, body: any) => http.put(`/accounting/accounts/${id}`, snakeize(body)).then((r) => camelize(r.data)),
      remove: (id: number) => http.delete(`/accounting/accounts/${id}`).then((r) => r.data),
    },
    journal: {
      list: (params: { from?: string; to?: string; source?: string; search?: string } = {}) =>
        http.get('/accounting/journal-entries', { params }).then((r) => camelize(r.data) as any[]),
      get: (id: number) => http.get(`/accounting/journal-entries/${id}`).then((r) => camelize(r.data)),
      create: (body: any) => http.post('/accounting/journal-entries', snakeize(body)).then((r) => camelize(r.data)),
      remove: (id: number) => http.delete(`/accounting/journal-entries/${id}`).then((r) => r.data),
    },
    posting: {
      setup: () => http.get('/accounting/posting-accounts').then((r) => camelize(r.data)),
      save: (mappings: { key: string; accountId: number }[]) =>
        http.put('/accounting/posting-accounts', snakeize({ mappings })).then((r) => camelize(r.data)),
      rebuild: () => http.post('/accounting/posting/rebuild', null, { timeout: 300000 }).then((r) => camelize(r.data)),
    },
    ledger: (params: { accountId: number; from?: string; to?: string }) =>
      http.get('/accounting/general-ledger', { params: snakeize(params) }).then((r) => camelize(r.data)),
    trialBalance: (params: { from?: string; to?: string }) =>
      http.get('/accounting/trial-balance', { params }).then((r) => camelize(r.data)),
    cashbook: {
      accounts: () => http.get('/accounting/cashbook/accounts').then((r) => camelize(r.data) as any[]),
      book: (params: { accountId: number; from?: string; to?: string }) =>
        http.get('/accounting/cashbook', { params: snakeize(params) }).then((r) => camelize(r.data)),
      suppliers: () => http.get('/accounting/cashbook/suppliers').then((r) => camelize(r.data) as any[]),
      createVoucher: (body: any) => http.post('/accounting/cash-vouchers', snakeize(body)).then((r) => camelize(r.data)),
      removeVoucher: (id: number) => http.delete(`/accounting/cash-vouchers/${id}`).then((r) => r.data),
    },
    profitLoss: (params: { from?: string; to?: string }) =>
      http.get('/accounting/profit-loss', { params }).then((r) => camelize(r.data)),
    balanceSheet: (params: { asOf?: string }) =>
      http.get('/accounting/balance-sheet', { params: snakeize(params) }).then((r) => camelize(r.data)),
    years: {
      list: () => http.get('/accounting/financial-years').then((r) => camelize(r.data) as any[]),
      create: (body: any) => http.post('/accounting/financial-years', snakeize(body)).then((r) => camelize(r.data)),
      update: (id: number, body: any) => http.put(`/accounting/financial-years/${id}`, snakeize(body)).then((r) => camelize(r.data)),
      remove: (id: number) => http.delete(`/accounting/financial-years/${id}`).then((r) => r.data),
      setActive: (id: number) => http.post(`/accounting/financial-years/${id}/set-active`).then((r) => camelize(r.data)),
      openingBalances: (id: number) => http.get(`/accounting/financial-years/${id}/opening-balances`).then((r) => camelize(r.data)),
      saveOpeningBalances: (id: number, balances: { accountId: number; debit: string; credit: string }[]) =>
        http.post(`/accounting/financial-years/${id}/opening-balances`, snakeize({ balances })).then((r) => r.data),
    },
  },
  dashboard: (opts: { silent?: boolean } = {}) => http.get('/dashboard', { silent: opts.silent }).then((r) => camelize(r.data)),
  approveReturn: (id: string | number) => http.post(`/sales-returns/${id}/approve`).then((r) => camelize(r.data)),
  rejectReturn: (id: string | number) => http.post(`/sales-returns/${id}/reject`).then((r) => camelize(r.data)),
}

export default api
