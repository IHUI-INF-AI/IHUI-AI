import { fetchApi } from '@/lib/api'
import type { Advertise, AdvertiseForm } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: AdvertiseForm = {
  title: '',
  position: '',
  imageUrl: '',
  linkUrl: '',
  sort: '0',
  status: true,
}

export function advertiseToForm(item: Advertise): AdvertiseForm {
  return {
    title: item.title,
    position: item.position,
    imageUrl: item.imageUrl ?? '',
    linkUrl: item.linkUrl ?? '',
    sort: String(item.sort),
    status: item.status === 1,
  }
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'title', title: '标题' },
  { key: 'position', title: '位置' },
  { key: 'imageUrl', title: '图片' },
  { key: 'linkUrl', title: '链接' },
  { key: 'sort', title: '排序' },
  { key: 'status', title: '状态', formatter: (v: unknown) => (v === 1 ? '启用' : '禁用') },
  { key: 'createdAt', title: '创建时间' },
]
