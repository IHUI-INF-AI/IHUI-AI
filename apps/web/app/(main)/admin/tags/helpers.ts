import { fetchApi } from '@/lib/api'
import type { TagItem, TagForm } from './types'

export const TAG_COLORS = [
  'text-primary',
  'text-emerald-600 dark:text-emerald-400',
  'text-amber-600 dark:text-amber-400',
  'text-rose-600 dark:text-rose-400',
  'text-violet-600 dark:text-violet-400',
  'text-cyan-600 dark:text-cyan-400',
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchTags(): Promise<TagItem[]> {
  const data = await api<{ tags: TagItem[] }>('/api/tags')
  return data?.tags ?? []
}

export const EMPTY_FORM: TagForm = { name: '', description: '', color: '' }

export function tagToForm(item: TagItem): TagForm {
  return {
    name: item.name,
    description: item.description ?? '',
    color: item.color ?? '',
  }
}

export function getFontSize(tags: TagItem[]): (count: number) => number {
  const counts = tags.map((x) => x.usageCount)
  const max = Math.max(1, ...counts)
  const min = Math.min(max, ...counts)
  return (count: number) => {
    if (max === min) return 15
    return Math.round(12 + ((count - min) / (max - min)) * 14)
  }
}
