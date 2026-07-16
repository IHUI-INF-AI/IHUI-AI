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

export function parseCsvToMembers(csv: string): Array<Record<string, unknown>> {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0)
  const headerLine = lines[0]
  if (!headerLine || lines.length < 2) return []
  const headers = headerLine.split(',').map((h) => h.trim())
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',')
    const row: Record<string, unknown> = { serialNum: idx + 1, rowNum: idx + 2 }
    headers.forEach((h, i) => {
      const v = values[i]?.trim() ?? ''
      if (h === 'gender' || h === 'status') {
        row[h] = v === '' ? undefined : Number(v)
      } else {
        row[h] = v
      }
    })
    return row
  })
}

export async function batchUploadMembers(file: File): Promise<ApiResult<ImportResult>> {
  // 方案:CSV 解析 + JSON 数组提交,后端 /api/members/batch-upload 返回 { imported, failed, errors }
  // TODO: 若需支持 Excel xlsx 格式,后端需补 multipart /api/members/import/excel 接口
  const text = await file.text()
  const members = parseCsvToMembers(text)
  const result = await fetchApi<{ imported: number; failed: number; errors: ImportResultItem[] }>(
    '/api/members/batch-upload',
    {
      method: 'POST',
      body: JSON.stringify({ members }),
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
      failureCount: data.failed ?? Math.max(0, members.length - (data.imported ?? 0)),
      resultItemList: data.errors ?? [],
    },
  }
}
