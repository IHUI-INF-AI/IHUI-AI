/**
 * 头像上传 Composable
 *
 * 提供统一的头像上传功能，包含文件验证、上传、错误处理
 * 
 * @example
 * ```typescript
 * const { 
 *   avatarUrl, 
 *   isUploading, 
 *   openAvatarPicker,
 *   uploadAvatar 
 * } = useAvatarUpload({
 *   onSuccess: (url) => console.log('上传成功:', url),
 *   onError: (error) => console.error('上传失败:', error),
 * })
 * ```
 *
 * @packageDocumentation
 */

import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import { uploadFile } from '@/api/file-upload'
import { logger } from '@/utils/logger'

/**
 * 头像上传配置常量
 */
export const AVATAR_CONFIG = {
  /** 允许的文件类型 */
  ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  /** 文件类型的accept字符串 */
  ACCEPT_STRING: 'image/jpeg,image/png,image/gif,image/webp',
  /** 最大文件大小 (2MB) */
  MAX_SIZE: 2 * 1024 * 1024,
  /** 最大文件大小文本 */
  MAX_SIZE_TEXT: '2MB',
} as const

/**
 * useAvatarUpload 配置选项
 */
export interface UseAvatarUploadOptions {
  /** 初始头像URL */
  initialUrl?: string
  /** 上传成功回调 */
  onSuccess?: (url: string, filename: string) => void
  /** 上传失败回调 */
  onError?: (error: Error) => void
  /** 自定义文件验证 */
  validateFile?: (file: File) => boolean | string
  /** 最大文件大小（字节），默认2MB */
  maxSize?: number
  /** 允许的文件类型 */
  allowedTypes?: string[]
}

/**
 * 头像上传结果
 */
export interface AvatarUploadResult {
  /** 头像URL */
  url: string
  /** 文件名 */
  filename: string
}

/**
 * 头像上传 Composable
 *
 * @param options - 配置选项
 * @returns 头像上传状态和方法
 */
export function useAvatarUpload(options: UseAvatarUploadOptions = {}) {
  const {
    initialUrl = '',
    onSuccess,
    onError,
    validateFile,
    maxSize = AVATAR_CONFIG.MAX_SIZE,
    allowedTypes = AVATAR_CONFIG.ALLOWED_TYPES,
  } = options

  const { t } = useI18n()

  // 状态
  const avatarUrl = ref(initialUrl)
  const filename = ref('')
  const isUploading = ref(false)
  const uploadError = ref<string | null>(null)

  /**
   * 验证文件
   */
  const validateFileInternal = (file: File): string | null => {
    // 自定义验证
    if (validateFile) {
      const result = validateFile(file)
      if (typeof result === 'string') {
        return result
      }
      if (result === false) {
        return t('common.errors.invalidFile', '文件验证失败')
      }
    }

    // 验证文件类型
    if (!(allowedTypes as readonly string[]).includes(file.type)) {
      return t('common.errors.invalidFileType', '不支持的文件类型，请上传 JPG、PNG、GIF 或 WebP 格式的图片')
    }

    // 验证文件大小
    if (file.size > maxSize) {
      return t('common.errors.fileTooLarge', `文件大小不能超过 ${AVATAR_CONFIG.MAX_SIZE_TEXT}`)
    }

    return null
  }

  /**
   * 上传头像文件
   */
  const uploadAvatar = async (file: File): Promise<AvatarUploadResult | null> => {
    // 验证文件
    const validationError = validateFileInternal(file)
    if (validationError) {
      uploadError.value = validationError
      ElMessage.error(validationError)
      onError?.(new Error(validationError))
      return null
    }

    isUploading.value = true
    uploadError.value = null

    try {
      // 上传文件
      const uploadRes = await uploadFile(file, { folder: 'avatars' })
      
      if (uploadRes && uploadRes.data) {
        // 处理不同的响应格式
        const fileInfo = uploadRes.data as unknown as Record<string, unknown>
        const url = (fileInfo.url || fileInfo.file_url || '') as string
        const name = (fileInfo.filename || file.name || '') as string

        if (url) {
          avatarUrl.value = url
          filename.value = name
          
          // 持久化到 localStorage（可选）
          localStorage.setItem('avatarPic', url)
          
          onSuccess?.(url, name)
          
          return { url, filename: name }
        }
      }

      throw new Error(t('error.use_avatar_upload.上传响应格式错误'))
    } catch (err) {
      const error = err instanceof Error ? err : new Error('上传失败')
      uploadError.value = error.message
      logger.error('[AvatarUpload] Failed to upload avatar:', err)
      ElMessage.error(t('common.errors.uploadFailed', '上传失败，请重试'))
      onError?.(error)
      return null
    } finally {
      isUploading.value = false
    }
  }

  /**
   * 打开文件选择器
   */
  const openAvatarPicker = (): void => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = AVATAR_CONFIG.ACCEPT_STRING
    
    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement
      const file = target.files?.[0]

      // 清理 input 元素
      input.onchange = null
      input.remove()

      if (file) {
        await uploadAvatar(file)
      }
    }

    input.click()
  }

  /**
   * 重置状态
   */
  const reset = (): void => {
    avatarUrl.value = initialUrl
    filename.value = ''
    uploadError.value = null
    isUploading.value = false
  }

  /**
   * 设置头像URL（不上传）
   */
  const setAvatarUrl = (url: string): void => {
    avatarUrl.value = url
  }

  return {
    // 状态
    avatarUrl,
    filename,
    isUploading,
    uploadError,

    // 方法
    uploadAvatar,
    openAvatarPicker,
    reset,
    setAvatarUrl,

    // 配置
    config: AVATAR_CONFIG,
  }
}
