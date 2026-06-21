import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { nextTick, onUnmounted } from 'vue'
import { useFetch, usePaginatedFetch, useMutation } from '../useFetch'
import { withSetup } from './withSetup'

vi.mock('@/api/core/client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock('vue', async () => {
  const actual = await vi.importActual('vue')
  return {
    ...actual,
    onUnmounted: vi.fn(),
  }
})

describe('useFetch.ts', () => {
  let mockApiClient: { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

  beforeEach(async () => {
    vi.clearAllMocks()
    mockApiClient = await import('@/api/core/client').then((m) => m.apiClient)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('useFetch', () => {
    it('应该正确初始化', () => {
      const { data, error, isLoading } = useFetch('/api/test')

      expect(data.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    it('应该支持初始数据', () => {
      const { data } = useFetch('/api/test', { initialData: { name: 'test' } })

      expect(data.value).toEqual({ name: 'test' })
    })

    it('execute应该发起请求', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { name: 'result' } },
      })

      const { data, isLoading, execute } = useFetch('/api/test')

      const result = await execute()

      expect(result).toEqual({ name: 'result' })
      expect(data.value).toEqual({ name: 'result' })
      expect(isLoading.value).toBe(false)
    })

    it('应该处理请求错误', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 500, message: 'Server error' },
      })

      const { error, execute } = useFetch('/api/test')

      await expect(execute()).rejects.toThrow('Server error')
      expect(error.value?.message).toBe('Server error')
    })

    it('应该调用onSuccess回调', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { name: 'result' } },
      })

      const onSuccess = vi.fn()
      const { execute } = useFetch('/api/test', { onSuccess })

      await execute()

      expect(onSuccess).toHaveBeenCalledWith({ name: 'result' })
    })

    it('应该调用onError回调', async () => {
      mockApiClient.get.mockRejectedValue(new Error('Network error'))

      const onError = vi.fn()
      const { execute } = useFetch('/api/test', { onError })

      await expect(execute()).rejects.toThrow()
      expect(onError).toHaveBeenCalled()
    })

    it('reset应该重置状态', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { name: 'result' } },
      })

      const { data, error, isLoading, execute, reset } = useFetch('/api/test')

      await execute()
      reset()

      expect(data.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    // 测试 URL 为函数的情况
    it('应该支持函数式URL', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { name: 'func' } },
      })

      const { data, execute } = useFetch(() => '/api/func')
      await execute()

      expect(data.value).toEqual({ name: 'func' })
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/func', expect.any(Object))
    })

    // 测试 URL 为空字符串抛错
    it('URL为空时应抛错', async () => {
      const { execute } = useFetch('')

      await expect(execute()).rejects.toThrow('URL is required')
    })

    // 测试函数式URL返回空字符串抛错
    it('函数式URL返回空时应抛错', async () => {
      const { execute } = useFetch(() => '')

      await expect(execute()).rejects.toThrow('URL is required')
    })

    // 测试响应 code 为 0 的情况
    it('应该处理code为0的成功响应', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 0, data: { value: 1 } },
      })

      const { data, execute } = useFetch('/api/test')
      await execute()

      expect(data.value).toEqual({ value: 1 })
    })

    // 测试 transform 选项
    it('应该调用transform处理数据', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { name: 'raw' } },
      })

      const transform = vi.fn((d: { name: string }) => ({ name: d.name.toUpperCase() }))
      const { data, execute } = useFetch('/api/test', { transform })

      await execute()

      expect(transform).toHaveBeenCalledWith({ name: 'raw' })
      expect(data.value).toEqual({ name: 'RAW' })
    })

    // 测试响应没有 data 字段
    it('响应无data时应抛错', async () => {
      mockApiClient.get.mockResolvedValue({ data: null })

      const { execute } = useFetch('/api/test')

      await expect(execute()).rejects.toThrow('No response data')
    })

    // 测试业务错误无 message 时使用默认消息
    it('业务错误无message时应使用默认消息', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 500 },
      })

      const { execute } = useFetch('/api/test')

      await expect(execute()).rejects.toThrow('Request failed')
    })

    // 测试 abort 函数
    it('abort应该中断请求并重置isFetching', async () => {
      const { abort, isFetching } = useFetch('/api/test')
      isFetching.value = true

      abort()

      expect(isFetching.value).toBe(false)
    })

    // 测试 immediate 自动执行
    it('immediate为true时应自动执行', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 200, data: { auto: true } },
      })

      const { data } = useFetch('/api/test', { immediate: true })

      // 等待微任务完成
      await new Promise((resolve) => setTimeout(resolve, 0))
      await nextTick()

      expect(data.value).toEqual({ auto: true })
    })

    // 测试 onUnmounted 被调用
    it('组件卸载时应调用abort', () => {
      const onUnmountedMock = onUnmounted as ReturnType<typeof vi.fn>
      onUnmountedMock.mockClear()

      const { unmount } = withSetup(() => useFetch('/api/test'))
      unmount()

      expect(onUnmountedMock).toHaveBeenCalled()
    })

    // 测试非Error类型异常
    it('非Error类型异常应转换为Error', async () => {
      mockApiClient.get.mockRejectedValue('字符串错误')

      const { error, execute } = useFetch('/api/test')

      await expect(execute()).rejects.toThrow('字符串错误')
      expect(error.value).toBeInstanceOf(Error)
    })

    // 测试 AbortError 异常向上抛出
    it('AbortError异常应原样抛出', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      mockApiClient.get.mockRejectedValue(abortError)

      const { error, execute } = useFetch('/api/test')

      await expect(execute()).rejects.toThrow('Aborted')
      // AbortError 不应被设置到 error 中
      expect(error.value).toBeNull()
    })
  })

  describe('usePaginatedFetch', () => {
    it('应该正确初始化', () => {
      const { data, total, page, pageSize, totalPages } = usePaginatedFetch('/api/list')

      expect(data.value).toEqual([])
      expect(total.value).toBe(0)
      expect(page.value).toBe(1)
      expect(pageSize.value).toBe(20)
      expect(totalPages.value).toBe(1)
    })

    it('fetch应该获取分页数据', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: {
            list: [{ id: 1 }, { id: 2 }],
            total: 100,
            page: 1,
            pageSize: 20,
            totalPages: 5,
          },
        },
      })

      const { data, total, fetch } = usePaginatedFetch('/api/list')

      await fetch()

      expect(data.value).toEqual([{ id: 1 }, { id: 2 }])
      expect(total.value).toBe(100)
    })

    it('nextPage应该加载下一页', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [], total: 100, page: 2, pageSize: 20, totalPages: 5 },
        },
      })

      const { page, nextPage, total } = usePaginatedFetch('/api/list')
      total.value = 100

      await nextPage()

      expect(page.value).toBe(2)
    })

    it('prevPage应该加载上一页', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [], total: 100, page: 1, pageSize: 20, totalPages: 5 },
        },
      })

      const { page, prevPage, total } = usePaginatedFetch('/api/list')
      page.value = 2
      total.value = 100

      await prevPage()

      expect(page.value).toBe(1)
    })

    // 自定义 pageSize
    it('应该支持自定义pageSize', () => {
      const { pageSize, totalPages } = usePaginatedFetch('/api/list', { pageSize: 10 })

      expect(pageSize.value).toBe(10)
      expect(totalPages.value).toBe(1)
    })

    // 测试 goToPage 有效页码
    it('goToPage应该跳转到指定页', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [{ id: 3 }], total: 100, page: 3, pageSize: 20, totalPages: 5 },
        },
      })

      const { page, goToPage, total } = usePaginatedFetch('/api/list')
      total.value = 100

      await goToPage(3)

      expect(page.value).toBe(3)
    })

    // 测试 goToPage 超出范围不应请求
    it('goToPage超出范围不应请求', async () => {
      const { goToPage } = usePaginatedFetch('/api/list')

      await goToPage(0)
      await goToPage(999)

      expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    // 测试 refresh 刷新当前页
    it('refresh应该刷新当前页', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [{ id: 1 }], total: 100, page: 2, pageSize: 20, totalPages: 5 },
        },
      })

      const { page, refresh, total } = usePaginatedFetch('/api/list')
      page.value = 2
      total.value = 100

      await refresh()

      expect(page.value).toBe(2)
    })

    // 测试 nextPage 已是最后一页
    it('nextPage已是最后一页时不应请求', async () => {
      const { nextPage, total, page } = usePaginatedFetch('/api/list')
      page.value = 5
      total.value = 100

      await nextPage()

      expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    // 测试 prevPage 已是第一页
    it('prevPage已是第一页时不应请求', async () => {
      const { prevPage } = usePaginatedFetch('/api/list')

      await prevPage()

      expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    // 测试函数式 URL
    it('应该支持函数式URL', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
        },
      })

      const { fetch } = usePaginatedFetch(() => '/api/func-list')
      await fetch()

      expect(mockApiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/func-list')
      )
    })

    // 测试 URL 包含查询参数
    it('URL含查询参数时应使用&连接', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [], total: 0, page: 1, pageSize: 20, totalPages: 1 },
        },
      })

      const { fetch } = usePaginatedFetch('/api/list?status=active')
      await fetch()

      const calledUrl = mockApiClient.get.mock.calls[0][0]
      expect(calledUrl).toContain('&page=')
    })

    // 测试函数式 URL 为空
    it('函数式URL返回空时应跳过请求', async () => {
      const { fetch } = usePaginatedFetch(() => '')

      await fetch()

      expect(mockApiClient.get).not.toHaveBeenCalled()
    })

    // 测试 immediate 自动加载
    it('immediate为true时应自动加载', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [{ id: 1 }], total: 10, page: 1, pageSize: 20, totalPages: 1 },
        },
      })

      const { data } = usePaginatedFetch('/api/list', { immediate: true })

      await new Promise((resolve) => setTimeout(resolve, 0))
      await nextTick()

      expect(data.value).toEqual([{ id: 1 }])
    })

    // 测试 onSuccess 回调
    it('应该调用onSuccess回调', async () => {
      mockApiClient.get.mockResolvedValue({
        data: {
          code: 200,
          data: { list: [{ id: 1 }], total: 10, page: 1, pageSize: 20, totalPages: 1 },
        },
      })

      const onSuccess = vi.fn()
      const { fetch } = usePaginatedFetch('/api/list', { onSuccess })

      await fetch()

      expect(onSuccess).toHaveBeenCalled()
    })

    // 测试 onError 回调
    it('应该调用onError回调', async () => {
      mockApiClient.get.mockRejectedValue(new Error('网络异常'))

      const onError = vi.fn()
      const { fetch, error } = usePaginatedFetch('/api/list', { onError })

      await fetch()

      expect(onError).toHaveBeenCalled()
      expect(error.value?.message).toBe('网络异常')
    })

    // 测试业务错误无 message
    it('业务错误无message时应使用默认消息', async () => {
      mockApiClient.get.mockResolvedValue({
        data: { code: 500 },
      })

      const { error, fetch } = usePaginatedFetch('/api/list')

      await fetch()

      expect(error.value?.message).toBe('Request failed')
    })

    // 测试响应无 data 字段
    it('响应无data时应设置错误', async () => {
      mockApiClient.get.mockResolvedValue({ data: null })

      const { error, fetch } = usePaginatedFetch('/api/list')

      await fetch()

      expect(error.value?.message).toBe('No response data')
    })
  })

  describe('useMutation', () => {
    it('应该正确执行mutation', async () => {
      const mutationFn = vi.fn().mockResolvedValue({ id: 1 })
      const { data, isLoading, mutate } = useMutation(mutationFn)

      const result = await mutate({ name: 'test' })

      expect(result).toEqual({ id: 1 })
      expect(data.value).toEqual({ id: 1 })
      expect(isLoading.value).toBe(false)
    })

    it('应该处理mutation错误', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('Mutation failed'))
      const { error, mutate } = useMutation(mutationFn)

      await expect(mutate({})).rejects.toThrow('Mutation failed')
      expect(error.value?.message).toBe('Mutation failed')
    })

    it('应该调用onSuccess回调', async () => {
      const mutationFn = vi.fn().mockResolvedValue({ id: 1 })
      const onSuccess = vi.fn()
      const { mutate } = useMutation(mutationFn, { onSuccess })

      await mutate({ name: 'test' })

      expect(onSuccess).toHaveBeenCalledWith({ id: 1 }, { name: 'test' })
    })

    it('reset应该重置状态', async () => {
      const mutationFn = vi.fn().mockResolvedValue({ id: 1 })
      const { data, error, isLoading, mutate, reset } = useMutation(mutationFn)

      await mutate({})
      reset()

      expect(data.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })

    // 测试 onError 回调
    it('应该调用onError回调并传入参数', async () => {
      const mutationFn = vi.fn().mockRejectedValue(new Error('失败'))
      const onError = vi.fn()
      const { mutate } = useMutation(mutationFn, { onError })

      await expect(mutate({ id: 5 })).rejects.toThrow('失败')

      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][1]).toEqual({ id: 5 })
    })

    // 测试非 Error 类型异常
    it('非Error类型异常应转换为Error', async () => {
      const mutationFn = vi.fn().mockRejectedValue('字符串错误')
      const { error, mutate } = useMutation(mutationFn)

      await expect(mutate({})).rejects.toThrow('字符串错误')
      expect(error.value).toBeInstanceOf(Error)
    })

    // 测试初始状态
    it('应该正确初始化为空状态', () => {
      const { data, error, isLoading } = useMutation(vi.fn())

      expect(data.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })
  })
})
