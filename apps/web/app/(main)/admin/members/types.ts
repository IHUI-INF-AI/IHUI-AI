import { fetchApi } from '@/lib/api'
import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass } from '@/lib/form-styles'
import type {
  AdminCompaniesData,
  AdminImportResult,
  AdminImportResultItem,
  AdminMember,
  AdminMemberLevel,
  AdminMemberStatistics,
  AdminMembersData,
  ApiResult,
} from '@ihui/types'

export { api, selectClass }

export type Member = AdminMember
export type MembersData = AdminMembersData
export type MemberStatistics = AdminMemberStatistics
export type MemberLevel = AdminMemberLevel
export type CompaniesData = AdminCompaniesData
export type ImportResultItem = AdminImportResultItem
export type ImportResult = AdminImportResult

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

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
