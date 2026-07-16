import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { CirclePost, PostFilter } from './types'

export const PAGE_SIZE = 20

export interface DynamicsListData {
  list: CirclePost[]
  total: number
  page: number
  pageSize: number
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export async function fetchDynamics(filter: PostFilter): Promise<DynamicsListData> {
  const qs = new URLSearchParams({
    page: String(filter.page),
    pageSize: String(filter.pageSize),
  })
  if (filter.keyword) qs.set('keyword', filter.keyword)
  if (filter.status !== 'all') qs.set('status', filter.status)
  return api<DynamicsListData>(`/api/admin/circles/posts?${qs.toString()}`)
}

export async function deleteDynamic(id: string): Promise<void> {
  await api<null>(`/api/admin/circles/posts/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
