// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Repo Wiki API 客户端 (2026-09-07 新增,Repo Wiki MVP)
 *
 * 对应 apps/api /api/repo-wiki 路由:
 * - generateRepoWiki    POST /generate  生成仓库总览 + 模块文档
 * - listRepoWiki        GET  /          按仓库名列文档
 * - getRepoWikiDoc      GET  /:id       文档详情
 * - deleteRepoWikiDoc   DELETE /:id     删除文档
 */

import { fetchApi } from '../client'

/** 文档类型:overview = 仓库总览;module = 模块文档 */
export type RepoWikiDocKind = 'overview' | 'module'

/** 生成入参:前端收集的工作区文件清单 */
export interface RepoWikiFileInput {
  path: string
  content: string
}

/** 生成结果中的文档引用 */
export interface RepoWikiDocRef {
  id: string
  kind: RepoWikiDocKind
  title: string
  modulePath: string | null
}

/** 生成结果 */
export interface RepoWikiGenerateResult {
  docs: RepoWikiDocRef[]
  skippedModules: string[]
}

/** 文档列表项(不含 content,避免大 payload) */
export interface RepoWikiDocSummary {
  id: string
  repoName: string
  kind: RepoWikiDocKind
  modulePath: string | null
  title: string
  model: string | null
  fileCount: number
  generatedAt: string
}

/** 文档详情(含 markdown 正文) */
export interface RepoWikiDocDetail extends RepoWikiDocSummary {
  content: string
  userId: string | null
  createdAt: string
  updatedAt: string
}

/** 生成 Repo Wiki(仓库总览 + 模块文档) */
export async function generateRepoWiki(opts: {
  repoName: string
  model?: string
  files: RepoWikiFileInput[]
}): Promise<RepoWikiGenerateResult> {
  const res = await fetchApi<RepoWikiGenerateResult>('/api/repo-wiki/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  })
  if (!res.success) throw new Error(res.error || 'Wiki 生成失败')
  return res.data
}

/** 按仓库名列文档(本人 + 全局,按生成时间倒序) */
export async function listRepoWiki(repoName: string): Promise<RepoWikiDocSummary[]> {
  const res = await fetchApi<RepoWikiDocSummary[]>(
    `/api/repo-wiki?repoName=${encodeURIComponent(repoName)}`,
  )
  if (!res.success) throw new Error(res.error || '查询文档列表失败')
  return res.data
}

/** 文档详情 */
export async function getRepoWikiDoc(id: string): Promise<RepoWikiDocDetail> {
  const res = await fetchApi<RepoWikiDocDetail>(`/api/repo-wiki/${encodeURIComponent(id)}`)
  if (!res.success) throw new Error(res.error || '查询文档失败')
  return res.data
}

/** 删除文档(仅本人) */
export async function deleteRepoWikiDoc(id: string): Promise<{ deleted: boolean }> {
  const res = await fetchApi<{ deleted: boolean }>(`/api/repo-wiki/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
  if (!res.success) throw new Error(res.error || '删除失败')
  return res.data
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
