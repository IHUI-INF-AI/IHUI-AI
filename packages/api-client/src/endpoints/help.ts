// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 帮助中心端点(2026-11-05 立,门 300 存量 A 类:web / 小程序端内直拼 `/api/help` 收口)。
 *
 * 后端真值:`apps/api/src/routes/content.ts`(前缀 /api)。
 *  - GET /api/help/categories    公开,`{ list }`(`findHelpCategories` 选 *,行里带 id)
 *  - GET /api/help/articles      公开,`{ list }`,支持 `?category=` 筛选
 *  - GET /api/help/articles/:slug 公开,`{ article, categoryName?, prev?, next? }`
 * 类型字段取 web `app/(main)/help/**` 与小程序 `api/index.ts` 现有用法并集。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs } from '../utils.js'

/** 帮助分类(DB 行;web 只用 slug/name/articleCount)。 */
export interface HelpCategory {
  id?: string
  slug: string
  name: string
  description?: string
  articleCount?: number
}

/** 帮助文章列表项(DB 行;web 读 slug/title/summary/content/category/updatedAt,小程序读 id/title/content)。 */
export interface HelpArticleSummary {
  id: string
  slug: string
  title: string
  summary?: string
  content?: string
  category: string
  updatedAt: string
}

/** 帮助文章详情(列表项 + 正文与浏览量)。 */
export interface HelpArticle extends HelpArticleSummary {
  content: string
  viewCount?: number
}

/** 详情回包里的上/下一篇导航项。 */
export interface HelpArticleNeighbor {
  slug: string
  title: string
}

/** GET /api/help/articles/:slug 的回包(`apps/api/src/routes/content.ts` 的 success 组装)。 */
export interface HelpArticleDetail {
  article: HelpArticle
  categoryName?: string
  prev?: HelpArticleNeighbor
  next?: HelpArticleNeighbor
}

/** GET /api/help/categories —— 帮助分类列表(公开)。 */
export async function listHelpCategories(): Promise<ApiResult<{ list: HelpCategory[] }>> {
  return fetchApi<{ list: HelpCategory[] }>('/api/help/categories')
}

/** GET /api/help/articles —— 帮助文章列表(公开,可按 category 筛选)。 */
export async function listHelpArticles(
  category?: string,
): Promise<ApiResult<{ list: HelpArticleSummary[] }>> {
  return fetchApi<{ list: HelpArticleSummary[] }>(`/api/help/articles${buildQs({ category })}`)
}

/** GET /api/help/articles/:slug —— 帮助文章详情(公开)。 */
export async function getHelpArticle(slug: string): Promise<ApiResult<HelpArticleDetail>> {
  return fetchApi<HelpArticleDetail>(`/api/help/articles/${encodeURIComponent(slug)}`)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
