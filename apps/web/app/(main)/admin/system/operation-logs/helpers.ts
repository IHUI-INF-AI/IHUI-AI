import { fetchApi } from '@/lib/api'

export const RESOURCE = '/api/admin/system/operation-logs'

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'

export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const BIZ_TYPE: Record<number, string> = {
  0: '其他',
  1: '新增',
  2: '修改',
  3: '删除',
  4: '授权',
  5: '导出',
  6: '导入',
  7: '强退',
  8: '生成代码',
  9: '清空数据',
}

export const STATUS_LABEL: Record<number, { label: string; cls: string }> = {
  0: { label: '成功', cls: 'bg-emerald-500/10 text-emerald-600' },
  1: { label: '失败', cls: 'bg-red-500/10 text-red-600' },
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
