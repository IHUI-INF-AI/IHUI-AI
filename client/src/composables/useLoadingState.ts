import { ref, computed, type Ref, type ComputedRef } from 'vue'

export interface LoadingState {
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  setError: (error: Error | null) => void
  clearError: () => void
  start: () => void
  stop: () => void
  toggle: () => void
  withLoading: <T>(fn: () => Promise<T>) => Promise<T>
}

export function useLoadingState(initialState = false): LoadingState {
  const isLoading = ref(initialState)
  const error = ref<Error | null>(null)

  const start = () => {
    isLoading.value = true
  }

  const stop = () => {
    isLoading.value = false
  }

  const toggle = () => {
    isLoading.value = !isLoading.value
  }

  const setError = (err: Error | null) => {
    error.value = err
  }

  const clearError = () => {
    error.value = null
  }

  const withLoading = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      start()
      clearError()
      return await fn()
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)))
      throw e
    } finally {
      stop()
    }
  }

  return {
    isLoading,
    error,
    setError,
    clearError,
    start,
    stop,
    toggle,
    withLoading,
  }
}

export interface NamedLoadingState {
  isLoading: (name: string) => boolean
  error: (name: string) => Error | null
  start: (name: string) => void
  stop: (name: string) => void
  setError: (name: string, error: Error | null) => void
  clearError: (name: string) => void
  withLoading: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  loadingNames: ComputedRef<string[]>
}

export function useNamedLoadingState(): NamedLoadingState {
  const loadingMap = ref(new Map<string, boolean>())
  const errorMap = ref(new Map<string, Error | null>())

  const isLoading = (name: string): boolean => loadingMap.value.get(name) ?? false

  const error = (name: string): Error | null => errorMap.value.get(name) ?? null

  const start = (name: string) => {
    loadingMap.value.set(name, true)
  }

  const stop = (name: string) => {
    loadingMap.value.set(name, false)
  }

  const setError = (name: string, err: Error | null) => {
    errorMap.value.set(name, err)
  }

  const clearError = (name: string) => {
    errorMap.value.set(name, null)
  }

  const loadingNames = computed(() => {
    return Array.from(loadingMap.value.entries())
      .filter(([, loading]) => loading)
      .map(([name]) => name)
  })

  const withLoading = async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    try {
      start(name)
      clearError(name)
      return await fn()
    } catch (e) {
      setError(name, e instanceof Error ? e : new Error(String(e)))
      throw e
    } finally {
      stop(name)
    }
  }

  return {
    isLoading,
    error,
    start,
    stop,
    setError,
    clearError,
    withLoading,
    loadingNames,
  }
}

export interface AsyncState<T> {
  data: Ref<T | null>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  execute: () => Promise<T>
  reset: () => void
}

export function useAsyncState<T>(
  fn: () => Promise<T>,
  options: { immediate?: boolean; initialData?: T } = {}
): AsyncState<T> {
  const { immediate = false, initialData } = options

  const data = ref<T | null>(initialData ?? null) as Ref<T | null>
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const execute = async (): Promise<T> => {
    try {
      isLoading.value = true
      error.value = null
      const result = await fn()
      data.value = result
      return result
    } catch (e) {
      error.value = e instanceof Error ? e : new Error(String(e))
      throw e
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    data.value = initialData ?? null
    isLoading.value = false
    error.value = null
  }

  if (immediate) {
    void execute()
  }

  return {
    data,
    isLoading,
    error,
    execute,
    reset,
  }
}
