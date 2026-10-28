// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 统一记忆读写端点(2026-10-21 立,G-924 收口:
 * apps/cli 记忆模块两处直连后端改走 api-client)。
 *
 * 对齐 apps/api /api/memory 路由(P0-3 三端记忆同步中枢):
 *  - listMemories  GET  /api/memory?scope=&sessionId=&projectKey=  查询当前用户记忆
 *  - createMemory  POST /api/memory                                写入一条记忆(后端生成 id/时间)
 *
 * 传输统一走 fetchApi(令牌 / CSRF / 超时 / 重试 / 包络校验由本包统一托管)。
 * 本端点只负责契约形状与防御性解包;SSRF 信任(127.0.0.1 自托管)由调用方
 * UnifiedMemoryClient 在调用前用 assertSafeFetchUrl 守门(信任态是其实例态)。
 */

import { fetchApi } from '../client.js'
import type { ApiResult, MemoryEntry as UnifiedMemoryEntry, MemoryScope } from '@ihui/types'

/** 列表查询参数(apiBaseUrl 由调用方注入,沿用 UnifiedMemoryClient 的本地自托管基址) */
export interface ListMemoriesParams {
  apiBaseUrl: string
  userId: string
  scope?: MemoryScope
  sessionId?: string
  projectKey?: string
}

/** 创建入参(扁平,与后端 createEntrySchema 对齐) */
export interface CreateMemoryInput {
  apiBaseUrl: string
  userId: string
  entry: Omit<UnifiedMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>
}

/** 从 fetchApi 解出的 data 中防御性提取 entries 数组(兼容 {entries} / {data:{entries}} / 裸数组 / 整段包络) */
function unwrapEntries(raw: unknown): UnifiedMemoryEntry[] {
  if (raw === null || raw === undefined || typeof raw !== 'object') return []
  const o = raw as Record<string, unknown>
  if (Array.isArray(o.entries)) return o.entries as UnifiedMemoryEntry[]
  if (o.data !== null && o.data !== undefined && typeof o.data === 'object') {
    const inner = o.data as Record<string, unknown>
    if (Array.isArray(inner.entries)) return inner.entries as UnifiedMemoryEntry[]
  }
  if (Array.isArray(raw)) return raw as UnifiedMemoryEntry[]
  return []
}

/** 从 fetchApi 解出的 data 中防御性提取单条 entry(兼容 {id} / {data:{id}} / 整段包络) */
function unwrapEntry(raw: unknown): UnifiedMemoryEntry | null {
  if (raw === null || raw === undefined || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (typeof o.id === 'string') return o as unknown as UnifiedMemoryEntry
  if (o.data !== null && o.data !== undefined && typeof o.data === 'object') {
    const inner = o.data as Record<string, unknown>
    if (typeof inner.id === 'string') return inner as unknown as UnifiedMemoryEntry
  }
  return null
}

/** 列出统一记忆(聚合全部域或按 scope 过滤)。 */
export async function listMemories(
  params: ListMemoriesParams,
): Promise<ApiResult<UnifiedMemoryEntry[]>> {
  const qs = new URLSearchParams({ userId: params.userId })
  if (params.scope) qs.set('scope', params.scope)
  if (params.sessionId) qs.set('sessionId', params.sessionId)
  if (params.projectKey) qs.set('projectKey', params.projectKey)
  const url = `${params.apiBaseUrl}/api/memory?${qs.toString()}`
  const res = await fetchApi<unknown>(url)
  if (!res.success) {
    return { success: false, error: res.error, status: res.status, errorCode: res.errorCode }
  }
  return { success: true, data: unwrapEntries(res.data) }
}

/** 写入一条统一记忆(后端生成 id / createdAt / updatedAt)。 */
export async function createMemory(
  input: CreateMemoryInput,
): Promise<ApiResult<UnifiedMemoryEntry>> {
  const url = `${input.apiBaseUrl}/api/memory`
  const res = await fetchApi<unknown>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ userId: input.userId, entry: input.entry }),
  })
  if (!res.success) {
    return { success: false, error: res.error, status: res.status, errorCode: res.errorCode }
  }
  const entry = unwrapEntry(res.data)
  if (!entry) return { success: false, error: '记忆写入响应缺失条目' }
  return { success: true, data: entry }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
