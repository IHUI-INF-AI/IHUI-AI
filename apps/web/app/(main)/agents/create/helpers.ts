import { fetchApi } from '@/lib/api'
import type { AgentForm } from './types'

export const EMPTY_FORM: AgentForm = {
  name: '',
  description: '',
  avatar: '',
  cover: '',
  categoryId: '',
  status: 'pending',
  price: '0',
  isFree: true,
  sort: '0',
  remark: '',
}

export const STATUS_OPTIONS = ['pending', 'published', 'rejected', 'offline']

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const selectClass =
  'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
