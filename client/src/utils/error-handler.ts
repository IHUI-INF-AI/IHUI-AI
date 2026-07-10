import { ElMessage } from '@/utils/message'

export function handleApiError(error: unknown, options?: { defaultMessage?: string; silent?: boolean }): void {
  const message = (options?.defaultMessage) || '操作失败'
  let displayMessage = message
  
  if (error instanceof Error) {
    displayMessage = error.message || message
  } else if (typeof error === 'string') {
    displayMessage = error || message
  }
  
  if (!options?.silent) {
    ElMessage.error(displayMessage)
  }
}
