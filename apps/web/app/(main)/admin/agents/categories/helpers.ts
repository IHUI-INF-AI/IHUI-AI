import { fetchApi } from '@/lib/api'
import type { Category, CategoriesData, CategoryForm } from './types'

export const PAGE_SIZE = 20

export const EMPTY_FORM: CategoryForm = {
  name: '',
  description: '',
  icon: '',
  sort: '0',
  status: true,
  isPaid: false,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchCategories(params: {
  page: number
  keyword: string
}): Promise<CategoriesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.keyword) qs.set('keyword', params.keyword)
  return api<CategoriesData>(`/api/categories/list?${qs.toString()}`)
}

export function formFromCategory(cat: Category): CategoryForm {
  return {
    name: cat.name,
    description: cat.description ?? '',
    icon: cat.icon ?? '',
    sort: String(cat.sort),
    status: cat.status === '1',
    isPaid: cat.isPaid,
  }
}
