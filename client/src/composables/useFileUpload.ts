import { t } from '@/utils/i18n'

/**
 * 文件上传 Composables
 * 使用统一的文件服务
 */

import { ref } from 'vue'
import { logger } from '../utils/logger'
import { ElMessage } from 'element-plus'
import { getI18nGlobal } from '@/locales'
import {
  uploadFile,
  uploadBase64Image,
  uploadOctetStream,
  type FileInfo,
  type FileUploadOptions,
} from '@/api/services/file.service'

/**
 * 使用文件上传
 */
export function useFileUpload() {
  const uploading = ref(false)
  const uploadProgress = ref(0)
  const uploadedFiles = ref<FileInfo[]>([])

  /**
   * 上传文件
   */
  const handleUpload = async (
    file: File,
    options?: FileUploadOptions
  ): Promise<FileInfo | null> => {
    uploading.value = true
    uploadProgress.value = 0

    try {
      const response = await uploadFile(file, {
        ...options,
        onProgress: progress => {
          uploadProgress.value = progress.percentage
          options?.onProgress?.(progress)
        },
      })

      if (response.code === 200 && response.data) {
        uploadedFiles.value.push(response.data)
        ElMessage.success(String(getI18nGlobal().t('messages.uploadSuccess')))
        return response.data
      } else {
        throw new Error(response.message || '上传失败')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_file_upload.上传失败')
      ElMessage.error(errorMessage)
      throw error
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }
  }

  /**
   * 上传 Base64 图片
   */
  const handleUploadBase64 = async (
    base64: string,
    filename?: string
  ): Promise<FileInfo | null> => {
    uploading.value = true

    try {
      const response = await uploadBase64Image(base64, filename)

      if (response.code === 200 && response.data) {
        uploadedFiles.value.push(response.data)
        ElMessage.success(String(getI18nGlobal().t('messages.uploadSuccess')))
        return response.data
      } else {
        throw new Error(response.message || '上传失败')
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_file_upload.上传失败1')
      ElMessage.error(errorMessage)
      throw error
    } finally {
      uploading.value = false
    }
  }

  /**
   * 批量上传文件
   */
  const handleBatchUpload = async (
    files: File[],
    options?: FileUploadOptions
  ): Promise<FileInfo[]> => {
    const results: FileInfo[] = []

    for (const file of files) {
      try {
        const result = await handleUpload(file, options)
        if (result) {
          results.push(result)
        }
      } catch (error) {
        logger.error(`Upload file ${file.name} failed:`, error)
      }
    }

    return results
  }

  /**
   * 上传二进制流（octet-stream）
   */
  const handleUploadOctetStream = async (
    data: ArrayBuffer | Blob | string,
    fileName: string
  ): Promise<FileInfo | null> => {
    uploading.value = true
    uploadProgress.value = 0
    try {
      const payload = typeof data === 'string' ? new TextEncoder().encode(data).buffer : data

      const response = await uploadOctetStream(payload, fileName)
      if (response.code === 200 && response.data) {
        uploadedFiles.value.push(response.data)
        ElMessage.success(String(getI18nGlobal().t('messages.uploadSuccess')))
        return response.data
      }
      throw new Error(response.message || '上传失败')
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t('api.use_file_upload.上传失败2')
      ElMessage.error(errorMessage)
      throw error
    } finally {
      uploading.value = false
      uploadProgress.value = 0
    }
  }

  /**
   * 清除上传记录
   */
  const clearUploadedFiles = () => {
    uploadedFiles.value = []
  }

  return {
    // 状态
    uploading,
    uploadProgress,
    uploadedFiles,

    // 方法
    upload: handleUpload,
    uploadBase64: handleUploadBase64,
    batchUpload: handleBatchUpload,
    uploadOctetStream: handleUploadOctetStream,
    clearUploadedFiles,
  } as const
}
