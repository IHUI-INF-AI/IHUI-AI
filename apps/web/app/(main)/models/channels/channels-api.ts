/**
 * 中转站 Key 池管理 API 封装(P0-5c,2026-07-30 立)。
 *
 * 对接后端 /api/admin/relay/key-pool CRUD,复用 @/lib/api 的 fetchApi(走 @ihui/api-client,
 * 自动注入鉴权 token + 401 弹窗),符合 AGENTS.md §3 共享层优先。
 */
import { fetchApi } from '@/lib/api'

export type RelayKeyPoolHealthStatus = 'unknown' | 'healthy' | 'degraded' | 'down'

export interface RelayKeyPoolItem {
  id: string
  providerCode: string
  name: string
  keyPrefix: string | null
  priority: number
  weight: number
  isEnabled: boolean
  healthStatus: RelayKeyPoolHealthStatus
  healthCheckedAt: string | null
  lastErrorMessage: string | null
  balanceCents: number | null
  remark: string | null
  createdAt: string
  updatedAt: string
}

export interface RelayKeyPoolListResponse {
  list: RelayKeyPoolItem[]
  total: number
  page: number
  pageSize: number
}

export interface KeyPoolListParams {
  page?: number
  pageSize?: number
  search?: string
  provider?: string
  enabled?: boolean
}

export interface KeyPoolCreateInput {
  providerCode: string
  name: string
  apiKey: string
  priority?: number
  weight?: number
  isEnabled?: boolean
  remark?: string
}

export interface KeyPoolUpdateInput {
  name?: string
  priority?: number
  weight?: number
  isEnabled?: boolean
  remark?: string
}

export interface KeyPoolToggleResult {
  id: string
  isEnabled: boolean
}

export interface KeyPoolHealthResult {
  id: string
  healthStatus: string
  healthCheckedAt: string
}

function buildQuery(params: KeyPoolListParams): string {
  const sp = new URLSearchParams()
  if (params.page) sp.set('page', String(params.page))
  if (params.pageSize) sp.set('pageSize', String(params.pageSize))
  if (params.search) sp.set('search', params.search)
  if (params.provider) sp.set('provider', params.provider)
  if (typeof params.enabled === 'boolean') sp.set('enabled', String(params.enabled))
  const s = sp.toString()
  return s ? `?${s}` : ''
}

export async function fetchKeyPool(
  params: KeyPoolListParams = {},
): Promise<RelayKeyPoolListResponse> {
  const r = await fetchApi<RelayKeyPoolListResponse>(
    `/api/admin/relay/key-pool${buildQuery(params)}`,
  )
  if (!r.success) throw new Error(r.error || '加载 Key 池失败')
  return r.data
}

export async function createKeyPool(data: KeyPoolCreateInput): Promise<RelayKeyPoolItem> {
  const r = await fetchApi<RelayKeyPoolItem>('/api/admin/relay/key-pool', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.success) throw new Error(r.error || '添加 Key 失败')
  return r.data
}

export async function updateKeyPool(
  id: string,
  data: KeyPoolUpdateInput,
): Promise<RelayKeyPoolItem> {
  const r = await fetchApi<RelayKeyPoolItem>(
    `/api/admin/relay/key-pool/${encodeURIComponent(id)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    },
  )
  if (!r.success) throw new Error(r.error || '更新 Key 失败')
  return r.data
}

export async function deleteKeyPool(id: string): Promise<void> {
  const r = await fetchApi<{ id: string; deleted: boolean }>(
    `/api/admin/relay/key-pool/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!r.success) throw new Error(r.error || '删除 Key 失败')
}

export async function toggleKeyPool(id: string): Promise<KeyPoolToggleResult> {
  const r = await fetchApi<KeyPoolToggleResult>(
    `/api/admin/relay/key-pool/${encodeURIComponent(id)}/toggle`,
    { method: 'POST' },
  )
  if (!r.success) throw new Error(r.error || '切换状态失败')
  return r.data
}

export async function checkKeyPoolHealth(id: string): Promise<KeyPoolHealthResult> {
  const r = await fetchApi<KeyPoolHealthResult>(
    `/api/admin/relay/key-pool/${encodeURIComponent(id)}/health`,
    { method: 'POST' },
  )
  if (!r.success) throw new Error(r.error || '健康检查失败')
  return r.data
}
