import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass } from '@/lib/form-styles'

export { api, selectClass }

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

export const PAGE_SIZE = 10 // admin 列表专用,小于全局 DEFAULT_PAGE_SIZE=20

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
