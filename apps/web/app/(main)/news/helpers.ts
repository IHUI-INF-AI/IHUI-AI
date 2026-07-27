import { fetchApi } from '@/lib/api'
import { formatDateOnly } from '@/lib/date-utils'

export const PAGE_SIZE = 20

export async function api<T>(url: string): Promise<T> {
  const r = await fetchApi<T>(url)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fmtDate(v?: string | null): string {
  return formatDateOnly(v)
}
