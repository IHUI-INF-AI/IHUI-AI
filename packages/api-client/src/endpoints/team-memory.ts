// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 团队共享记忆 API 客户端 (2026-09-08 新增,对标竞品团队知识引擎)
 *
 * 对应 apps/api /api/team-memory 路由:
 * - listTeamMemories   GET  /          按 scopeId 列出(支持 kind/tag/keyword 过滤)
 * - createTeamMemory   POST /          创建记忆
 * - getTeamMemory      GET  /:id       获取单条
 * - updateTeamMemory   PUT  /:id       更新单条(局部)
 * - deleteTeamMemory   DELETE /:id     删除单条
 */

import { fetchApi } from '../client'

/** 记忆类型 */
export type TeamMemoryKind = 'decision' | 'convention' | 'pitfall' | 'fingerprint'

/** 记忆 DTO(与后端一致,时间字段为 ISO 字符串) */
export interface TeamMemoryDTO {
  id: string
  scopeId: string
  kind: TeamMemoryKind
  title: string
  content: string
  tags: string[]
  sourceUserId: string | null
  createdAt: string
  updatedAt: string
}

/** 列表过滤参数 */
export interface TeamMemoryListParams {
  scopeId: string
  kind?: TeamMemoryKind
  tag?: string
  keyword?: string
  limit?: number
}

/** 创建入参 */
export interface CreateTeamMemoryInput {
  scopeId: string
  kind: TeamMemoryKind
  title: string
  content: string
  tags?: string[]
}

/** 更新入参(局部) */
export interface UpdateTeamMemoryInput {
  kind?: TeamMemoryKind
  title?: string
  content?: string
  tags?: string[]
}

/** 列出团队记忆(按 scopeId 隔离) */
export async function listTeamMemories(params: TeamMemoryListParams): Promise<TeamMemoryDTO[]> {
  const qs = new URLSearchParams()
  qs.set('scopeId', params.scopeId)
  if (params.kind) qs.set('kind', params.kind)
  if (params.tag) qs.set('tag', params.tag)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.limit !== undefined) qs.set('limit', String(params.limit))
  const res = await fetchApi<TeamMemoryDTO[]>(`/api/team-memory?${qs.toString()}`)
  if (!res.success) throw new Error(res.error || '查询团队记忆失败')
  return res.data
}

/** 创建团队记忆 */
export async function createTeamMemory(
  input: CreateTeamMemoryInput,
): Promise<TeamMemoryDTO> {
  const res = await fetchApi<TeamMemoryDTO>('/api/team-memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '创建团队记忆失败')
  return res.data
}

/** 获取单条团队记忆 */
export async function getTeamMemory(id: string): Promise<TeamMemoryDTO> {
  const res = await fetchApi<TeamMemoryDTO>(`/api/team-memory/${encodeURIComponent(id)}`)
  if (!res.success) throw new Error(res.error || '查询团队记忆失败')
  return res.data
}

/** 更新团队记忆(局部) */
export async function updateTeamMemory(
  id: string,
  patch: UpdateTeamMemoryInput,
): Promise<TeamMemoryDTO> {
  const res = await fetchApi<TeamMemoryDTO>(`/api/team-memory/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.success) throw new Error(res.error || '更新团队记忆失败')
  return res.data
}

/** 删除团队记忆 */
export async function deleteTeamMemory(id: string): Promise<{ deleted: boolean }> {
  const res = await fetchApi<{ deleted: boolean }>(
    `/api/team-memory/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除团队记忆失败')
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
