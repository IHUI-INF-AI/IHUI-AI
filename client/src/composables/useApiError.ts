import { ref } from 'vue'
import type { Ref } from 'vue'
import { ElMessage } from '@/utils/message'

export interface UseApiErrorOptions {
  showMessage?: boolean
}

export function useApiError(options?: UseApiErrorOptions) {
  const loading: Ref<boolean> = ref(false)

  const execute = async <T>(
    fn: () => Promise<T>,
    opts?: UseApiErrorOptions
  ): Promise<T | null> => {
    const showMessage = opts?.showMessage ?? options?.showMessage ?? true
    loading.value = true
    try {
      return await fn()
    } catch (err) {
      if (showMessage) {
        const message = err instanceof Error ? err.message : String(err)
        ElMessage.error(message)
      }
      return null
    } finally {
      loading.value = false
    }
  }

  return { loading, execute }
}
