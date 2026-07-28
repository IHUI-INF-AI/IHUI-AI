import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass } from '@/lib/form-styles'
import type {
  LiveChannel,
  LiveChannelsData,
  LiveLecturer,
  LiveStatistics as LiveStatsType,
} from '@ihui/types'

export { api, selectClass }

export type { AdminCategory as Category } from '@ihui/types'
export type Channel = LiveChannel
export type Lecturer = LiveLecturer
export type ChannelsData = LiveChannelsData
export type LiveStatistics = LiveStatsType

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

export function fetchChannels(params: {
  page: number
  search: string
  categoryId: string
  lecturerId: string
}): Promise<ChannelsData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('search', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  if (params.lecturerId && params.lecturerId !== 'all') qs.set('lecturerId', params.lecturerId)
  return api<ChannelsData>(`/api/admin/live/channels?${qs.toString()}`)
}

export interface ChannelForm {
  title: string
  categoryId: string
  lecturerId: string
  lecturerName: string
  intro: string
  introduction: string
  cidList: string[]
  showNumber: string
  enableChat: boolean
  coverImage: string
  pushUrl: string
  playUrl: string
  startTime: string
  endTime: string
  isLive: boolean
  isPublished: boolean
  sort: string
}

export const EMPTY_FORM: ChannelForm = {
  title: '',
  categoryId: '',
  lecturerId: '',
  lecturerName: '',
  intro: '',
  introduction: '',
  cidList: [],
  showNumber: '0',
  enableChat: false,
  coverImage: '',
  pushUrl: '',
  playUrl: '',
  startTime: '',
  endTime: '',
  isLive: false,
  isPublished: false,
  sort: '0',
}

export function toLocalInput(v: string | null): string {
  if (!v) return ''
  return v.replace('T', 'T').slice(0, 16)
}
