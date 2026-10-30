// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库「文章」域端点(2026-10-26 立,Wave3 承载 web `/knowledge-base/search`
 * 与 `/knowledge-base/[id]` 两条路由;与 `knowledge-rag.ts` 的 `/api/knowledge/docs`
 * 文档切片域、`team-knowledge.ts` 的团队域是**三套不同系统**,勿混用)。
 *
 * 后端契约取证(apps/api 现读,注册链 routes/other/index.ts:67 `register(knowledgeBaseRoutes)`,
 * 组合根 :47-53 挂了统一 `authenticate` preHandler ⇒ **本域全部端点需登录**,401 由上层处理):
 *  - `GET /knowledge-base`        apps/api/src/routes/other/knowledge-base-routes.ts:33-83
 *      query `page` / `pageSize`(后端 :51 钳到 1..100)/ `categoryId`('all' 为不筛选哨兵,
 *      其余必须是 uuid,畸形值 :36-38 直接 400)/ `search`(后端 :54 对 title OR summary 做 ILIKE)
 *      信封 `success({ list, total })`(:82)⇒ `{ code:0, message, data:{ list, total } }`,
 *      列表项形状 = :66-74 的显式 select(id/title/summary/viewCount/updatedAt/
 *      categoryId/categoryName/authorName),**没有 content**(正文只在详情接口里)。
 *  - `GET /knowledge-base/:id`    同文件 :130-145
 *      信封 `success({ item })`(:144)⇒ data.item 是 `select()` 整行
 *      (packages/database/src/schema/knowledge-base.ts:24-36)。
 *      如实记录三处「后端与 web 口径不一致」,本封装按后端为准:
 *        ① web `PageClient.tsx:31-35` 读的是 `{ article, prev, next }`,后端既不给 `article`
 *           也不给 `prev/next` ⇒ RN 侧不渲染上下篇(造一个点了没反应的按钮比缺功能更糟);
 *        ② 详情是裸 `select()`,**不 join 分类/作者** ⇒ 没有 `categoryName`/`authorName`
 *           (列表接口才有),RN 详情卡只展示后端真给了的字段;
 *        ③ 表里没有 tags 列 ⇒ web 的标签区在这条路由上恒空,RN 不提供。
 *      副作用:详情接口每次命中都会 `viewCount + 1`(:140-143,写库),
 *      故本封装**不做缓存重试自动重放**,下拉刷新会重复计数,由调用方决定。
 *
 * 传输统一走 fetchApi(令牌 / CSRF / 超时 / 包络校验由本包统一托管)。
 */

import { fetchApi } from '../client.js'

/** 列表项(形状对齐 knowledge-base-routes.ts:66-74 的 select 列) */
export interface KBArticleListItem {
  id: string
  title: string
  summary: string | null
  viewCount: number | null
  updatedAt: string
  categoryId: string | null
  categoryName: string | null
  authorName: string | null
}

/** 详情整行(对齐 packages/database/src/schema/knowledge-base.ts 列集) */
export interface KBArticleDetail {
  id: string
  title: string
  summary: string | null
  content: string | null
  coverImage: string | null
  categoryId: string | null
  authorId: string | null
  viewCount: number | null
  likeCount: number | null
  isPublished: boolean
  status: number
  createdAt: string
  updatedAt: string
}

/** 列表查询参数('all' 与空值都不下传 categoryId,与后端 :53 的哨兵判定同形) */
export interface ListKBArticlesParams {
  search?: string
  categoryId?: string
  page?: number
  pageSize?: number
}

/**
 * 检索知识库文章:`GET /api/knowledge-base?search=&categoryId=&page=&pageSize=`
 * 返回 `{ list, total }`(后端 :82 的 success 载荷),total 为满足筛选条件的总行数(非本页条数)。
 */
export async function listKBArticles(
  params: ListKBArticlesParams = {},
): Promise<{ list: KBArticleListItem[]; total: number }> {
  const query: Record<string, string | number> = {}
  if (params.search) query.search = params.search
  if (params.categoryId && params.categoryId !== 'all') query.categoryId = params.categoryId
  if (params.page) query.page = params.page
  if (params.pageSize) query.pageSize = params.pageSize
  const res = await fetchApi<{ list?: KBArticleListItem[]; total?: number }>(
    '/api/knowledge-base',
    { params: query },
  )
  if (!res.success) throw new Error(res.error || '知识库检索失败')
  // 防御性解包:后端恒发 {list,total},但缺键时按「空列表 + 0 条」如实呈现,不用 undefined 冒充
  return { list: res.data?.list ?? [], total: res.data?.total ?? 0 }
}

/**
 * 知识库文章详情:`GET /api/knowledge-base/:id` → `{ item }`(后端 :144)。
 * 404(后端 :138 「知识库不存在」)与非 0 码一并抛给调用方,由屏侧渲染错误态。
 * 注意 id 的合法形态见 routes/other/_shared.ts:19-26(`^[a-zA-Z0-9_-]+$` ≤128),
 * 畸形 id 会被后端 400 拦下,故调用方无需自行校验,但也不应拼未编码的原始串。
 */
export async function getKBArticle(id: string): Promise<KBArticleDetail> {
  const res = await fetchApi<{ item?: KBArticleDetail }>(
    `/api/knowledge-base/${encodeURIComponent(id)}`,
  )
  if (!res.success) throw new Error(res.error || '加载文章失败')
  const item = res.data?.item
  if (!item) throw new Error('文章不存在')
  return item
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
