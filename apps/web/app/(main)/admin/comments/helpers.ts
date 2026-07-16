import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { CommentDetailData, CommentsListData, StatusFilter, TopicType } from './types'

export const PAGE_SIZE = 10

export const TOPIC_TYPES: { value: TopicType; labelKey: string }[] = [
  { value: 'article', labelKey: 'topicArticle' },
  { value: 'ask', labelKey: 'topicAsk' },
  { value: 'answer', labelKey: 'topicAnswer' },
  { value: 'resource', labelKey: 'topicResource' },
  { value: 'circle_post', labelKey: 'topicCirclePost' },
  { value: 'lesson', labelKey: 'topicLesson' },
  { value: 'live_channel', labelKey: 'topicLiveChannel' },
  { value: 'topic', labelKey: 'topicTopic' },
  { value: 'comment', labelKey: 'topicComment' },
]

export const STATUS_OPTIONS: { value: StatusFilter; labelKey: string }[] = [
  { value: 'normal', labelKey: 'statusNormal' },
  { value: 'deleted', labelKey: 'statusDeleted' },
  { value: 'all', labelKey: 'statusAll' },
]

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export async function fetchComments(params: {
  page: number
  pageSize?: number
  topicType?: TopicType
  keyword?: string
  status?: StatusFilter
}): Promise<CommentsListData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? PAGE_SIZE),
  })
  if (params.topicType) qs.set('topicType', params.topicType)
  if (params.keyword) qs.set('keyword', params.keyword)
  if (params.status) qs.set('status', params.status)
  return api<CommentsListData>(`/api/admin/comments?${qs.toString()}`)
}

export async function fetchCommentDetail(id: string): Promise<CommentDetailData> {
  return api<CommentDetailData>(`/api/admin/comments/${id}`)
}

export async function deleteComment(id: string): Promise<void> {
  await api(`/api/admin/comments/${id}`, { method: 'DELETE' })
}

export function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export function initials(name?: string | null): string {
  if (!name) return '?'
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 1).toUpperCase()
}
