import { fetchApi } from '@/lib/api'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const fmt = (v: string) => {
  const d = new Date(v)
  return Number.isNaN(d.getTime())
    ? '-'
    : new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(d)
}
