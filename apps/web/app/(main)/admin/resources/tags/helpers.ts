import { fetchApi } from '@/lib/api'
import type { TagItem, TagsData, TagForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchTags(params: { page: number; search: string }): Promise<TagsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('name', params.search)
  return api<TagsData>(`/api/admin/resources/tags?${qs.toString()}`)
}

export const EMPTY_FORM: TagForm = {
  pid: '',
  name: '',
  sort: '0',
  status: true,
}

export function tagToForm(item: TagItem): TagForm {
  return {
    pid: item.pid ?? '',
    name: item.name,
    sort: String(item.sort),
    status: item.status === 1,
  }
}
