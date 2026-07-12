import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'
import { buildQs, type PageData } from '@/lib/edu'

export interface Live {
  id: string
  title: string
  cover: string | null
  description: string
  instructor: string
  instructorAvatar: string | null
  streamUrl: string | null
  status: 'upcoming' | 'living' | 'ended' | 'replay'
  startTime: string
  endTime: string | null
  duration: number | null
  viewerCount: number
  subscriberCount: number
  isSubscribed: boolean
  replayUrl: string | null
  tags: string[]
  createdAt: string
}

export interface LiveCalendarItem {
  id: string
  title: string
  instructor: string
  status: string
  startTime: string
  endTime: string | null
  isSubscribed: boolean
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
  return fetchApi<LiveCalendarItem[]>(`/live/calendar${buildQs(query)}`)
}

export async function subscribeLive(id: string): Promise<ApiResult<{ subscribed: boolean }>> {
  return fetchApi<{ subscribed: boolean }>('/api/legacy/live/subscribe', {
    method: 'POST',
    body: JSON.stringify({ id }),
  })
}
