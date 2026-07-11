import { fetchApi } from '@/lib/api'

export interface Resource {
  id: string
  title: string
  coverImage: string | null
  intro: string | null
  categoryId: string | null
  categoryName: string | null
  fileUrl: string | null
  fileType: string | null
  fileSize: number | null
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

export interface ResourcesData {
  list: Resource[]
  total: number
  page: number
  pageSize: number
}

export const PAGE_SIZE = 10

export const selectClass =
  'h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export function fetchResources(params: {
  page: number
  search: string
  categoryId: string
}): Promise<ResourcesData> {
  const qs = new URLSearchParams({ page: String(params.page), pageSize: String(PAGE_SIZE) })
  if (params.search) qs.set('title', params.search)
  if (params.categoryId && params.categoryId !== 'all') qs.set('categoryId', params.categoryId)
  return api<ResourcesData>(`/api/admin/resources?${qs.toString()}`)
}

export interface ResourceForm {
  title: string
  categoryId: string
  intro: string
  coverImage: string
  fileUrl: string
  fileType: string
  fileSize: string
  isPublished: boolean
  sort: string
}

export const EMPTY_FORM: ResourceForm = {
  title: '',
  categoryId: '',
  intro: '',
  coverImage: '',
  fileUrl: '',
  fileType: '',
  fileSize: '0',
  isPublished: false,
  sort: '0',
}
