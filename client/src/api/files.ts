import { t } from '@/utils/i18n'

import { COZE_PATHS } from '@/config/backend-paths'

/**
 * 文件上传管理API
 * 对应后端路由：ihui API /file（/cozeZhsApi/file）
 */

import request from '@/utils/request'
import { logger } from '../utils/logger'
import type { ApiResponse } from '@/types'
import { withApiResponseHandler, normalizeApiResponse } from '@/utils/api-response'

// 文件信息接口
export interface FileInfo {
  id: string
  user_uuid: string
  filename: string
  original_filename: string
  file_path: string
  file_url: string
  url?: string // 兼容字段
  file_type: 'image' | 'video' | 'audio' | 'document' | 'other'
  mime_type: string
  file_size: number
  status: string
  created_at: string
  updated_at: string
}

// 文件列表响应
export interface FileListResponse {
  files: FileInfo[]
  pagination: {
    page: number
    page_size: number
    total: number
    total_pages: number
  }
}

// 文件转流（下载文件）
export const fileToStream = withApiResponseHandler(
  async (file: string): Promise<ApiResponse<Blob>> => {
    const response = await request.post<Blob>(
      '/fund/file/to/stream',
      { file },
      {
        responseType: 'blob',
      }
    )
    return normalizeApiResponse(response)
  }
)

// 上传请求超时（秒），避免服务无响应时一直卡在「上传中」
const UPLOAD_REQUEST_TIMEOUT_MS = 90 * 1000

// 文件上传（表单上传）
// 使用 uploadForm：ihui API /file/upload/form（fundUpload /fund/file/upload 在后端 zca 上可能未部署会 404）
// 注意：不要手动设置 Content-Type，让浏览器自动添加 multipart/form-data; boundary=...，否则服务端可能解析失败返回 500
export const uploadFile = withApiResponseHandler(
  async (file: File): Promise<ApiResponse<FileInfo>> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await request.post<FileInfo>(COZE_PATHS.file.uploadForm, formData, {
      base: 3,
      timeout: UPLOAD_REQUEST_TIMEOUT_MS,
      // FormData 必须由浏览器/axios 自动设置 Content-Type（含 boundary），否则服务端解析会 500
      transformRequest: [(data, headers) => {
        if (data instanceof FormData && headers) {
           
          delete (headers as Record<string, unknown>)['Content-Type']
        }
        return data
      }],
    })
    return normalizeApiResponse(response)
  }
)

// 表单文件上传（别名）
export const uploadFormFile = uploadFile

// Base64图片上传
export const uploadBase64Image = withApiResponseHandler(
  async (data: { base64: string; filename?: string }): Promise<ApiResponse<FileInfo>> => {
    const response = await request.post<FileInfo>(
      COZE_PATHS.file.mobileUploadBase64,
      data
    )
    return normalizeApiResponse(response)
  }
)

// Octet-Stream方式上传文件
export const uploadOctetStream = withApiResponseHandler(
  async (fileBytes: ArrayBuffer | Blob, fileName: string): Promise<ApiResponse<FileInfo>> => {
    const response = await request.post<FileInfo>(
      COZE_PATHS.file.uploadOctet(fileName),
      fileBytes,
      {
        headers: {
          'Content-Type': 'application/octet-stream',
        },
      }
    )
    return normalizeApiResponse(response)
  }
)

// 获取文件列表
export const getFileList = withApiResponseHandler(
  async (params?: {
    file_type?: string
    page?: number
    page_size?: number
  }): Promise<ApiResponse<FileListResponse>> => {
    const response = await request.get<FileListResponse>(COZE_PATHS.file.list, { params })
    return normalizeApiResponse(response)
  }
)

// 下载文件（通过文件名）
export const downloadFile = async (filename: string): Promise<void> => {
  try {
    const response = await fetch(COZE_PATHS.file.download(filename))
    if (!response.ok) {
      throw new Error(t('error.files.文件下载失败'))
    }
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    logger.error('[Files] File download failed:', error)
    throw error
  }
}

// 获取文件信息
export const getFileInfo = withApiResponseHandler(
  async (fileId: string): Promise<ApiResponse<FileInfo>> => {
    const response = await request.get<FileInfo>(COZE_PATHS.file.byId(fileId))
    return normalizeApiResponse(response)
  }
)

// 删除文件
export const deleteFile = withApiResponseHandler(
  async (fileId: string): Promise<ApiResponse<null>> => {
    const response = await request.delete<null>(COZE_PATHS.file.byId(fileId))
    return normalizeApiResponse(response)
  }
)
