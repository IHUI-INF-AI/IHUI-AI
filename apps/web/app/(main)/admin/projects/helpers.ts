import { fetchApi } from '@/lib/api'
import type { AdminProject, ProjectForm } from './types'

export const PAGE_SIZE = 12
export const STATUS_OPTS = [0, 1, 2]
export const STATUS_BADGE: Record<number, string> = {
  0: 'bg-red-500/10 text-red-600 dark:text-red-500',
  1: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500',
  2: 'bg-amber-500/10 text-amber-600 dark:text-amber-500',
}

export const EMPTY_FORM: ProjectForm = {
  userId: '',
  name: '',
  description: '',
  status: 1,
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function projectToForm(p: AdminProject): ProjectForm {
  return {
    userId: p.userId,
    name: p.name,
    description: p.description ?? '',
    status: p.status,
  }
}
