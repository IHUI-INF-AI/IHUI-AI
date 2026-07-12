import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { AuthUserVip, AuthUserVipForm, AuthUserVipSearch } from './types'

export const RESOURCE = '/api/admin/auth-user-vip'
export const PERM = 'auth:auth_user_vip'
export const PAGE_SIZE = 10

export const EMPTY_FORM: AuthUserVipForm = {
  userUuid: '',
  vipId: '',
  progress: '',
  creator: '',
  createdTime: '',
  isValid: '',
}

export const EMPTY_SEARCH: AuthUserVipSearch = {
  userUuid: '',
  vipId: '',
  progress: '',
  isValid: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'vipId', title: 'VIP ID' },
  { key: 'progress', title: '进度' },
  { key: 'creator', title: '创建者' },
  { key: 'createdTime', title: '创建时间' },
  { key: 'isValid', title: '是否有效' },
]

export const th = 'px-4 py-2.5 font-medium'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function buildQuery(search: AuthUserVipSearch, page: number, pageSize: number) {
  const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
  Object.entries(search).forEach(([k, v]) => {
    if (v.trim()) p[k] = v.trim()
  })
  return p
}

export function authUserVipToForm(item: AuthUserVip): AuthUserVipForm {
  return {
    userUuid: item.userUuid ?? '',
    vipId: item.vipId ?? '',
    progress: item.progress ?? '',
    creator: item.creator ?? '',
    createdTime: item.createdTime ?? '',
    isValid: String(item.isValid ?? ''),
  }
}
