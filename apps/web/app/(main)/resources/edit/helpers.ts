import { fetchApi } from '@/lib/api'
import type { ResourceType } from './types'

export const selectClass =
  'h-9 rounded-md border border-input bg-transparent px-2 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full'

export const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'other', label: '其他' },
  { value: 'word', label: 'Word' },
  { value: 'excel', label: 'Excel' },
  { value: 'ppt', label: 'PPT' },
  { value: 'pdf', label: 'PDF' },
  { value: 'image', label: '图片' },
  { value: 'txt', label: 'TXT' },
  { value: 'file', label: '文件' },
]

export function parseIdList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function toIdListString(ids?: string[] | null): string {
  return (ids ?? []).filter(Boolean).join(', ')
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
