import * as React from 'react'
import type ReactMarkdown from 'react-markdown'
import type { ComponentType } from 'react'
import { Info, AlertTriangle, Wrench, RefreshCw } from 'lucide-react'

import { fetchApi } from '@/lib/api'

/** Throw on error, unwrap ApiResponse.data — mirrors `api` helper in feedback.ts */
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

// ---------------- Announcements ----------------
export type AnnouncementType = 'info' | 'warning' | 'maintenance' | 'update'

export interface Announcement {
  id: string
  type: AnnouncementType
  title: string
  summary: string
  content: string
  publishedAt: string
  isPinned?: boolean
  isRead?: boolean
}

export interface AnnouncementDetail {
  announcement: Announcement
}

export const ANN_TYPE_ICON: Record<AnnouncementType, ComponentType<{ className?: string }>> = {
  info: Info,
  warning: AlertTriangle,
  maintenance: Wrench,
  update: RefreshCw,
}

export const ANN_TYPE_BADGE: Record<AnnouncementType, string> = {
  info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maintenance: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  update: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

// ---------------- Help ----------------
export interface HelpCategory {
  slug: string
  name: string
  description?: string
  articleCount?: number
}

export interface HelpArticleSummary {
  slug: string
  title: string
  /** 摘要：后端 help_articles 表无 summary 列，需从 content 派生（见 excerptFromContent） */
  summary?: string
  content?: string
  category: string
  updatedAt: string
}

export interface HelpArticle extends HelpArticleSummary {
  content: string
  viewCount?: number
}

/** 从 markdown content 派生纯文本摘要（去标记 + 截断）。 */
export function excerptFromContent(content?: string, max = 150): string {
  if (!content) return ''
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*`>\-_~#!]/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
}

export interface HelpArticleDetail {
  article: HelpArticle
  categoryName?: string
  prev?: { slug: string; title: string }
  next?: { slug: string; title: string }
}

// ---------------- Docs ----------------
export type DocCategory = 'api' | 'guide' | 'development' | 'faq'

export interface DocSummary {
  slug: string
  title: string
  /** 摘要：后端 docs 表无 summary 列，需从 content 派生（见 excerptFromContent） */
  summary?: string
  content?: string
  category: DocCategory
  author?: string
  updatedAt: string
}

export interface Doc extends DocSummary {
  content: string
  viewCount?: number
}

export interface DocDetail {
  doc: Doc
  prev?: { slug: string; title: string }
  next?: { slug: string; title: string }
}

// ---------------- Markdown helpers ----------------
// 使用 Unicode 属性转义 \p{L}\p{N} 保留中日韩字符,避免 CJK 标题锚点退化为空。
export function slugify(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export interface TocItem {
  id: string
  text: string
  level: number
}

/** Extract h2/h3 headings from raw markdown into a TOC. */
export function extractToc(markdown: string): TocItem[] {
  const items: TocItem[] = []
  for (const line of markdown.split('\n')) {
    const m = /^(#{2,3})\s+(.+?)\s*$/.exec(line)
    if (!m || !m[1] || !m[2]) continue
    const level = m[1].length
    const text = m[2].replace(/[*_`]/g, '')
    items.push({ id: slugify(text), text, level })
  }
  return items
}

export const markdownComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  h2: ({ children }) => {
    const text = String(children ?? '')
    return (
      <h2 id={slugify(text)} className="mt-8 scroll-mt-20 text-xl font-semibold">
        {children}
      </h2>
    )
  },
  h3: ({ children }) => {
    const text = String(children ?? '')
    return (
      <h3 id={slugify(text)} className="mt-6 scroll-mt-20 text-lg font-semibold">
        {children}
      </h3>
    )
  },
}
