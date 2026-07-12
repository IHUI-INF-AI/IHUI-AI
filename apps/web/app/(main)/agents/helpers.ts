import { fetchApi } from '@/lib/api'
import type { AgentsData, CategoriesData } from './types'

export const PAGE_SIZE = 12

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchAgents(params: {
  page: number
  keyword: string
  categoryId: string
}): Promise<AgentsData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(PAGE_SIZE),
    status: 'published',
  })
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  return api<AgentsData>(`/api/agents/list?${qs.toString()}`)
}

export function fetchCategories(): Promise<CategoriesData> {
  return api<CategoriesData>(`/api/categories/list?page=1&pageSize=100&status=1`)
}
