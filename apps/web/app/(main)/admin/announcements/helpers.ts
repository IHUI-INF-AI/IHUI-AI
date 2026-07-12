import { fetchApi } from '@/lib/api'
import type { Announcement, AnnouncementForm, AnnType } from './types'

export const TYPE_BADGE: Record<AnnType, string> = {
  info: 'bg-primary/10 text-primary',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  maintenance: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  update: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: AnnouncementForm = {
  title: '',
  content: '',
  type: 'info',
  isPinned: false,
  isPublished: false,
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export async function fetchList(): Promise<Announcement[]> {
  const raw = await api<{ list?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
    '/api/admin/messages/announcements?includeUnpublished=true',
  )
  const arr = Array.isArray(raw) ? raw : (raw.list ?? [])
  return arr.map((r) => ({
    id: String(r.id),
    title: String(r.title ?? ''),
    content: String(r.content ?? ''),
    type: (r.type as AnnType) ?? 'info',
    isPinned: Boolean(r.isTop ?? r.isPinned),
    isPublished: Boolean(r.isPublished),
    publishedAt: r.publishedAt ? String(r.publishedAt) : undefined,
    updatedAt: r.updatedAt ? String(r.updatedAt) : undefined,
  }))
}

export function announcementToForm(item: Announcement): AnnouncementForm {
  return {
    title: item.title,
    content: item.content,
    type: item.type,
    isPinned: item.isPinned,
    isPublished: item.isPublished,
  }
}
