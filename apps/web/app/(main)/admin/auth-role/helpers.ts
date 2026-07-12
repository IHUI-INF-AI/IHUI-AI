import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { AuthRoleForm } from './types'

export const RESOURCE = '/api/admin/auth-role'
export const PERM = 'auth:auth_role'
export const EMPTY: AuthRoleForm = { userId: '', roleId: '', createdAt: '' }

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userId', title: '用户ID' },
  { key: 'roleId', title: '角色ID' },
  { key: 'createdAt', title: '创建时间' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
