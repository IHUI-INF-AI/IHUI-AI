import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { AuthRoleForm } from './types'

export const RESOURCE = '/api/admin/auth-role'
export const PERM = 'auth:auth_role'
export const EMPTY: AuthRoleForm = { userId: '', roleId: '', createdAt: '' }

// 2026-08-30 角色权限点配置:权限点列表 / 角色-权限关联资源
export const PERMISSIONS_RESOURCE = '/api/admin/permissions'
export const ROLE_PERMISSIONS_RESOURCE = '/api/admin/role-permissions'

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
