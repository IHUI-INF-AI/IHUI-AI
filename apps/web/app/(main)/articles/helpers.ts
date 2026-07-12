import { fetchApi } from '@/lib/api'

export const PAGE_SIZE = 20

export async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fmtDate(v: string | null | undefined, locale: string): string {
  if (!v) return '-'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '-' : new Intl.DateTimeFormat(locale).format(d)
}
