/* Axios client for the Laravel API. Base URL is proxied to http://localhost:8000 in dev (see vite.config.ts). */
import axios from 'axios'

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

http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('mms-token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  cfg.headers['X-Request-Id'] = genReqId()
  return cfg
})

/* ---------- list cache (stale-while-fresh) ----------
   GET list endpoints are cached for a short window so re-visiting a screen is
   instant instead of round-tripping the server every time. Any successful write
   (POST/PUT/DELETE) clears the whole cache, so lists never go stale after a
   mutation — correctness over cleverness. */
const LIST_CACHE_TTL = 30_000
const listCache = new Map<string, { ts: number; data: any[] }>()
export const clearListCache = (name?: string) => { if (name) listCache.delete(name); else listCache.clear() }

let unauthorizedHandled = false
http.interceptors.response.use(
  (r) => {
    const m = r.config.method?.toLowerCase()
    if (m && m !== 'get') listCache.clear()
    return r
  },
  (err) => {
    const status = err?.response?.status
    if (status === 401 && localStorage.getItem('mms-token') && !unauthorizedHandled) {
      unauthorizedHandled = true
      localStorage.removeItem('mms-token')
      window.location.reload()
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
      return http.get(`/${name}`).then((r) => {
        const data = camelize(r.data) as T[]
        listCache.set(name, { ts: Date.now(), data: data as any[] })
        return (data as any[]).slice() as T[]
      })
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
  logout: () => http.post('/logout').then((r) => r.data),
  setToken: (t: string | null) => {
    if (t) localStorage.setItem('mms-token', t)
    else localStorage.removeItem('mms-token')
  },
  getToken: () => localStorage.getItem('mms-token'),
}

export const company = {
  get: () => http.get('/company-profile').then((r) => camelize(r.data)),
  update: (body: any) => http.put('/company-profile', snakeize(body)).then((r) => camelize(r.data)),
}

export const api = {
  items: {
    ...resource('items'),
    bulk: (items: any[]) => http.post('/items/bulk', { items: items.map((i) => snakeize(i)) }).then((r) => camelize(r.data)),
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
    invoice: (id: string | number, body: { terms?: string; date?: string }) =>
      http.post(`/sales-orders/${id}/invoice`, snakeize(body)).then((r) => camelize(r.data)),
    remove: (id: string | number) => http.delete(`/sales-orders/${id}`).then((r) => r.data),
  },
  invoices: {
    ...resource('invoices'),
    pay: (id: string | number, body: { amount: number; mode?: string; reference?: string; chequeNo?: string; bankAcc?: string }) =>
      http.post(`/invoices/${id}/pay`, snakeize(body)).then((r) => camelize(r.data)),
  },
  returns: resource('sales-returns'),
  receipts: resource('receipts'),
  expenses: resource('expenses'),
  stockTransfers: resource('stock-transfers'),
  stockAdjustments: resource('stock-adjustments'),
  master: (type: string) => resource(`masters/${type}`),
  dashboard: () => http.get('/dashboard').then((r) => camelize(r.data)),
  approveReturn: (id: string | number) => http.post(`/sales-returns/${id}/approve`).then((r) => camelize(r.data)),
  rejectReturn: (id: string | number) => http.post(`/sales-returns/${id}/reject`).then((r) => camelize(r.data)),
}

export default api
