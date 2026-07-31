import { fetchApi } from '@/lib/api'

export const RESOURCE = '/api/admin/system/operation-logs'

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'

export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** Maps business type number to i18n key (prefix: admin.system) */
export const BIZ_TYPE: Record<number, string> = {
  0: 'operationLogs.bizType.other',
  1: 'operationLogs.bizType.insert',
  2: 'operationLogs.bizType.update',
  3: 'operationLogs.bizType.delete',
  4: 'operationLogs.bizType.grant',
  5: 'operationLogs.bizType.export',
  6: 'operationLogs.bizType.import',
  7: 'operationLogs.bizType.forceLogout',
  8: 'operationLogs.bizType.genCode',
  9: 'operationLogs.bizType.cleanData',
}

/** Maps status number to { label: i18n key, cls: css class } */
export const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: 'operationLogs.status.success', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: 'operationLogs.status.failed', cls: 'bg-red-500/10 text-red-600' },
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
