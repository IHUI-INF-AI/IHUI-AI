import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'
import { buildQs, type PageData } from '../utils.js'

/**
 * 直播相关 API
 *
 * 字段命名对齐后端 schema(live.ts):
 * - intro (非 description)
 * - playUrl (非 streamUrl)
 * - viewCount (非 viewerCount)
 * - 删除 instructorAvatar/subscriberCount/isSubscribed/replayUrl/tags/duration (后端无此字段)
 *
 * 端点路径对齐:
 * - getLiveCalendar → /api/live/calendar (补 /api 前缀)
 * - subscribeLive → /api/live/:id/subscribe (非 /api/legacy/live/subscribe)
 */

export interface Live {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  lecturerId: string | null
  lecturerName: string | null
  pushUrl: string | null
  playUrl: string | null
  startTime: string
  endTime: string | null
  isLive: boolean
  isPublished: boolean
  viewCount: number
  sort: number
  status: number
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export interface LiveCalendarItem {
  id: string
  title: string
  lecturerName: string | null
  status: number
  startTime: string
  endTime: string | null
  isLive: boolean
}

export type LiveCalendarQuery = {
  month?: string
  startDate?: string
  endDate?: string
}

export type LiveListQuery = {
  page?: number
  pageSize?: number
  status?: string
  keyword?: string
}

export async function getLiveList(query: LiveListQuery = {}): Promise<ApiResult<PageData<Live>>> {
  return fetchApi<PageData<Live>>(`/api/live/channels${buildQs(query)}`)
}

export async function getLiveById(id: string): Promise<ApiResult<Live>> {
  return fetchApi<Live>(`/api/live/channels/${encodeURIComponent(id)}`)
}

export async function getLiveCalendar(
  query: LiveCalendarQuery = {},
): Promise<ApiResult<LiveCalendarItem[]>> {
  return fetchApi<LiveCalendarItem[]>(`/api/live/calendar${buildQs(query)}`)
}

export async function subscribeLive(id: string): Promise<ApiResult<{ subscribed: boolean }>> {
  return fetchApi<{ subscribed: boolean }>(`/api/live/${encodeURIComponent(id)}/subscribe`, {
    method: 'POST',
  })
}
