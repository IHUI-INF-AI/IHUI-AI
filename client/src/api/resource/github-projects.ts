/**
 * GitHub 项目资源 API
 * 对接后端: resource/github-projects 模块
 * 路由前缀: /api/v1/resource/github-projects
 *
 * 后端列表响应为 { code, msg, data: { list, total, page, size } },
 * 本文件统一转换为 { records, total } 以适配 useAdminTable 默认提取器。
 * 注意: 后端 create/update 接口均使用 Query 参数传值。
 */
import http from '@/utils/request'
import type { ApiResponse, PaginationResponse } from '@/types'

export interface GithubProjectListParams {
  page?: number
  limit?: number
  keyword?: string
  category?: string
  language?: string
  [k: string]: unknown
}

export interface GithubProject {
  pid: number
  name: string
  url: string
  stars: number
  category?: string
  description?: string
  language?: string
  createTime?: string | null
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// GitHub 项目 CRUD
// ===========================================================================

/** GitHub 项目列表 */
export async function githubProjectList(params: GithubProjectListParams = {}): Promise<ApiResponse<PaginationResponse<GithubProject>>> {
  const res = await http.get('/api/v1/resource/github-projects/list', {
    params: {
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      keyword: params.keyword || undefined,
      category: params.category || undefined,
      language: params.language || undefined,
    },
  })
  const body = (res as any).data || {}
  const payload = body.data || {}
  return toListResult(payload.list || [], payload.total || 0, body.msg) as unknown as ApiResponse<PaginationResponse<GithubProject>>
}

/** GitHub 项目详情 */
export async function githubProjectDetail(pid: number): Promise<ApiResponse<GithubProject | null>> {
  const res = await http.get(`/api/v1/resource/github-projects/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<GithubProject | null>
}

/** 新增 GitHub 项目 (后端使用 Query 参数) */
export async function githubProjectCreate(params: {
  name: string
  url: string
  stars?: number
  category?: string
  description?: string
  language?: string
}): Promise<ApiResponse<GithubProject>> {
  const res = await http.post('/api/v1/resource/github-projects', null, {
    params: {
      name: params.name,
      url: params.url,
      stars: params.stars ?? 0,
      category: params.category || undefined,
      description: params.description || undefined,
      language: params.language || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<GithubProject>
}

/** 修改 GitHub 项目 (后端使用 Query 参数) */
export async function githubProjectUpdate(pid: number, params: {
  name?: string
  url?: string
  stars?: number
  category?: string
  description?: string
  language?: string
}): Promise<ApiResponse<GithubProject>> {
  const res = await http.put(`/api/v1/resource/github-projects/${pid}`, null, {
    params: {
      name: params.name || undefined,
      url: params.url || undefined,
      stars: params.stars,
      category: params.category || undefined,
      description: params.description || undefined,
      language: params.language || undefined,
    },
  })
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<GithubProject>
}

/** 删除 GitHub 项目 */
export async function githubProjectDelete(pid: number): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/resource/github-projects/${pid}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const githubProjectsApi = {
  githubProjectList,
  githubProjectDetail,
  githubProjectCreate,
  githubProjectUpdate,
  githubProjectDelete,
}

export default githubProjectsApi