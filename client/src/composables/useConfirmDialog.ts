/**
 * 统一确认对话框 Composable
 * 提供统一的删除、操作确认对话框
 */

import { ElMessageBox } from 'element-plus'
import { useI18n } from 'vue-i18n'

export interface ConfirmDialogOptions {
  title?: string
  message?: string
  confirmButtonText?: string
  cancelButtonText?: string
  type?: 'warning' | 'info' | 'success' | 'error'
  dangerouslyUseHTMLString?: boolean
}

/**
 * 统一确认对话框
 */
export function useConfirmDialog() {
  const { t } = useI18n()

  /**
   * 显示确认对话框
   */
  const confirm = async (
    message: string,
    title?: string,
    options?: ConfirmDialogOptions
  ): Promise<boolean> => {
    try {
      await ElMessageBox.confirm(message, title || t('common.confirm'), {
        confirmButtonText: options?.confirmButtonText || t('common.confirm'),
        cancelButtonText: options?.cancelButtonText || t('common.cancel'),
        type: options?.type || 'warning',
        dangerouslyUseHTMLString: options?.dangerouslyUseHTMLString || false,
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 删除确认对话框
   */
  const confirmDelete = async (
    itemName?: string,
    options?: ConfirmDialogOptions
  ): Promise<boolean> => {
    const message = itemName
      ? t('common.confirmDelete', { name: itemName })
      : t('common.confirmDeleteDefault')
    return confirm(message, options?.title || t('common.delete'), {
      type: 'warning',
      ...options,
    })
  }

  /**
   * 取消确认对话框
   */
  const confirmCancel = async (
    message?: string,
    options?: ConfirmDialogOptions
  ): Promise<boolean> => {
    return confirm(
      message || t('common.confirmCancel'),
      options?.title || t('common.cancel'),
      {
        type: 'info',
        ...options,
      }
    )
  }

  /**
   * 操作确认对话框
   */
  const confirmAction = async (
    message: string,
    title?: string,
    options?: ConfirmDialogOptions
  ): Promise<boolean> => {
    return confirm(message, title || t('common.confirm'), {
      type: 'info',
      ...options,
    })
  }

  /**
   * 提示用户输入对话框
   */
  const showPrompt = async (
    message: string,
    title?: string,
    options?: {
      confirmButtonText?: string
      cancelButtonText?: string
      inputType?: 'text' | 'password'
      inputPlaceholder?: string
      inputValue?: string
      inputPattern?: RegExp
      inputErrorMessage?: string
    }
  ): Promise<string | null> => {
    try {
      const { value } = await ElMessageBox.prompt(
        message,
        title || t('common.inputRequired'),
        {
          confirmButtonText: options?.confirmButtonText || t('common.confirm'),
          cancelButtonText: options?.cancelButtonText || t('common.cancel'),
          inputType: options?.inputType || 'text',
          inputPlaceholder: options?.inputPlaceholder,
          inputValue: options?.inputValue,
          inputPattern: options?.inputPattern,
          inputErrorMessage: options?.inputErrorMessage,
        }
      )
      return value
    } catch {
      return null
    }
  }

  return {
    confirm,
    confirmDelete,
    confirmCancel,
    confirmAction,
    showPrompt,
  }
}
