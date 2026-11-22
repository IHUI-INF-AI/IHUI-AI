// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资讯分类列表屏的形状单源(web `/news/category/[id]` ↔ RN `NewsCategory`)。
 *
 * 2026-10-28 立:web 有分类列表页 `apps/web/app/(main)/news/category/[id]/PageClient.tsx`,
 * RN 端此前**零**该端点消费方(`/api/news/categories` 全仓只有 admin 侧封装),
 * 两端的分类/文章字段清单只能靠 web 页内联 interface 各写一份。这里收成一份,
 * 共享屏 `packages/app/src/features/news/NewsCategoryScreen.tsx` 直取。
 *
 * ⚠️ 与同批 `news.ts`(资讯详情)的分工:本文件只承载**分类列表**的形状,
 * 不复用也不改 `NewsArticleScreen` 的条目类型;命名一律 `NewsCategory*` 前缀,
 * 两个文件各自 `export *`,不会撞名。
 *
 * 端点实回(读 `apps/api/src/routes/news.ts:136-143 / 167-182` 与
 * `apps/api/src/db/news-queries.ts:83-116` 实测):
 *  - `GET /api/news/categories` → `success({ list })`,`list` 是 `news_categories` 表裸行
 *    (`id` / `name` / `sort` / `status` / `createdAt`),按 sort 升序;
 *  - `GET /api/news/articles?categoryId=` → `success({ list, total, page, pageSize })`,
 *    `list` 是 `news_articles` 表裸行 + `categoryName`(leftJoin 出来的真实名字,
 *    **不是**假字段,与知识库详情页的 categoryName 情况不同)。
 * 故端侧只需归一字段名/缺省值,不需要另查分类名。
 */
import type { TFunction } from './app-shared.js'

/**
 * 分类列表里的一条资讯。除 `id` / `title` 外全部可选:
 * 后端没给就传 null/undefined(或 0),屏上跳过的就是真没有的,不留假占位。
 */
export interface NewsCategoryArticle {
  id: string
  title: string
  /** 摘要,web 在标题下渲染(`PageClient.tsx:175-177`) */
  summary?: string | null
  /** 封面图 URL;缺省时屏上渲染 Newspaper 占位图标 */
  coverImage?: string | null
  /** 作者名(表列 authorName,可为 null) */
  authorName?: string | null
  /** 浏览量(缺失按 0 处理) */
  viewCount?: number | null
  /** 发布时间 ISO 串 */
  publishedAt?: string | null
  /** 置顶标记(表格 isPinned,web 在标题左侧渲染「置顶」徽标) */
  isPinned?: boolean
}

/**
 * NewsCategoryScreen 受控 props 契约。
 * 平台无关:取数、分类 id→name 解析、导航、分页方式全部由 wrapper 注入;
 * 颜色走 colorScheme 语义 token。
 */
export interface NewsCategoryScreenProps {
  t: TFunction
  /** 分类名;`null` 且非 loading 且无文章 ⇒ 渲染「资讯不存在」 */
  categoryName: string | null
  /** 该分类下的文章(首屏 + 已追加的后续页) */
  items: NewsCategoryArticle[]
  /** 后端回的总条数(web 页脚「共 N 篇」同源) */
  total: number
  /** 首屏加载中(整屏骨架) */
  loading: boolean
  /** 下拉刷新中(列表保留,不闪骨架) */
  refreshing?: boolean
  /** 上拉加载下一页中(页脚转圈) */
  loadingMore?: boolean
  /** 还有下一页(未接线 / false ⇒ 不再触发 onLoadMore) */
  hasMore?: boolean
  /** 加载失败文案(非空且无数据 ⇒ 错误态 + 重试) */
  error: string
  /** 顶部返回 */
  onBack: () => void
  /** 下拉刷新 / 空态重试 */
  onRefresh: () => void
  /** 错误态重试;缺省回落到 onRefresh */
  onRetry?: () => void
  /** 触底加载下一页(未接线 ⇒ 不做无限滚动) */
  onLoadMore?: () => void
  /** 点文章(宿主 navigate 到资讯详情) */
  onSelect: (id: string) => void
  colorScheme?: 'light' | 'dark'
}
