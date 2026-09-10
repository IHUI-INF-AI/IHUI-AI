// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:

/**
 * Knowledge Card API 客户端 (2026-09-10 新增,2-1 项目知识引擎)
 *
 * 对应 apps/api /api/knowledge-cards 路由:
 * - listKnowledgeCards    GET    /          按仓库名列卡片
 * - createKnowledgeCard   POST   /          创建卡片(手动)
 * - searchKnowledgeCards  GET    /search    关键词检索
 * - getKnowledgeCard      GET    /:id       卡片详情
 * - updateKnowledgeCard   PATCH  /:id       更新卡片
 * - markCardUsed          PATCH  /:id       复用打点(useCount+1)
 * - deleteKnowledgeCard   DELETE /:id       删除卡片
 */

import { fetchApi } from '../client'

/** 卡片类型:experience=任务经验;fact=项目事实;practices=最佳实践;pitfall=踩坑记录 */
export type KnowledgeCardKind = 'experience' | 'fact' | 'practices' | 'pitfall'

/** 卡片来源:agent=Agent 沉淀;manual=人工录入 */
export type KnowledgeCardSource = 'agent' | 'manual'

/** 卡片列表项(不含 content,避免大 payload) */
export interface KnowledgeCardSummary {
  id: string
  repoName: string
  kind: KnowledgeCardKind
  source: KnowledgeCardSource
  title: string
  tags: string[]
  confidence: number
  useCount: number
  lastUsedAt: string | null
  createdAt: string
}

/** 卡片详情(含 content/context) */
export interface KnowledgeCardDetail extends KnowledgeCardSummary {
  content: string
  context: Record<string, unknown> | null
  userId: string | null
  updatedAt: string
}

/** 创建入参 */
export interface KnowledgeCardCreateInput {
  repoName: string
  kind?: KnowledgeCardKind
  title: string
  content: string
  tags?: string[]
  context?: Record<string, unknown>
  confidence?: number
}

/** 编辑入参(全可选) */
export interface KnowledgeCardUpdateInput {
  kind?: KnowledgeCardKind
  title?: string
  content?: string
  tags?: string[]
  context?: Record<string, unknown> | null
  confidence?: number
}

/** 按仓库名列卡片(本人 + 全局,kind/tag 可选过滤) */
export async function listKnowledgeCards(opts: {
  repoName: string
  kind?: KnowledgeCardKind
  tag?: string
  limit?: number
}): Promise<KnowledgeCardSummary[]> {
  const params = new URLSearchParams({ repoName: opts.repoName })
  if (opts.kind) params.set('kind', opts.kind)
  if (opts.tag) params.set('tag', opts.tag)
  if (opts.limit) params.set('limit', String(opts.limit))
  const res = await fetchApi<KnowledgeCardSummary[]>(`/api/knowledge-cards?${params.toString()}`)
  if (!res.success) throw new Error(res.error || '查询卡片列表失败')
  return res.data
}

/** 创建卡片(手动录入) */
export async function createKnowledgeCard(
  input: KnowledgeCardCreateInput,
): Promise<KnowledgeCardDetail> {
  const res = await fetchApi<KnowledgeCardDetail>('/api/knowledge-cards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.success) throw new Error(res.error || '创建卡片失败')
  return res.data
}

/** 关键词检索卡片(title/content ILIKE,按 useCount 降序) */
export async function searchKnowledgeCards(opts: {
  q: string
  repoName?: string
  limit?: number
}): Promise<(KnowledgeCardSummary & { content: string })[]> {
  const params = new URLSearchParams({ q: opts.q })
  if (opts.repoName) params.set('repoName', opts.repoName)
  if (opts.limit) params.set('limit', String(opts.limit))
  const res = await fetchApi<(KnowledgeCardSummary & { content: string })[]>(
    `/api/knowledge-cards/search?${params.toString()}`,
  )
  if (!res.success) throw new Error(res.error || '检索卡片失败')
  return res.data
}

/** 卡片详情 */
export async function getKnowledgeCard(id: string): Promise<KnowledgeCardDetail> {
  const res = await fetchApi<KnowledgeCardDetail>(`/api/knowledge-cards/${encodeURIComponent(id)}`)
  if (!res.success) throw new Error(res.error || '查询卡片失败')
  return res.data
}

/** 更新卡片(仅本人) */
export async function updateKnowledgeCard(
  id: string,
  input: KnowledgeCardUpdateInput,
): Promise<KnowledgeCardDetail> {
  const res = await fetchApi<KnowledgeCardDetail>(
    `/api/knowledge-cards/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    },
  )
  if (!res.success) throw new Error(res.error || '更新卡片失败')
  return res.data
}

/** 复用打点:useCount +1,lastUsedAt 刷新 */
export async function markCardUsed(id: string): Promise<KnowledgeCardDetail> {
  const res = await fetchApi<KnowledgeCardDetail>(
    `/api/knowledge-cards/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markUsed: true }),
    },
  )
  if (!res.success) throw new Error(res.error || '打点失败')
  return res.data
}

/** 删除卡片(仅本人) */
export async function deleteKnowledgeCard(id: string): Promise<{ deleted: boolean }> {
  const res = await fetchApi<{ deleted: boolean }>(
    `/api/knowledge-cards/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error || '删除卡片失败')
  return res.data
}
