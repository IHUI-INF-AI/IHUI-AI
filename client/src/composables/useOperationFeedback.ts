import { ref } from 'vue'
import type { Ref } from 'vue'
import { ElMessage } from '@/utils/message'

export interface HandleResultOptions {
  successMessage?: string | ((data: unknown) => string)
  errorMessage?: string
  onSuccess?: () => void
  onError?: (error: unknown) => void
}

export function useOperationFeedback() {
  const loading: Ref<boolean> = ref(false)
  const success: Ref<boolean> = ref(false)
  const error: Ref<string | null> = ref(null)

  const showSuccess = (message: string) => {
    ElMessage.success(message)
  }

  const showWarning = (message: string) => {
    ElMessage.warning(message)
  }

  const showError = (message: string) => {
    ElMessage.error(message)
    error.value = message
  }

  const wrap = async <T>(fn: () => Promise<T>): Promise<T | null> => {
    loading.value = true
    success.value = false
    error.value = null
    try {
      const result = await fn()
      success.value = true
      return result
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      return null
    } finally {
      loading.value = false
    }
  }

  const handleResult = async <T>(
    promise: Promise<T>,
    options?: HandleResultOptions
  ): Promise<T | null> => {
    loading.value = true
    try {
      const result = await promise
      success.value = true
      if (options?.successMessage) {
        const msg = typeof options.successMessage === 'function'
          ? options.successMessage(result)
          : options.successMessage
        showSuccess(msg)
      }
      if (options?.onSuccess) {
        options.onSuccess()
      }
      return result
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e)
      error.value = errorMsg
      if (options?.errorMessage) {
        showError(options.errorMessage)
      } else {
        showError(errorMsg)
      }
      if (options?.onError) {
        options.onError(e)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  const reset = () => {
    loading.value = false
    success.value = false
    error.value = null
  }

  return { loading, success, error, wrap, reset, showSuccess, showWarning, showError, handleResult }
}
