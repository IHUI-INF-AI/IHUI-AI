import { fetchApi } from '@/lib/api'

export interface Channel {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  introduction: string | null
  cidList: string[] | null
  showNumber: number | null
  enableChat: boolean | null
  categoryId: string | null
  categoryName: string | null
  lecturerId: string | null
  lecturerName: string | null
  pushUrl: string | null
  playUrl: string | null
  startTime: string | null
  endTime: string | null
  isLive: boolean
  isPublished: boolean
  sort: number
  status: number
  viewCount: number
  createdAt: string
  updatedAt: string
}

export interface Category {
  id: string
  name: string
  sort: number
  status: number
}

export interface Lecturer {
  id: string
  name: string
  title: string | null
  sort: number
  status: number
}

export interface ChannelsData {
  list: Channel[]
  total: number
  page: number
  pageSize: number
}

export interface LiveStatistics {
  total: number
  living: number
  published: number
  viewSum: number
}

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

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
