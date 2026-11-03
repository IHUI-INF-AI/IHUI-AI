// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 知识库条目「阅读态」屏的形状单源(web `/knowledge-base/[id]` ↔ RN `KnowledgeEntryReading`)。
 *
 * 2026-10-28 立:此前 RN 只有编辑态(`KnowledgeBaseEditScreen` GET 同端点),没有阅读态屏,
 * 两边字段清单只能靠 web 页内联 interface 各写一份。这里收成一份,共享屏
 * `packages/app/src/features/knowledge-base/KnowledgeEntryReadingScreen.tsx` 直取。
 *
 * ⚠️ 端点现状(读 apps/api/src/routes/other/knowledge-base-routes.ts:129-145 实测):
 * `GET /api/knowledge-base/:id` 回的是 `success({ item })` —— **`item` 是 `knowledge_base`
 * 表的裸行**(id/title/summary/content/coverImage/categoryId/authorId/isPublished/status/
 * viewCount/createdAt/updatedAt),既没有 `article` 包裹,也没有 `categoryName` /
 * `authorName` / `tags`,更没有 `prev` / `next`。web 页读 `{ article }` ⇒ 恒 undefined,
 * 是既有的假字段。所以本文件的类型按**契约目标形状**声明(工单要求的 article/prev/next),
 * 端侧适配层必须把 `{ item }` 归一成 `KnowledgeEntryArticle`,`categoryName` /
 * `authorName` / `tags` / `prev` / `next` 缺失时如实留空,不得编造。
 */
import type { TFunction } from './app-shared.js'

/**
 * 阅读态正文条目。除 `id` / `title` / `content` 外全部可选:
 * 后端未给(见头注)就传 null/undefined,屏上跳过的就是真没有的,不留 "-" 占位假值。
 */
export interface KnowledgeEntryArticle {
  id: string
  title: string
  /** web 在标题下渲染的摘要(可能为 null) */
  summary?: string | null
  /** Markdown 正文原文 —— RN 无 markdown 组件,原样 <Text> 渲染 */
  content: string
  /** 分类名(后端只给 categoryId,wrapper 需自行解析;解析不到传 null) */
  categoryName?: string | null
  /** 作者昵称(后端只给 authorId;解析不到传 null) */
  authorName?: string | null
  /** 标签(后端表无 tags 列 ⇒ 通常为空数组) */
  tags?: string[]
  /** 浏览量(后端回自增前的值;缺失按 0 处理) */
  viewCount?: number | null
  /** 更新时间 ISO 串 */
  updatedAt?: string | null
}

/** 同分类上一篇/下一篇的导航项(web 的 prev / next) */
export interface KnowledgeEntryNavItem {
  id: string
  title: string
}

/** 正文里解析出的目录项(`##` / `###` 两级,与 web extractToc 同口径) */
export interface KnowledgeEntryTocItem {
  text: string
  level: number
}

/**
 * KnowledgeEntryReadingScreen 受控 props 契约。
 * 平台无关:取数、登录态、导航全部由 wrapper 注入;颜色走 colorScheme 语义 token。
 */
export interface KnowledgeEntryReadingScreenProps {
  t: TFunction
  /** 正文;`null` + 非 loading 且无 error ⇒ 渲染「文章不存在」 */
  article: KnowledgeEntryArticle | null
  /** 上一篇;缺省不渲染左侧导航 */
  prev?: KnowledgeEntryNavItem | null
  /** 下一篇;缺省不渲染右侧导航 */
  next?: KnowledgeEntryNavItem | null
  /** 首屏加载中(整屏骨架) */
  loading: boolean
  /** 加载失败文案(非空渲染错误态 + 重试) */
  error: string
  /** 顶部返回 */
  onBack: () => void
  /** 错误态重试 / 不存在时重新拉取 */
  onRetry: () => void
  /** 进入上一篇(未接线则不渲染入口) */
  onPrev?: (item: KnowledgeEntryNavItem) => void
  /** 进入下一篇(未接线则不渲染入口) */
  onNext?: (item: KnowledgeEntryNavItem) => void
  colorScheme?: 'light' | 'dark'
}
