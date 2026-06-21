import { t } from '@/utils/i18n'

/**
 * 文件服务
 * 使用统一的 API 客户端
 */

import { apiClient } from '../client'
import type { ApiResponse } from '@/types'
// 定义 FileUploadResponse
interface _FileUploadResponse {
  url: string
  filename: string
  size: number
  [key: string]: any
}

/**
 * 文件信息
 */
export interface FileInfo {
  id: string
  url: string
  filename: string
  originalname: string
  size: number
  mimetype: string
  file_type: string
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
          if (response.code === 200) {
            resolve(response)
          } else {
            reject(new Error(response.msg || '上传失败'))
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
    const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
    xhr.open('POST', `${baseURL}/mobile/files/upload`)
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
  return apiClient.post<FileInfo>('/mobile/files/upload/base64', {
    base64,
    filename,
  })
}

/**
 * 上传 Octet-Stream 文件
 */
export async function uploadOctetStream(
  file: Blob | ArrayBuffer,
  fileName: string
): Promise<ApiResponse<FileInfo>> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = apiClient.getToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/octet-stream',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(
    `${baseURL}/mobile/files/upload/octet?file_name=${encodeURIComponent(fileName)}`,
    {
      method: 'POST',
      headers,
      body: file instanceof Blob ? file : new Blob([file]),
    }
  )

  const data = await response.json()
  if (data.code === 200) {
    return data
  } else {
    throw new Error(data.msg || '上传失败')
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
  return apiClient.getPaginated<FileInfo>('/mobile/files', {
    page: params?.page || 1,
    pageSize: params?.pageSize || 20,
    ...(params?.fileType && { file_type: params.fileType }),
  })
}

/**
 * 获取文件详情
 */
export async function getFileDetail(fileId: string): Promise<ApiResponse<FileInfo>> {
  return apiClient.get<FileInfo>(`/mobile/files/${fileId}`)
}

/**
 * 删除文件
 */
export async function deleteFile(fileId: string): Promise<ApiResponse<void>> {
  return apiClient.delete(`/mobile/files/${fileId}`)
}

/**
 * 下载文件
 */
export async function downloadFile(fileId: string): Promise<Blob> {
  const baseURL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
  const token = apiClient.getToken()

  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(`${baseURL}/mobile/files/${fileId}/download`, {
    headers,
  })

  if (!response.ok) {
    throw new Error(t('error.file_service.下载失败'))
  }

  return response.blob()
}
