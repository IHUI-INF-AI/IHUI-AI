import { fetchApi } from '@/lib/api'
import type { PageData } from '@ihui/api-client'

/** 默认每页条数 */
export const ADMIN_PAGE_SIZE = 10

/**
 * 管理端通用 API 包装函数。
 *
 * 封装 fetchApi 的 success/error 分支处理:
 * 成功返回 data,失败抛 Error(由调用方 catch)。
 *
 * 替代各模块 helpers.ts 中 100 份逐字相同的 `api<T>()` 函数。
 */
export async function adminApi<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

/** 管理端列表响应类型 */
export type AdminListData<T> = PageData<T>

/** 构建 admin 列表查询参数 */
export function buildAdminQs(params: {
  page: number
  pageSize?: number
  search?: string
  searchParam?: string
  extra?: Record<string, string | undefined>
}): string {
  const { page, pageSize = ADMIN_PAGE_SIZE, search, searchParam, extra } = params
  const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (search && searchParam) qs.set(searchParam, search)
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (v !== undefined && v !== '') qs.set(k, v)
    }
  }
  return qs.toString()
}
