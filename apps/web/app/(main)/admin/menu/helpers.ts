import { fetchApi } from '@/lib/api'
import type { MenuItem, MenuForm } from './types'

export const PAGE_SIZE = 20

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: MenuForm = {
  name: '',
  icon: '',
  path: '',
  sort: 0,
  parentId: null,
  visible: true,
}

export function menuToForm(m: MenuItem): MenuForm {
  return {
    name: m.name,
    icon: m.icon,
    path: m.path,
    sort: m.sort,
    parentId: m.parentId,
    visible: m.visible,
  }
}
