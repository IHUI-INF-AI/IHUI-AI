import { fetchApi } from '@/lib/api'
import type { Category, CategoryForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: CategoryForm = {
  pid: '',
  name: '',
  sort: '0',
  status: true,
}

export function categoryToForm(item: Category): CategoryForm {
  return {
    pid: item.pid ?? '',
    name: item.name,
    sort: String(item.sort),
    status: item.status === 1,
  }
}
