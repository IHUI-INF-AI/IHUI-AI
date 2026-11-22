// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池端点(2026-11-05 立,门 300 存量裁决 A 类)。
 *
 * 后端真源 openapi.json:273/298/334(/353 为 status 只读,端内未用):
 *  - GET    /api/account-pool
 *  - POST   /api/account-pool
 *  - PATCH  /api/account-pool/:id
 *  - DELETE /api/account-pool/:id
 *  - POST   /api/account-pool/:id/checkin
 *
 * 不解包、不 try/catch:401/续期/超时由共享 fetchApi 统一处理。
 */
import type { ApiResult } from '@ihui/types'
import { fetchApi } from '../client.js'

/** 列表过滤条件(与后端 query schema 逐字段一致) */
export interface AccountPoolListParams {
  /** 平台代码;后端对非法值静默忽略(不报错) */
  provider?: string
  enabled?: boolean
}

/** 新增账号请求体(与后端 createBodySchema 逐字段一致) */
export interface CreateAccountPoolIn {
  providerCode: string
  name: string
  token: string
  refreshToken?: string
  cookies?: unknown[]
  deviceId?: string
  machineId?: string
  enabled?: boolean
}

/** 更新账号请求体(与后端 updateBodySchema 逐字段一致) */
export interface UpdateAccountPoolIn {
  name?: string
  isEnabled?: boolean
}

/** 单账号签到状态点查响应(平台无签到引擎时 found:false + noEngine:true) */
export interface AccountPoolStatusResponse {
  found: boolean
  noEngine?: boolean
  [key: string]: unknown
}

/** 个人池概览(GET /api/account-pool/summary) */
export interface AccountPoolSummaryResponse {
  total: number
  enabled: number
}

/** 账号池列表 — GET /api/account-pool */
export async function listAccountPool<T = { list: unknown[]; total: number }>(
  params?: AccountPoolListParams,
): Promise<ApiResult<T>> {
  const query = new URLSearchParams()
  if (params?.provider) query.set('provider', params.provider)
  if (params?.enabled !== undefined) query.set('enabled', String(params.enabled))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return fetchApi<T>(`/api/account-pool${suffix}`)
}

/** 新增账号 — POST /api/account-pool */
export async function createAccountPool<T = unknown>(
  body: CreateAccountPoolIn,
): Promise<ApiResult<T>> {
  return fetchApi<T>('/api/account-pool', { method: 'POST', body: JSON.stringify(body) })
}

/** 更新账号(改名/启停)— PATCH /api/account-pool/:id */
export async function updateAccountPool<T = unknown>(
  id: string,
  body: UpdateAccountPoolIn,
): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/account-pool/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

/** 单账号签到状态点查 — GET /api/account-pool/:id/status */
export async function getAccountPoolStatus(
  id: string,
): Promise<ApiResult<AccountPoolStatusResponse>> {
  return fetchApi<AccountPoolStatusResponse>(`/api/account-pool/${encodeURIComponent(id)}/status`)
}

/** 个人池概览(移动端首页/角标)— GET /api/account-pool/summary */
export async function getAccountPoolSummary(): Promise<ApiResult<AccountPoolSummaryResponse>> {
  return fetchApi<AccountPoolSummaryResponse>('/api/account-pool/summary')
}

/** 打卡同步 — POST /api/account-pool/:id/checkin */
export async function checkinAccountPool<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/account-pool/${id}/checkin`, { method: 'POST' })
}

/** 删除账号 — DELETE /api/account-pool/:id */
export async function deleteAccountPool<T = unknown>(id: string): Promise<ApiResult<T>> {
  return fetchApi<T>(`/api/account-pool/${id}`, { method: 'DELETE' })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
