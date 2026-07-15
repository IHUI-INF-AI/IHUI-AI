import { fetchApi } from '@/lib/api'
import { ApiError } from '@/lib/api-error'
import type { Circle, CircleForm } from './types'

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const textareaClass =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export const EMPTY_FORM: CircleForm = {
  name: '',
  slug: '',
  description: '',
  coverImage: '',
  isPublished: true,
}

export interface CirclesListData {
  list: Circle[]
  total: number
  page: number
  pageSize: number
}

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new ApiError(r.error, r.status, r.errorCode)
  return r.data
}

export async function fetchCircles(params: {
  page: number
  pageSize?: number
  search?: string
}): Promise<CirclesListData> {
  const qs = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.pageSize ?? PAGE_SIZE),
  })
  if (params.search) qs.set('search', params.search)
  return api<CirclesListData>(`/api/admin/circles?${qs.toString()}`)
}

export function circleToForm(item: Circle): CircleForm {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? '',
    coverImage: item.coverImage ?? '',
    isPublished: item.isPublished,
  }
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\u4e00-\u9fa5\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
