import { t } from '@/utils/i18n'

/**
 * 文件服务
 * 使用统一的 API 客户端
 */

import { apiClient } from '../client'
import { COZE_PATHS } from '@/config/backend-paths'
import type { ApiResponse } from '@/types'
// 定义 FileUploadResponse
interface _FileUploadResponse {
  url: string
  filename: string
  size: number
  [key: string]: unknown
}

/**
 * 文件信息
 */
export interface FileInfo {
  id: string | number
  url?: string
  filename?: string
  file_name?: string
  file_path?: string
  originalname?: string
  size?: number
  file_size?: number
  mimetype?: string
  file_type?: string
  bucket?: string
  user_uuid?: string
  createdAt?: string
}

/**
 * 文件上传选项
 */
export interface FileUploadOptions {
  onProgress?: (progress: { loaded: number; total: number; percentage: number }) => void
  maxFileSize?: number
  allowedTypes?: string[]
}

/**
 * 上传文件（表单方式）
 */
export async function uploadFile(
  file: File,
  options?: FileUploadOptions
): Promise<ApiResponse<FileInfo>> {
  // 检查文件大小
  if (options?.maxFileSize && file.size > options.maxFileSize) {
    throw new Error(`文件大小超过限制 (${options.maxFileSize} bytes)`)
  }

  // 检查文件类型
  if (options?.allowedTypes && !options.allowedTypes.includes(file.type)) {
    throw new Error(`不支持的文件类型: ${file.type}`)
  }

  const formData = new FormData()
  formData.append('file', file)

  // 使用原生 fetch 以支持上传进度
  const token = apiClient.getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()

    // 上传进度
    if (options?.onProgress) {
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) {
          options.onProgress!({
            loaded: e.loaded,
            total: e.total,
            percentage: Math.round((e.loaded / e.total) * 100),
          })
        }
      })
    }

    // 完成
    xhr.addEventListener('load', () => {
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText)
          // 2026-06-29 联调: 后端 file_upload.py 返回 {code:0, message, url}
          // 标准化为 ApiResponse<FileInfo>, 让下游 code===200 判断生效
          if (response.code === 0 || response.code === '0' || response.code === 200) {
            resolve({
              code: 200,
              success: true,
              message: response.message || 'success',
              data: {
                id: response.id || '',
                url: response.url,
                filename: file.name,
                file_name: file.name,
                size: file.size,
                file_size: file.size,
                mimetype: file.type,
                file_type: file.type,
              } as FileInfo,
              timestamp: Date.now(),
            })
          } else {
            reject(new Error(response.message || response.msg || '上传失败'))
          }
        } catch (error) {
          reject(error)
        }
      } else {
        reject(new Error(`上传失败: ${xhr.statusText}`))
      }
    })

    // 错误
    xhr.addEventListener('error', () => {
      reject(new Error('上传失败'))
    })

    // 发送请求
    // 2026-06-29 联调: 对齐后端 file_upload.py POST /cozeZhsApi/file/upload/form
    xhr.open('POST', COZE_PATHS.file.uploadForm)
    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value)
    })
    xhr.send(formData)
  })
}

/**
 * 上传 Base64 图片
 */
export async function uploadBase64Image(
  base64: string,
  filename?: string
): Promise<ApiResponse<FileInfo>> {
  // 2026-06-29 联调: 对齐后端 file_upload.py POST /cozeZhsApi/file/upload/base64
  // 后端 Base64UploadRequest 字段为 fileName + base64 (alias populate_by_name)
  // 返回 {code:0, message, url}, 标准化为 ApiResponse<FileInfo> (code:200)
  const fileName = filename || `file_${Date.now()}.png`
  const token = apiClient.getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const response = await fetch(COZE_PATHS.file.uploadBase64, {
    method: 'POST',
    headers,
    body: JSON.stringify({ fileName, base64 }),
  })
  const data = await response.json()
  if (data.code === 0 || data.code === '0' || data.code === 200) {
    return {
      code: 200,
      success: true,
      message: data.message || 'success',
      data: {
        id: data.id || '',
        url: data.url,
        filename: fileName,
        file_name: fileName,
      } as FileInfo,
      timestamp: Date.now(),
    }
  } else {
    throw new Error(data.message || data.msg || '上传失败')
  }
}

