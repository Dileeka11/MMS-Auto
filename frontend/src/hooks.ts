/* NMS-Auto â€” small fetch hooks used by every screen.
   Keeps screens free of repetitive useState + useEffect plumbing. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

export function useResource<T = any>(load: () => Promise<T[]>) {
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  // Pin the loader so an inline arrow at the callsite (new identity every render)
  // doesn't re-trigger the fetch effect on every render.
  const loadRef = useRef(load)
  loadRef.current = load

  const refresh = useCallback(() => {
    setLoading(true)
    return loadRef.current()
      .then((r) => { setRows(r); setError(null); return r })
      .catch((e) => { setError(e); return [] as T[] })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { refresh() }, [refresh])
  return { rows, setRows, loading, error, refresh }
}

/** Fetch a master-file list and return just the names â€” handy for <select> dropdowns. */
export function useMasterNames(type: string) {
  const [names, setNames] = useState<string[]>([])
  useEffect(() => {
    let alive = true
    api.master(type).list()
      .then((rows: any[]) => { if (alive) setNames(rows.map((r) => r.name).filter(Boolean)) })
      .catch(() => { if (alive) setNames([]) })
    return () => { alive = false }
  }, [type])
  return names
}
