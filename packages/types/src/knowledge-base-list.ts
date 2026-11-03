// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库文章列表(web `/knowledge-base`)的跨端契约 —— 形状唯一真相源。
 *
 * 取值口径逐字对齐后端 `GET /api/knowledge-base`(apps/api/src/routes/other/knowledge-base-routes.ts:
 * `success({ list, total })`,行 = id/title/summary/viewCount/updatedAt/categoryId/categoryName/authorName)
 * 与 `GET /api/knowledge-base/categories`(`success({ list: [{ id, name, count }] })`)。
 *
 * ⚠️ 与 RAG 文档域(`/api/knowledge/docs`)是两个域,不可互换:那条链的 id 来自 `knowledge_docs`
 * 表(RN 现由 KnowledgeBase / KnowledgeRagManage 两屏承载),本链来自 `knowledge_base` 表。
 * 混用会让详情页按另一个表的 id 取数 —— 实测就是这条(2026-10-28 收口时发现列表屏把
 * RAG 文档 id 直接传给了知识库详情)。
 */
import type { TFunction } from './app-shared.js'

export interface KnowledgeBaseListItem {
  id: string
  title: string
  summary: string | null
  categoryName: string | null
  authorName: string | null
  updatedAt: string | null
}

/** 分类筛选行;`count` 是该分类下的文章数(后端按分类现算) */
export interface KnowledgeBaseCategoryItem {
  id: string
  name: string
  count: number
}

/** 列表屏受控 props:取数/导航全在宿主,共享屏只负责呈现与回调 */
export interface KnowledgeBaseListScreenProps {
  t: TFunction
  items: KnowledgeBaseListItem[]
  categories: KnowledgeBaseCategoryItem[]
  /** `'all'` = 不筛选 —— 后端哨兵值(非 uuid),必须原样透传,不可换空串 */
  activeCategoryId: string
  /** 搜索词(已去抖的生效值;输入框的即时值由共享屏自己持有) */
  search: string
  total: number
  loading: boolean
  refreshing: boolean
  loadingMore: boolean
  hasMore: boolean
  error: string
  onBack: () => void
  onSelect: (item: KnowledgeBaseListItem) => void
  onCategoryChange: (categoryId: string) => void
  onSearchChange: (search: string) => void
  onRefresh: () => void
  onRetry: () => void
  onLoadMore: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