/**
 * 上传 Octet-Stream 文件
 */
export async function uploadOctetStream(
  file: Blob | ArrayBuffer,
  fileName: string
): Promise<ApiResponse<FileInfo>> {
  const token = apiClient.getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  // 2026-06-29 联调: 对齐后端 file_upload.py POST /cozeZhsApi/file/upload/octet?file_name=...
  const response = await fetch(COZE_PATHS.file.uploadOctet(fileName), {
    method: 'POST',
    headers,
    body: file instanceof Blob ? file : new Blob([file]),
  })

  const data = await response.json()
  // 2026-06-29 联调: 后端返回 {code:0, message, url}, 标准化为 ApiResponse<FileInfo>
  if (data.code === 0 || data.code === '0' || data.code === 200) {
    return {
      code: 200,
      success: true,
      message: data.message || 'success',
      data: {
        id: data.id || '',
        url: data.url,
        filename: fileName,
        file_name: fileName,
        size: file instanceof Blob ? file.size : (file as ArrayBuffer).byteLength,
        file_size: file instanceof Blob ? file.size : (file as ArrayBuffer).byteLength,
      } as FileInfo,
      timestamp: Date.now(),
    }
  } else {
    throw new Error(data.message || data.msg || '上传失败')
  }
}

/**
 * 获取文件列表
 */
export async function getFileList(params?: {
  page?: number
  pageSize?: number
  fileType?: string
}): Promise<
  ApiResponse<{
    items: FileInfo[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }>
> {
  // 2026-06-29 联调: 对齐后端 file_storage.py GET /api/v1/content/files/list
  // 后端参数为 page + limit (非 pageSize) + file_type
  // 后端返回 {code:"0", msg, data:[...], total:N}, total 在顶层 (非 data 内)
  // apiClient.normalizeResponse 仅保留 code/msg/data, 故此处用 fetch 保留 total
  const page = params?.page || 1
  const pageSize = params?.pageSize || 20
  const token = apiClient.getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  const query = new URLSearchParams({
    page: String(page),
    limit: String(pageSize),
  })
  if (params?.fileType) {
    query.set('file_type', params.fileType)
  }
  const response = await fetch(`/api/v1/content/files/list?${query.toString()}`, { headers })
  const json = await response.json()
  // 兼容后端 data 为数组或 {items} 两种形式
  const rawItems = Array.isArray(json.data) ? json.data : (json.data?.items || [])
  const total = typeof json.total === 'number' ? json.total : rawItems.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  return {
    code: json.code === 0 || json.code === '0' ? 200 : (json.code ?? response.status),
    success: json.code === 0 || json.code === '0' || (response.status >= 200 && response.status < 300),
    message: json.msg || json.message || 'success',
    data: {
      items: rawItems as FileInfo[],
      total,
      page,
      pageSize,
      totalPages,
    },
    timestamp: Date.now(),
  }
}

/**
 * 获取文件详情
 */
export async function getFileDetail(fileId: string): Promise<ApiResponse<FileInfo>> {
  // 2026-06-29 联调: 后端 file_storage.py 无 detail 端点, 仅 list 返回字段
  // 调用 list 端点 + 客户端过滤取详情, 适配小规模场景; 大规模场景应让上层直接持有 upload 返回的 url
  const list = await getFileList({ page: 1, pageSize: 100 })
  const items = list.data?.items || []
  const found = items.find(f => String(f.id) === String(fileId))
  if (!found) {
    throw new Error('文件不存在')
  }
  return { ...list, data: found }
}

/**
 * 删除文件
 */
export async function deleteFile(fileId: string): Promise<ApiResponse<void>> {
  // 2026-06-29 联调: 对齐后端 file_storage.py DELETE /api/v1/content/files/{file_id}
  return apiClient.delete(`/api/v1/content/files/${fileId}`)
}

/**
 * 下载文件
 */
export async function downloadFile(fileId: string): Promise<Blob> {
  // 2026-06-29 联调: 后端无下载端点, 通过 getFileDetail 拿到 url 后直接 fetch
  const detail = await getFileDetail(fileId)
  const url = detail.data?.url || detail.data?.file_path
  if (!url) {
    throw new Error(t('error.file_service.下载失败'))
  }

  const token = apiClient.getToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(t('error.file_service.下载失败'))
  }

  return response.blob()
}
