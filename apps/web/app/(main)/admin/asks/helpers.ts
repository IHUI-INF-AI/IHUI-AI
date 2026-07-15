import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { AskForm, AskItem, AsksListData } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: AskForm = {
  title: '',
  content: '',
  tags: '',
  status: 1,
  isResolved: false,
}

export const STATUS_META: Record<number, { label: string; cls: string }> = {
  [-1]: { label: 'statusDeleted', cls: 'bg-red-500/10 text-red-600 dark:text-red-400' },
  0: { label: 'statusHidden', cls: 'bg-muted text-muted-foreground' },
  1: { label: 'statusApproved', cls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' },
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export async function fetchAsks(params: {
  page: number
  pageSize?: number
  search?: string
  resolved?: boolean
}): Promise<AsksListData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? PAGE_SIZE),
  })
  if (params.search) qs.set('search', params.search)
  if (params.resolved !== undefined) qs.set('resolved', String(params.resolved))
  // 复用 /api/asks 公共列表端点(后端目前未提供 /admin/asks 列表)
  return api<AsksListData>(`/api/asks?${qs.toString()}`)
}

export function askToForm(item: AskItem): AskForm {
  return {
    title: item.title,
    content: item.content,
    tags: (item.tags ?? []).join(', '),
    status: item.status,
    isResolved: item.isResolved,
  }
}

export function parseTags(tags: string): string[] {
  return tags
    .split(/[,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
