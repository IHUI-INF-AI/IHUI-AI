import { fetchApi } from '@/lib/api'

export interface KBCategory {
  id: string
  name: string
}

export interface KBArticle {
  id: string
  title: string
  summary?: string | null
  content: string
  categoryId?: string | null
  tags?: string[]
}

export interface KBForm {
  title: string
  summary: string
  content: string
  categoryId: string
  tags: string[]
}

export const EMPTY_KB_FORM: KBForm = {
  title: '',
  summary: '',
  content: '',
  categoryId: '',
  tags: [],
}

export const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
