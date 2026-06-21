/**
 * Toast 消息提示 Composable
 * 封装 ElMessage 提供统一的 toast 提示
 */

import { ElMessage } from 'element-plus'

/**
 * Toast 消息提示
 */
export function useToast() {
  /**
   * 显示信息消息
   */
  const info = (message: string) => {
    ElMessage.info({ message, offset: 70 })
  }

  /**
   * 显示成功消息
   */
  const success = (message: string) => {
    ElMessage.success({ message, offset: 70 })
  }

  /**
   * 显示错误消息
   */
  const error = (message: string) => {
    ElMessage.error({ message, offset: 70 })
  }

  /**
   * 显示警告消息
   */
  const warning = (message: string) => {
    ElMessage.warning({ message, offset: 70 })
  }

  return {
    info,
    success,
    error,
    warning,
  }
}
