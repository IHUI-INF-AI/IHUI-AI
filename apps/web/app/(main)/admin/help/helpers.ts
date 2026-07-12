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

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export const EMPTY_FORM: HelpForm = {
  title: '',
  slug: '',
  category: 'account',
  content: '',
  isPublished: false,
}

export const HELP_CATEGORIES: HelpCategory[] = ['account', 'payment', 'project', 'ai', 'tech']

export function articleToForm(h: HelpArticle): HelpForm {
  return {
    title: h.title,
    slug: h.slug,
    category: h.category,
    content: h.content,
    isPublished: h.isPublished,
  }
}
