import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { AuthAccountForm, AuthAccountSearch } from './types'

export const RESOURCE = '/api/admin/auth-accounts'
export const PERM = 'auth:auth_accounts'

export const EMPTY_FORM: AuthAccountForm = {
  userUuid: '',
  platform: '',
  openId: '',
  platformName: '',
  accessToken: '',
  refreshToken: '',
  expiresAt: '',
  nickname: '',
  avatar: '',
  bindTime: '',
}

export const EMPTY_SEARCH: AuthAccountSearch = {
  userUuid: '',
  platform: '',
  openId: '',
  platformName: '',
  nickname: '',
}

export const th = 'px-4 py-2.5 font-medium'

export const EXPORT_COLS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'platform', title: '平台' },
  { key: 'openId', title: 'OpenID' },
  { key: 'platformName', title: '平台名称' },
  { key: 'nickname', title: '昵称' },
  { key: 'expiresAt', title: '过期时间' },
  { key: 'bindTime', title: '绑定时间' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
