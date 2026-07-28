import { unwrapApi as api } from '@/lib/api-helpers'
import { selectClass } from '@/lib/form-styles'
import type { AdminResource, AdminResourcesData } from '@ihui/types'

export { api, selectClass }

export type { AdminCategory as Category } from '@ihui/types'
export type Resource = AdminResource
export type ResourcesData = AdminResourcesData

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
