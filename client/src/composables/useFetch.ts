import { ref, onUnmounted, type Ref, type ComputedRef, computed } from 'vue'
import { apiClient } from '@/api/core/client'
import type { ApiResponse, PaginatedResponse } from '@/types/common'

export interface UseFetchOptions<T> {
  immediate?: boolean
  initialData?: T
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  transform?: (data: T) => T
}

export interface UseFetchReturn<T> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  isFetching: Ref<boolean>
  execute: () => Promise<T>
  abort: () => void
  reset: () => void
}

export function useFetch<T>(
  url: string | (() => string),
  options: UseFetchOptions<T> = {}
): UseFetchReturn<T> {
  const { immediate = false, initialData, onSuccess, onError, transform } = options

  const data = ref<T | null>(initialData ?? null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)
  const isFetching = ref(false)
  let abortController: AbortController | null = null

  const getUrl = (): string => {
    return typeof url === 'function' ? url() : url
  }

  const execute = async (): Promise<T> => {
    const currentUrl = getUrl()
    if (!currentUrl) {
      throw new Error('URL is required')
    }

    abortController?.abort()
    abortController = new AbortController()

    try {
      isLoading.value = true
      isFetching.value = true
      error.value = null

      const response = await apiClient.get<ApiResponse<T>>(currentUrl, {
        signal: abortController.signal,
      })

      if (!response.data) {
        throw new Error('No response data')
      }

      let result: T
      // 兼容后端 code="0"/"200" (字符串) 与 code=0/200 (数字)
      const codeNum = typeof response.data.code === 'string' ? parseInt(response.data.code, 10) : response.data.code
      if (codeNum === 200 || codeNum === 0) {
        result = response.data.data
      } else {
        throw new Error(response.data.message || 'Request failed')
      }

      if (transform) {
        result = transform(result)
      }

      data.value = result
      onSuccess?.(result)
      return result
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') {
        throw e
      }
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      onError?.(err)
      throw err
    } finally {
      isLoading.value = false
      isFetching.value = false
    }
  }

  const abort = () => {
    abortController?.abort()
    isFetching.value = false
  }

  const reset = () => {
    data.value = initialData ?? null
    error.value = null
    isLoading.value = false
    isFetching.value = false
  }

  onUnmounted(() => {
    abort()
  })

  if (immediate) {
    void execute()
  }

  return {
    data,
    error,
    isLoading,
    isFetching,
    execute,
    abort,
    reset,
  }
}

export interface UsePaginatedFetchOptions<T> {
  pageSize?: number
  immediate?: boolean
  onSuccess?: (data: PaginatedResponse<T>) => void
  onError?: (error: Error) => void
}

export interface UsePaginatedFetchReturn<T> {
  data: Ref<T[]>
  total: Ref<number>
  page: Ref<number>
  pageSize: Ref<number>
  totalPages: ComputedRef<number>
  isLoading: Ref<boolean>
  error: Ref<Error | null>
  fetch: (newPage?: number) => Promise<void>
  nextPage: () => Promise<void>
  prevPage: () => Promise<void>
  goToPage: (page: number) => Promise<void>
  refresh: () => Promise<void>
}

export function usePaginatedFetch<T>(
  url: string | (() => string),
  options: UsePaginatedFetchOptions<T> = {}
): UsePaginatedFetchReturn<T> {
  const { pageSize: defaultPageSize = 20, immediate = false, onSuccess, onError } = options

  const data = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const pageSize = ref(defaultPageSize)
  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  const totalPages = computed(() => Math.ceil(total.value / pageSize.value) || 1)

  const getUrl = (): string => {
    const baseUrl = typeof url === 'function' ? url() : url
    if (!baseUrl) return ''
    const separator = baseUrl.includes('?') ? '&' : '?'
    return `${baseUrl}${separator}page=${page.value}&pageSize=${pageSize.value}`
  }

  const fetch = async (newPage?: number): Promise<void> => {
    if (newPage !== undefined) {
      page.value = newPage
    }

    const currentUrl = getUrl()
    if (!currentUrl) return

    try {
      isLoading.value = true
      error.value = null

      const response = await apiClient.get<ApiResponse<PaginatedResponse<T>>>(currentUrl)

      if (!response.data) {
        throw new Error('No response data')
      }

      // 兼容后端 code="0"/"200" (字符串) 与 code=0/200 (数字)
      const pageCodeNum = typeof response.data.code === 'string' ? parseInt(response.data.code, 10) : response.data.code
      if (pageCodeNum === 200 || pageCodeNum === 0) {
        const result = response.data.data
        data.value = result.list
        total.value = result.total
        onSuccess?.(result)
      } else {
        throw new Error(response.data.message || 'Request failed')
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      onError?.(err)
    } finally {
      isLoading.value = false
    }
  }

  const nextPage = () => {
    if (page.value < totalPages.value) {
      return fetch(page.value + 1)
    }
    return Promise.resolve()
  }

  const prevPage = () => {
    if (page.value > 1) {
      return fetch(page.value - 1)
    }
    return Promise.resolve()
  }

  const goToPage = (p: number) => {
    if (p >= 1 && p <= totalPages.value) {
      return fetch(p)
    }
    return Promise.resolve()
  }

  const refresh = () => fetch(page.value)

  onUnmounted(() => {
    // Cleanup if needed
  })

  if (immediate) {
    void fetch()
  }

  return {
    data,
    total,
    page,
    pageSize,
    totalPages,
    isLoading,
    error,
    fetch,
    nextPage,
    prevPage,
    goToPage,
    refresh,
  }
}

export interface UseMutationOptions<T, P> {
  onSuccess?: (data: T, params: P) => void
  onError?: (error: Error, params: P) => void
}

export interface UseMutationReturn<T, P> {
  data: Ref<T | null>
  error: Ref<Error | null>
  isLoading: Ref<boolean>
  mutate: (params: P) => Promise<T>
  reset: () => void
}

export function useMutation<T, P>(
  mutationFn: (params: P) => Promise<T>,
  options: UseMutationOptions<T, P> = {}
): UseMutationReturn<T, P> {
  const { onSuccess, onError } = options

  const data = ref<T | null>(null) as Ref<T | null>
  const error = ref<Error | null>(null)
  const isLoading = ref(false)

  const mutate = async (params: P): Promise<T> => {
    try {
      isLoading.value = true
      error.value = null

      const result = await mutationFn(params)
      data.value = result
      onSuccess?.(result, params)
      return result
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e))
      error.value = err
      onError?.(err, params)
      throw err
    } finally {
      isLoading.value = false
    }
  }

  const reset = () => {
    data.value = null
    error.value = null
    isLoading.value = false
  }

  return {
    data,
    error,
    isLoading,
    mutate,
    reset,
  }
}
