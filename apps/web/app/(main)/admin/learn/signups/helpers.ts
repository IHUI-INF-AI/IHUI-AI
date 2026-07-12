import { fetchApi } from '@/lib/api'

export const PAGE_SIZE = 20

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function statusBadgeClass(status: number): string {
  switch (status) {
    case 1:
      return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
    case 2:
      return 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
    case 3:
      return 'bg-primary/10 text-primary'
    default:
      return 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
  }
}

export function statusDotClass(status: number): string {
  switch (status) {
    case 1:
      return 'bg-emerald-500'
    case 2:
      return 'bg-rose-500'
    case 3:
      return 'bg-primary'
    default:
      return 'bg-amber-500'
  }
}
