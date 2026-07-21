import { fetchApi } from '@/lib/api'
import type { NoteForm } from './types'

export const EMPTY_FORM: NoteForm = { title: '', content: '', isPublic: false, attachments: [] }

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
