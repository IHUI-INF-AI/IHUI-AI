import { fetchApi } from '@/lib/api'
import type { OfflineRecord, RecordForm } from './types'

export const EMPTY_FORM: RecordForm = {
  type: '',
  title: '',
  description: '',
  hours: '',
  occurredAt: '',
}

export const TYPE_COLORS = [
  'bg-primary/10 text-primary',
  'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'bg-purple-500/10 text-purple-600 dark:text-purple-400',
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function recordToForm(record: OfflineRecord): RecordForm {
  return {
    type: record.type,
    title: record.title,
    description: record.description ?? '',
    hours: record.hours !== null && record.hours !== undefined ? String(record.hours) : '',
    occurredAt: record.occurredAt ? record.occurredAt.slice(0, 10) : '',
  }
}
