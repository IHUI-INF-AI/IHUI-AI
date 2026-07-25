import { fetchApi } from '@/lib/api'
import type { HelpArticle, HelpCategory, HelpForm } from './types'

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchList(): Promise<HelpArticle[]> {
  const d = await api<{ list: HelpArticle[] } | HelpArticle[]>('/api/admin/help/articles')
  return Array.isArray(d) ? d : (d.list ?? [])
}

export const EMPTY_FORM: HelpForm = {
  title: '',
  slug: '',
  category: 'account',
  content: '',
  isPublished: false,
}

export const HELP_CATEGORIES: HelpCategory[] = ['account', 'payment', 'project', 'ai', 'tech']

/**
 * 帮助分类 i18n key 静态映射表:categories.${category} — 用于消除 `t(\`categories.${var}\`)` 动态拼接
 */
export const CATEGORY_KEY: Record<string, string> = Object.fromEntries(
  HELP_CATEGORIES.map((c) => [c, `categories.${c}`]),
)

export function articleToForm(h: HelpArticle): HelpForm {
  return {
    title: h.title,
    slug: h.slug,
    category: h.category,
    content: h.content,
    isPublished: h.isPublished,
  }
}
