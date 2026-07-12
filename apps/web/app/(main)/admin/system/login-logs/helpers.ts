import { fetchApi } from '@/lib/api'
import { type ExportColumn } from '@/lib/export-utils'
import type { LoginLogSearch } from './types'

export const PAGE_SIZE = 15
export const RESOURCE = '/api/admin/system/login-logs'

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_SEARCH: LoginLogSearch = {
  userUuid: '',
  platform: '',
  location: '',
  startTime: '',
  endTime: '',
}

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户' },
  { key: 'loginType', title: '登录类型' },
  { key: 'platform', title: '平台' },
  { key: 'ip', title: 'IP' },
  { key: 'location', title: '位置' },
  { key: 'loginTime', title: '登录时间' },
  { key: 'message', title: '消息' },
]
