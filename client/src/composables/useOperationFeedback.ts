/**
 * 统一操作反馈 Composable
 * 提供统一的成功/失败消息提示
 */

import { ElMessage } from 'element-plus'
import { useI18n } from 'vue-i18n'
import type { ApiResponse } from '@/types'

/**
 * 消息显示的默认偏移量（顶部菜单栏高度 + 间距）
 * 确保消息显示在顶部菜单栏下方
 */
const MESSAGE_OFFSET = 70

export interface OperationFeedbackOptions {
  /** 成功消息（可以是字符串或函数） */
  successMessage?: string | ((data?: any) => string)
  /** 失败消息（可以是字符串或函数） */
  errorMessage?: string | ((data?: any) => string)
  /** 是否静默失败（不显示错误消息） */
  silent?: boolean
  /** 成功回调 */
  onSuccess?: (data?: any) => void
  /** 失败回调 */
  onError?: (error: any) => void
}

/**
 * 统一操作反馈
 */
export function useOperationFeedback() {
  const { t } = useI18n()

  /**
   * 处理操作结果
   */
  const handleResult = async <T>(
    promise: Promise<ApiResponse<T>>,
    options: OperationFeedbackOptions = {}
  ): Promise<T | null> => {
    try {
      const response = await promise

      if (response.code === 200 || response.success === true) {
        if (options.successMessage !== undefined) {
          const message =
            typeof options.successMessage === 'function'
              ? options.successMessage(response.data)
              : options.successMessage
          ElMessage.success({ message, offset: MESSAGE_OFFSET })
        }
        options.onSuccess?.(response.data)
        return response.data as T
      } else {
        if (!options.silent) {
          const message =
            typeof options.errorMessage === 'function'
              ? options.errorMessage(response.data)
              : options.errorMessage ||
                response.message ||
                t('common.operationFailed') ||
                '操作失败'
          ElMessage.error({ message, offset: MESSAGE_OFFSET })
        }
        options.onError?.(response)
        return null
      }
    } catch (error: any) {
      if (!options.silent) {
        const errorMessage =
          options.errorMessage ||
          (error instanceof Error ? error.message : String(error)) ||
          t('common.operationFailed') ||
          '操作失败'
        ElMessage.error({ message: errorMessage, offset: MESSAGE_OFFSET })
      }
      options.onError?.(error)
      return null
    }
  }

  /**
   * 显示成功消息
   */
  const showSuccess = (message: string) => {
    ElMessage.success({ message, offset: MESSAGE_OFFSET })
  }

  /**
   * 显示错误消息
   */
  const showError = (message: string) => {
    ElMessage.error({ message, offset: MESSAGE_OFFSET })
  }

  /**
   * 显示警告消息
   */
  const showWarning = (message: string) => {
    ElMessage.warning({ message, offset: MESSAGE_OFFSET })
  }

  /**
   * 显示信息消息
   */
  const showInfo = (message: string) => {
    ElMessage.info({ message, offset: MESSAGE_OFFSET })
  }

  return {
    handleResult,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
}
