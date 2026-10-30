// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库端点(补 RN 承载用,2026-10-27 后端契约现读)
 *
 *  - GET /api/knowledge-base?page&pageSize&categoryId&search
 *    → 信封 success({ list, total })
 *    (apps/api/src/routes/other/knowledge-base-routes.ts:33-83,`return reply.send(success({ list, total }))` 在 :82;
 *     挂载前缀 /api 见 apps/api/src/routes/index.ts:1119 `server.register(otherRoutes, { prefix: '/api' })`,
 *     子注册见 apps/api/src/routes/other/index.ts:67)
 *    page 默认 1、pageSize 1..100 默认 10(knowledge-base-routes.ts:50-51);
 *    search 走 title/summary ILIKE(knowledge-base-routes.ts:54);
 *    categoryId='all' 为「不筛选」哨兵,非 uuid 放行但不过滤(knowledge-base-routes.ts:25-29,53);
 *    该路由无 preHandler ⇒ 公开可读(同文件 :31-33 无 requireAuth)。
 *  - GET /api/knowledge-base/:id → success({ item })(knowledge-base-routes.ts:130-145,发送在 :144)
 *    :id 经 parseIdParam → idParamSchema(apps/api/src/routes/other/_shared.ts:37-44),畸形 400、不存在 404
 *    (knowledge-base-routes.ts:138);命中后浏览量 +1(knowledge-base-routes.ts:140-143)。
 *    ⚠ web 详情页按 { article, prev, next } 解析(apps/web/app/(main)/knowledge-base/[id]/PageClient.tsx:31-35,46),
 *    与后端实际 { item } 不符 ⇒ web 侧 article 恒 undefined;RN 薄壳按后端真实信封取 data.item,
 *    prev/next 后端不提供 ⇒ 不渲染「上一篇/下一篇」,不造假导航。
 *  - 列表行 = drizzle 显式 select 的 8 列(knowledge-base-routes.ts:64-74),categoryName/authorName 来自
 *    leftJoin(knowledge-base-routes.ts:76-77),未命中为 null。
 *  - web 同参数消费方:apps/web/app/(main)/knowledge-base/search/PageClient.tsx:65-73(search + pageSize=50)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** GET /api/knowledge-base → data.list 行(knowledge-base-routes.ts:64-74 的 select 集) */
export interface KnowledgeBaseListItem {
  id: string
  title: string
  summary: string | null
  viewCount: number
  updatedAt: string
  categoryId: string | null
  /** leftJoin knowledge_base_categories.name,无分类为 null(knowledge-base-routes.ts:72) */
  categoryName: string | null
  /** leftJoin users.nickname(knowledge-base-routes.ts:73) */
  authorName: string | null
}

export interface KnowledgeBaseListResult {
  list: KnowledgeBaseListItem[]
  total: number
}

export interface KnowledgeBaseListQuery {
  page?: number
  /** 后端上限 100(knowledge-base-routes.ts:51) */
  pageSize?: number
  /** 'all' = 不筛选(knowledge-base-routes.ts:53) */
  categoryId?: string
  search?: string
}

/** GET /api/knowledge-base/:id → data.item(knowledge_base 全列,knowledge-base-routes.ts:133-137) */
export interface KnowledgeBaseArticleRow {
  id: string
  title: string
  summary: string | null
  /** text 可空(packages/database/src/schema/knowledge-base.ts:27) */
  content: string | null
  coverImage: string | null
  categoryId: string | null
  authorId: string | null
  viewCount: number
  likeCount: number
  isPublished: boolean
  status: number
  createdAt: string
  updatedAt: string
}

export interface KnowledgeBaseArticleResult {
  item: KnowledgeBaseArticleRow
}

export async function getKnowledgeBaseList(
  query: KnowledgeBaseListQuery = {},
): Promise<ApiResult<KnowledgeBaseListResult>> {
  return fetchApi<KnowledgeBaseListResult>(`/api/knowledge-base${buildQs(query)}`)
}

export async function getKnowledgeBaseArticle(
  id: string,
): Promise<ApiResult<KnowledgeBaseArticleResult>> {
  return fetchApi<KnowledgeBaseArticleResult>(`/api/knowledge-base/${encodeURIComponent(id)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
