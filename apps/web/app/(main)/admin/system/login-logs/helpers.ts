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

/** i18n key prefix: admin.system */
export function getExportColumns(t: (key: string) => string): ExportColumn[] {
  return [
    { key: 'id', title: 'ID' },
    { key: 'userUuid', title: t('loginLogs.table.user') },
    { key: 'loginType', title: t('loginLogs.export.loginType') },
    { key: 'platform', title: t('loginLogs.table.platform') },
    { key: 'ip', title: 'IP' },
    { key: 'location', title: t('loginLogs.table.location') },
    { key: 'loginTime', title: t('loginLogs.table.loginTime') },
    { key: 'message', title: t('loginLogs.table.message') },
  ]
}
