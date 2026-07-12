import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { UserForm } from './types'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const RESOURCE = '/api/admin/users'
export const PERM = 'auth:users'

export const EMPTY: UserForm = {
  nickname: '',
  avatar: '',
  gender: '',
  birthday: '',
  inviteCode: '',
  parentId: '',
  createdAt: '',
}

export const IDENTITY_OPTIONS = [
  { value: '0', label: '平民' },
  { value: '1', label: '贵族' },
  { value: '2', label: '王室' },
  { value: '3', label: '大臣' },
]

export const th = 'px-4 py-2.5 font-medium'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'uuid', title: 'UUID' },
  { key: 'nickname', title: '昵称' },
  { key: 'parentId', title: '父级ID' },
  { key: 'inviteCode', title: '邀请码' },
  { key: 'createdAt', title: '创建时间' },
]
