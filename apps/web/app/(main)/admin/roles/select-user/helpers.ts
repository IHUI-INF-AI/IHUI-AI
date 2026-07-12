import { fetchApi } from '@/lib/api'

export const PAGE_SIZE = 15

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'

export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
