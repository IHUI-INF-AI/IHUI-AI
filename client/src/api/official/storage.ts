/**
 * 文件存储管理 API
 * 对接后端 /admin/official/storage/* 端点
 */

import http from '@/utils/request'

export interface StorageItem {
  id: number
  name: string
  type: string
  endpoint: string
  bucket: string
  access_key: string
  secret_key: string
  region: string
  is_default: boolean
  status: number
  create_time: string
}

/** 查询存储列表 */
export function listStorage(params?: Record<string, any>) {
  return http.get('/admin/official/storage/list', { params })
}

/** 新增存储 */
export function addStorage(data: Partial<StorageItem>) {
  return http.post('/admin/official/storage', data)
}

/** 更新存储 */
export function updateStorage(data: Partial<StorageItem> & { id: number | string }) {
  return http.put('/admin/official/storage', data)
}

/** 删除存储 */
export function delStorage(id: number | string) {
  return http.delete('/admin/official/storage', { params: { id } })
}
