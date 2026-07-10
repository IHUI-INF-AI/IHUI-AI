import { ref } from 'vue'
import type { Ref } from 'vue'

export interface UsePageStateOptions<T = any> {
  defaultValue?: T
  autoShowError?: boolean
}

export function usePageState<T = any>(options?: T | UsePageStateOptions<T>) {
  let defaultValue: T | undefined
  if (options !== null && typeof options === 'object' && options !== undefined && 'defaultValue' in (options as any)) {
    defaultValue = (options as UsePageStateOptions<T>).defaultValue
  } else if (options !== null && typeof options === 'object' && options !== undefined && 'autoShowError' in (options as any)) {
    defaultValue = undefined
  } else {
    defaultValue = options as T | undefined
  }
  const data: Ref<T | undefined> = ref(defaultValue) as Ref<T | undefined>
  const loading = ref(false)
  const error = ref<string | null>(null)

  return { data, loading, error }
}
