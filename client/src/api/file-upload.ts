/**
 * 文件上传 API
 * 提供文件上传相关的接口
 *
 * 路径对应后端路由 (app/api/v1/content/file_upload.py):
 *   - POST /cozeZhsApi/file/upload/form  表单上传 (upload_form_file)
 *   - POST /cozeZhsApi/file/upload/base64  base64 上传 (upload_base64_file)
 *
 * 注意: 后端返回 {code, message, url}, 前端适配为 ApiResponse<{url, filename, size}>
 *       使用 base: 3 (空 baseURL) + Vite proxy /cozeZhsApi → 本地后端 8000
 */

import request from '@/utils/request'
import { COZE_PATHS } from '@/config/backend-paths'
import type { ApiResponse } from '@/types/api'

/** 后端 upload_form_file 返回体 */
interface UploadFormResponse {
  code: number
  message: string
  url: string | null
}

/** 将后端 {code, message, url} 适配为 ApiResponse<{url, filename, size}> */
function adaptUploadResponse(resp: { data?: UploadFormResponse }, filename?: string): ApiResponse<{ url: string; filename: string; size: number }> {
  const body = resp?.data
  const url = body?.url || ''
  return {
    code: body?.code ?? 0,
    message: body?.message ?? 'success',
    data: {
      url,
      filename: filename || (url ? url.split('/').pop() || '' : ''),
      size: 0,
    },
    success: body?.code === 0,
    timestamp: Date.now(),
  }
}

/**
 * 上传表单文件
 * 支持 FormData 或 File 对象
 */
export async function uploadFormFile(
  formDataOrFile: FormData | File
): Promise<ApiResponse<{ url: string; filename: string; size: number }>> {
  const isFormData = formDataOrFile instanceof FormData
  const formData = isFormData ? formDataOrFile : (() => {
    const fd = new FormData()
    fd.append('file', formDataOrFile)
    return fd
  })()
  const file = isFormData ? (formData.get('file') as File | null) : formDataOrFile

  const response = await request.post(COZE_PATHS.file.uploadForm, formData, {
    base: 3,
    timeout: 90000,
    transformRequest: [(data, headers) => {
      if (data instanceof FormData && headers) {
        delete (headers as Record<string, unknown>)['Content-Type']
      }
      return data
    }],
  })
  return adaptUploadResponse(response as { data?: UploadFormResponse }, file?.name)
}

/**
 * 上传文件并创建审查
 *
 * 后端端点: POST /cozeZhsApi/file/agent-examine (upload_agent_and_examine)
 * 接收 file + name + description + type, 返回 {code, message, data: {id, url}}
 */
export async function uploadAgentAndCreateExamine(
  file: File,
  data: {
    name: string
    description?: string
    type?: string
  }
): Promise<ApiResponse<{ id: string; url: string }>> {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('name', data.name)
  if (data.description) formData.append('description', data.description)
  if (data.type) formData.append('type', data.type)

  const response = await request.post(COZE_PATHS.file.uploadAgentExamine, formData, {
    base: 3,
    timeout: 90000,
    transformRequest: [(d, headers) => {
      if (d instanceof FormData && headers) {
        delete (headers as Record<string, unknown>)['Content-Type']
      }
      return d
    }],
  })
  const body = (response as { data?: { code?: number; message?: string; data?: { id: string; url: string } } })?.data
  return {
    code: body?.code ?? 0,
    message: body?.message ?? 'success',
    data: body?.data ?? { id: '', url: '' },
    success: body?.code === 0,
    timestamp: Date.now(),
  }
}

/**
 * 上传文件
 */
export async function uploadFile(
  file: File,
  options?: {
    folder?: string
    filename?: string
  }
): Promise<ApiResponse<{ url: string; filename: string; size: number }>> {
  const formData = new FormData()
  formData.append('file', file)
  if (options?.folder) formData.append('folder', options.folder)
  if (options?.filename) formData.append('filename', options.filename)

  const response = await request.post(COZE_PATHS.file.uploadForm, formData, {
    base: 3,
    timeout: 90000,
    transformRequest: [(data, headers) => {
      if (data instanceof FormData && headers) {
        delete (headers as Record<string, unknown>)['Content-Type']
      }
      return data
    }],
  })
  return adaptUploadResponse(response as { data?: UploadFormResponse }, options?.filename || file.name)
}
