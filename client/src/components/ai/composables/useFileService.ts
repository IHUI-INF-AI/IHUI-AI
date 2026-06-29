import { type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Timestamp } from '@/types/ai-platform.types'
import { logger } from '@/utils/logger'

/**
 * 已上传文件项结构
 */
export interface UploadedFile {
  id: string
  name: string
  type: string
  preview: string
  size?: number
  uploadedAt: Timestamp
}

/** 单文件大小上限：10MB */
export const MAX_FILE_SIZE = 10 * 1024 * 1024
/** 最大文件数量 */
export const MAX_FILES = 10

interface UseFileServiceOptions {
  uploadedFiles: Ref<UploadedFile[]>
  showWarning: (msg: string) => void
  showError: (msg: string) => void
  showSuccess: (msg: string) => void
}

/**
 * 文件上传/移除/下载逻辑（从 AIChat.vue 抽取）
 *
 * 设计说明：
 * - uploadedFiles 作为外部 Ref 注入，便于父组件继续直接访问与 v-for 渲染
 * - 通知回调（showWarning/showError/showSuccess）由 useOperationFeedback 提供，避免重复创建
 * - MAX_FILE_SIZE / MAX_FILES 作为常量导出，便于模板或其他逻辑引用
 */
export function useFileService(options: UseFileServiceOptions) {
  const { uploadedFiles, showWarning, showError, showSuccess } = options
  const { t } = useI18n()

  /**
   * 触发文件选择对话框并处理选中的文件
   * @param command 'image' | 'file' | 其他 → 决定 accept 与类型校验
   */
  const handleFileUpload = async (command: string) => {
    if (uploadedFiles.value.length >= MAX_FILES) {
      showWarning(t('floatingChat.maxFilesReached', { max: MAX_FILES }))
      return
    }

    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true

    // 根据命令设置接受的文件类型
    switch (command) {
      case 'image':
        input.accept = 'image/*'
        break
      case 'file':
        input.accept = '*/*'
        break
      default:
        input.accept = '*/*'
    }

    input.onchange = (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])

      // 检查文件数量
      if (uploadedFiles.value.length + files.length > MAX_FILES) {
        showWarning(t('floatingChat.maxFilesReached', { max: MAX_FILES }))
        return
      }

      // 处理每个文件
      files.forEach((file) => {
        // 检查文件大小
        if (file.size > MAX_FILE_SIZE) {
          showError(t('floatingChat.fileTooLarge', { name: file.name, max: '10MB' }))
          return
        }

        // 检查文件类型
        if (command === 'image' && !file.type.startsWith('image/')) {
          showError(t('floatingChat.invalidFileType', { name: file.name, type: t('common.image') }))
          return
        }

        const reader = new FileReader()
        reader.onerror = () => {
          showError(t('floatingChat.fileReadFailed', { name: file.name }))
        }
        reader.onload = (event) => {
          uploadedFiles.value.push({
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
            name: file.name,
            type: file.type,
            preview: event.target?.result as string,
            size: file.size,
            uploadedAt: Date.now() as Timestamp,
          })
        }
        reader.readAsDataURL(file)
      })
    }
    input.click()
  }

  /**
   * 移除指定索引的文件，并撤销 blob: URL 资源
   */
  const removeFile = (index: number) => {
    const file = uploadedFiles.value[index]
    if (file && file.preview && file.preview.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(file.preview)
      } catch (error) {
        // 忽略错误（可能是URL已被撤销）
        if (import.meta.env.DEV) {
          logger.debug(t('common.errors.operationFailed'), error)
        }
      }
    }
    uploadedFiles.value.splice(index, 1)
  }

  /**
   * 下载指定文件
   */
  const downloadFile = (file: { name: string; preview: string; type?: string }) => {
    try {
      const link = document.createElement('a')
      link.href = file.preview
      link.download = file.name
      link.target = '_blank'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      showSuccess(t('floatingChat.fileDownloaded', { name: file.name }))
    } catch (error) {
      logger.error(t('common.errors.downloadFailed'), error)
      showError(t('floatingChat.fileDownloadFailed'))
    }
  }

  return { handleFileUpload, removeFile, downloadFile }
}
