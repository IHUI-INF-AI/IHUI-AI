import { fetchApi } from '@/lib/api'
import type { ApiResult } from '@ihui/types'

export interface Member {
  id: string
  username: string | null
  mobile: string | null
  email: string | null
  avatar: string | null
  nickname: string | null
  gender: number
  status: number
  levelId: string | null
  companyId: string | null
  departmentId: string | null
  growthValue: number
  createdAt: string
}

export interface MembersData {
  list: Member[]
  total: number
  page: number
  pageSize: number
}

export interface MemberStatistics {
  total: number
  active: number
  pending: number
  sealed: number
}

export interface MemberLevel {
  id: string
  name: string
  growthValue: number
  discount: string
  sort: number
}

export interface CompaniesData {
  list: unknown[]
  total: number
  page: number
  pageSize: number
}

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchMembers(params: { page: number; search: string }): Promise<MembersData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) {
    if (/^\d+$/.test(params.search)) {
      qs.set('mobile', params.search)
    } else {
      qs.set('username', params.search)
    }
  }
  return api<MembersData>(`/api/admin/members?${qs.toString()}`)
}

export interface MemberForm {
  username: string
  password: string
  nickname: string
  mobile: string
  email: string
  gender: string
  levelId: string
  status: string
}

export const EMPTY_FORM: MemberForm = {
  username: '',
  password: '',
  nickname: '',
  mobile: '',
  email: '',
  gender: '0',
  levelId: '',
  status: '1',
}

export type MemberAction = 'approved' | 'reject' | 'seal' | 'unseal'

export function statusBadgeClass(status: number) {
  if (status === 1) return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500'
  if (status === 2) return 'bg-rose-500/10 text-rose-600 dark:text-rose-500'
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
}

export function statusDotClass(status: number) {
  if (status === 1) return 'bg-emerald-500'
  if (status === 2) return 'bg-rose-500'
  return 'bg-amber-500'
}

export interface ImportResultItem {
  serialNum: number
  rowNum: number
  success: boolean
  message: string
  companyName?: string
  memberName?: string
  memberMobile?: string
  postName?: string
  lessonName?: string
}

export interface ImportResult {
  successCount: number
  failureCount: number
  resultItemList: ImportResultItem[]
}

export async function batchImportMembers(file: File): Promise<ApiResult<ImportResult>> {
  // 统一文件上传,后端 /api/admin/members/batch-import 根据扩展名解析 CSV/Excel,返回 { imported, failed, errors }
  const form = new FormData()
  form.append('file', file)
  const result = await fetchApi<{ imported: number; failed: number; errors: ImportResultItem[] }>(
    '/api/admin/members/batch-import',
    {
      method: 'POST',
      body: form,
    },
  )
  if (!result.success) {
    return result
  }
  const data = result.data
  return {
    success: true,
    data: {
      successCount: data.imported ?? 0,
      failureCount: data.failed ?? 0,
      resultItemList: data.errors ?? [],
    },
  }
}
