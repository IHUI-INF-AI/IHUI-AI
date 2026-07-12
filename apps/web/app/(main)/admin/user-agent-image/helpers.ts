import { fetchApi } from '@/lib/api'
import type { UserAgentImage, UserAgentImageForm, UserAgentImageSearch } from './types'

export const PAGE_SIZE = 10

export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const r = await fetchApi<T>(url, options)
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const EMPTY_FORM: UserAgentImageForm = {
  userUuid: '',
  imagePath: '',
  imageName: '',
  type: '',
  platform: '',
  modelName: '',
}

export const EMPTY_SEARCH: UserAgentImageSearch = {
  userUuid: '',
  imageName: '',
  platform: '',
  modelName: '',
}

export const EXPORT_COLUMNS = [
  { key: 'id', title: 'ID' },
  { key: 'userUuid', title: '用户UUID' },
  { key: 'imagePath', title: '图片路径' },
  { key: 'imageName', title: '图片名称' },
  { key: 'type', title: '类型' },
  { key: 'platform', title: '平台' },
  { key: 'modelName', title: '模型名称' },
  { key: 'createdAt', title: '创建时间' },
  { key: 'updatedAt', title: '更新时间' },
]

export function userAgentImageToForm(item: UserAgentImage): UserAgentImageForm {
  return {
    userUuid: item.userUuid ?? '',
    imagePath: item.imagePath ?? '',
    imageName: item.imageName ?? '',
    type: item.type ?? '',
    platform: item.platform ?? '',
    modelName: item.modelName ?? '',
  }
}
