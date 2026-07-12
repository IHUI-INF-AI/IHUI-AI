import { fetchApi } from '@/lib/api'
import type { ExportColumn } from '@/lib/export-utils'
import type { PostForm } from './types'

export const RESOURCE = '/api/admin/system/posts'
export const PAGE_SIZE = 15

export const th = 'px-4 py-2.5 text-left font-medium text-xs uppercase text-muted-foreground'
export const inputCls =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'
export const textareaCls =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY: PostForm = { postCode: '', postName: '', postSort: 0, status: 0, remark: '' }

export const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'id', title: 'ID' },
  { key: 'postCode', title: '岗位编码' },
  { key: 'postName', title: '岗位名称' },
  { key: 'postSort', title: '排序' },
  { key: 'status', title: '状态', formatter: (v) => (Number(v) === 0 ? '正常' : '停用') },
  { key: 'remark', title: '备注' },
  { key: 'createdAt', title: '创建时间' },
]

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}
