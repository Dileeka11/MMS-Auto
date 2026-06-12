/* Axios client for the Laravel API.
   Base URL is proxied to http://localhost:8000 in dev (see vite.config.ts).
   Screens currently render from data.ts; swap these helpers in to go live. */
import axios from 'axios'

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { Accept: 'application/json' },
})

// attach bearer token if present
http.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('mms-token')
  if (t) cfg.headers.Authorization = `Bearer ${t}`
  return cfg
})

// Generic CRUD helper used by the master-file modules
export function resource<T = any>(name: string) {
  return {
    list: () => http.get<T[]>(`/${name}`).then((r) => r.data),
    get: (id: string | number) => http.get<T>(`/${name}/${id}`).then((r) => r.data),
    create: (body: Partial<T>) => http.post<T>(`/${name}`, body).then((r) => r.data),
    update: (id: string | number, body: Partial<T>) => http.put<T>(`/${name}/${id}`, body).then((r) => r.data),
    remove: (id: string | number) => http.delete(`/${name}/${id}`).then((r) => r.data),
  }
}

export const api = {
  items: resource('items'),
  customers: resource('customers'),
  reps: resource('sales-reps'),
  purchaseOrders: resource('purchase-orders'),
  grns: resource('grns'),
  quotations: resource('quotations'),
  invoices: resource('invoices'),
  returns: resource('sales-returns'),
  receipts: resource('receipts'),
  expenses: resource('expenses'),
  // masters are addressed by a single endpoint with a "type" segment
  master: (type: string) => resource(`masters/${type}`),
  dashboard: () => http.get('/dashboard').then((r) => r.data),
  approveReturn: (id: string) => http.post(`/sales-returns/${id}/approve`).then((r) => r.data),
  rejectReturn: (id: string) => http.post(`/sales-returns/${id}/reject`).then((r) => r.data),
}

export default api
