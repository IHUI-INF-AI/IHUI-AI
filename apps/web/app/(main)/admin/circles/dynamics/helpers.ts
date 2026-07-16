import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { CirclePost, CirclePostStatus, CirclePostComment, PostFilter } from './types'

export const PAGE_SIZE = 20

export interface DynamicsListData {
  list: CirclePost[]
  total: number
  page: number
  pageSize: number
}

export interface CommentsListData {
  list: CirclePostComment[]
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

export async function auditDynamic(
  id: string,
  status: Exclude<CirclePostStatus, 'deleted'>,
): Promise<void> {
  await api<{ post: { id: string; status: CirclePostStatus } }>(
    `/api/admin/circles/posts/${encodeURIComponent(id)}/audit`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    },
  )
}

export async function fetchDynamicComments(
  id: string,
  page: number,
  pageSize: number,
): Promise<CommentsListData> {
  const qs = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  })
  return api<CommentsListData>(
    `/api/admin/circles/posts/${encodeURIComponent(id)}/comments?${qs.toString()}`,
  )
}
