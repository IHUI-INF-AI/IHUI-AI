// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 资讯详情屏的形状单源(web `/news/[id]` ↔ RN `NewsArticle`)。
 *
 * 2026-10-28 立:RN 此前只有社区文章域(`ArticleDetailScreen` 走 `/api/articles/:id`,
 * `news_articles` 表是另一套后端),web 资讯详情页的字段清单只存在于
 * `apps/web/app/(main)/news/[id]/PageClient.tsx:25-40` 的内联 interface 里。
 * 这里收成一份,共享屏 `packages/app/src/features/news/NewsArticleScreen.tsx` 直取。
 *
 * ⚠️ 端点实回(`apps/api/src/routes/news.ts:360-372` + `apps/api/src/db/news-queries.ts:151-161`):
 * `GET /api/news/articles/:id` 回 `success({ article })`,`article` 是 `news_articles`
 * 表行 left join `news_categories.name` 的**扁平对象** ——
 * `id/title/summary/content/coverImage/authorId/authorName/isPublished/isPinned/viewCount/
 * sort/status/publishedAt/createdAt/updatedAt/categoryName`。
 * 即:**没有** `tags` 列(web 页却按逗号串读 `tags`)、**没有** `likeCount` / `favoriteCount` /
 * `commentNum`(web 页用 `viewCount * 0.05` 之类的**编造兜底**,本屏不承诺这种假数)。
 *
 * 所以:除 `id` / `title` / `content` 外全部可选,后端没给就传 null/undefined,
 * 屏上跳过的就是真没有的;交互计数只在真拿到数字时才渲染。
 */
import type { TFunction } from './app-shared.js'

/** 资讯详情正文条目 */
export interface NewsArticleItem {
  id: string
  title: string
  /** 摘要(web 在标题下与引用块各渲染一次) */
  summary?: string | null
  /** 正文。后端列是 text,web 走 SafeHtml 当 HTML 渲染;RN 无等价物,按段落纯文本落地 */
  content: string
  /** 封面图 URL */
  coverImage?: string | null
  /** 作者署名(后端是自由文本列,不是 user 关联读法) */
  authorName?: string | null
  /** 分类名(后端 left join `news_categories.name` 得来,未命中为 null) */
  categoryName?: string | null
  /** 浏览量(响应里是自增前的值) */
  viewCount?: number | null
  /** 发布时间 ISO 串 */
  publishedAt?: string | null
  /** 标签(后端无此列,通常为空数组;宿主若拿到逗号串需自行拆) */
  tags?: string[]
  /** 点赞数(后端详情不回,缺失则不渲染) */
  likeCount?: number | null
  /** 收藏数(同上) */
  favoriteCount?: number | null
  /** 评论数(同上) */
  commentCount?: number | null
}

/**
 * NewsArticleScreen 受控 props 契约。
 * 平台无关:取数、登录态、导航全部由 wrapper 注入;颜色走 colorScheme 语义 token。
 */
export interface NewsArticleScreenProps {
  t: TFunction
  /** 正文;`null` + 非 loading 且无 error ⇒ 渲染「资讯不存在」 */
  article: NewsArticleItem | null
  /** 首屏加载中(整屏骨架) */
  loading: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 顶部返回 */
  onBack: () => void
  /** 错误态重试 / 不存在时重新拉取 */
  onRetry: () => void
  colorScheme?: 'light' | 'dark'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
