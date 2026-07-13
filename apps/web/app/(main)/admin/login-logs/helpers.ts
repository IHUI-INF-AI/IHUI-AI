import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { LoginLog, LoginLogForm, LoginLogSearch } from './types'

export const PAGE_SIZE = 10
export const RESOURCE = '/api/admin/system/login-logs'
export const PERM = 'auth:login_logs'

export const th = 'px-4 py-2.5 font-medium'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: LoginLogForm = {
  userUuid: '',
  loginType: '',
  platform: '',
  ip: '',
  location: '',
  userAgent: '',
  loginTime: '',
  message: '',
}

export const EMPTY_SEARCH: LoginLogSearch = {
  userUuid: '',
  platform: '',
  location: '',
  loginTime: '',
}

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'loginType', title: '登录类型' },
  { key: 'platform', title: '平台' },
  { key: 'ip', title: 'IP' },
  { key: 'location', title: '位置' },
  { key: 'userAgent', title: 'UserAgent' },
  { key: 'loginTime', title: '登录时间' },
  { key: 'message', title: '消息' },
]

export function loginLogToForm(item: LoginLog): LoginLogForm {
  return {
    userUuid: item.userUuid ?? '',
    loginType: item.loginType ?? '',
    platform: item.platform ?? '',
    ip: item.ip ?? '',
    location: item.location ?? '',
    userAgent: item.userAgent ?? '',
    loginTime: item.loginTime ?? '',
    message: item.message ?? '',
  }
}

export function buildQueryParams(
  search: LoginLogSearch,
  page: number,
  pageSize: number,
): Record<string, string> {
  const p: Record<string, string> = { pageNum: String(page), pageSize: String(pageSize) }
  Object.entries(search).forEach(([k, v]) => {
    if (v.trim()) p[k] = v.trim()
  })
  return p
}
