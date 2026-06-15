/* Axios client for the Laravel API. Base URL is proxied to http://localhost:8000 in dev (see vite.config.ts). */
import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
})

http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('mms-token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

http.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && localStorage.getItem('mms-token')) {
      localStorage.removeItem('mms-token')
      window.location.reload()
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
    list: () => http.get(`/${name}`).then((r) => camelize(r.data) as T[]),
    get: (id: string | number) => http.get(`/${name}/${id}`).then((r) => camelize(r.data) as T),
    create: (body: Partial<T>) => http.post(`/${name}`, snakeize(body)).then((r) => camelize(r.data) as T),
    update: (id: string | number, body: Partial<T>) => http.put(`/${name}/${id}`, snakeize(body)).then((r) => camelize(r.data) as T),
    remove: (id: string | number) => http.delete(`/${name}/${id}`).then((r) => r.data),
  }
}

export interface AuthUser { id: number; name: string; email: string }

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
  items: resource('items'),
  customers: resource('customers'),
  reps: resource('sales-reps'),
  users: resource('users'),
  purchaseOrders: resource('purchase-orders'),
  shipments: {
    ...resource('shipments'),
    byPo: (poCode: string) => http.get('/shipments', { params: { po: poCode } }).then((r) => camelize(r.data)),
  },
  grns: resource('grns'),
  tracking: () => http.get('/po-tracking').then((r) => camelize(r.data)),
  quotations: resource('quotations'),
  invoices: resource('invoices'),
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
