import { fetchApi } from '@/lib/api'
import type { Carousel, CarouselForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: CarouselForm = {
  title: '',
  imageUrl: '',
  linkUrl: '',
  sort: '0',
  status: true,
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '标题' },
  { key: 'imageUrl', title: '图片' },
  { key: 'linkUrl', title: '链接' },
  { key: 'sort', title: '排序' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
  { key: 'createdAt', title: '创建时间' },
]

export function carouselToForm(item: Carousel): CarouselForm {
  return {
    title: item.title,
    imageUrl: item.imageUrl ?? '',
    linkUrl: item.linkUrl ?? '',
    sort: String(item.sort),
    status: item.status === 1,
  }
}
