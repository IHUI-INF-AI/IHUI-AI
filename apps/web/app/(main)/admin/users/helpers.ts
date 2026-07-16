import { fetchApi } from '@/lib/api'
import type { DeptItem, UsersData } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-8 rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchUsers(params: {
  page: number
  search: string
  role: string
  status: string
  deptId?: string | null
}): Promise<UsersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.role !== 'all') qs.set('role', params.role)
  if (params.status !== 'all') qs.set('status', params.status)
  if (params.deptId) qs.set('deptId', params.deptId)
  return api<UsersData>(`/api/admin/users?${qs.toString()}`)
}

export function fetchDeptList(): Promise<{ list: DeptItem[]; total: number }> {
  return api<{ list: DeptItem[]; total: number }>('/api/admin/dept/list')
}
