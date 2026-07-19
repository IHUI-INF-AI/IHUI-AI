// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  fetchApi: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { fetchApi } from '@/lib/api'
import { toast } from 'sonner'
import { useBatchMutation } from './use-batch-mutation'

const mockedFetchApi = vi.mocked(fetchApi)
const mockedToastSuccess = vi.mocked(toast.success)
const mockedToastError = vi.mocked(toast.error)

function makeWrapper(): ({ children }: { children: ReactNode }) => ReactNode {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
}

beforeEach(() => {
  mockedFetchApi.mockReset()
  mockedToastSuccess.mockClear()
  mockedToastError.mockClear()
})

describe('useBatchMutation', () => {
  it('body 模式:成功时调用 fetchApi 并 invalidate + toast', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: null, status: 200 } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          method: 'DELETE',
          queryKey: ['test'],
          ids: ['1', '2', '3'],
          successMessage: '删除成功',
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/test', {
      method: 'DELETE',
      body: JSON.stringify({ ids: ['1', '2', '3'] }),
    })
    expect(mockedToastSuccess).toHaveBeenCalledWith('删除成功')
  })

  it('url 模式:IDs 拼到 path 末尾', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: null, status: 200 } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          method: 'DELETE',
          queryKey: ['test'],
          ids: ['a', 'b'],
          mode: 'url',
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(mockedFetchApi).toHaveBeenCalledWith('/api/test/a,b', {
      method: 'DELETE',
      body: undefined,
    })
  })

  it('空数组:不发请求,直接 return', async () => {
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: [],
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    expect(mockedFetchApi).not.toHaveBeenCalled()
    expect(result.current.isPending).toBe(false)
  })

  it('请求中 isPending 为 true', async () => {
    let resolveFn: (v: unknown) => void = () => {}
    mockedFetchApi.mockImplementation(
      () => new Promise((resolve) => { resolveFn = resolve }) as never,
    )
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
        }),
      { wrapper: makeWrapper() },
    )

    act(() => {
      result.current.mutate()
    })
    await waitFor(() => {
      expect(result.current.isPending).toBe(true)
    })

    await act(async () => {
      resolveFn({ success: true, data: null, status: 200 })
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })
  })

  it('业务返回 success=false:抛错并弹错误 toast', async () => {
    mockedFetchApi.mockResolvedValue({
      success: false,
      error: '删除失败:权限不足',
      status: 403,
    } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.error).toBeInstanceOf(Error)
    expect(result.current.error?.message).toBe('删除失败:权限不足')
    expect(mockedToastError).toHaveBeenCalledWith('删除失败:权限不足')
  })

  it('网络错误:fetchApi 抛异常时正确捕获', async () => {
    const networkErr = new Error('Network request failed')
    mockedFetchApi.mockRejectedValue(networkErr)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(result.current.error).toBe(networkErr)
    expect(mockedToastError).toHaveBeenCalledWith('Network request failed')
  })

  it('自定义 errorMessage 覆盖后端 error', async () => {
    mockedFetchApi.mockResolvedValue({
      success: false,
      error: '后端错误',
      status: 500,
    } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
          errorMessage: '操作失败,请重试',
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })

    expect(mockedToastError).toHaveBeenCalledWith('操作失败,请重试')
  })

  it('onSuccess 接收 count 参数(实际处理的 ID 数)', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: null, status: 200 } as never)
    const onSuccess = vi.fn()
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1', '2', '3', '4'],
          onSuccess,
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(onSuccess).toHaveBeenCalledWith(4)
  })

  it('onError 接收 Error 对象', async () => {
    const onError = vi.fn()
    mockedFetchApi.mockResolvedValue({
      success: false,
      error: 'fail',
      status: 400,
    } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
          onError,
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.error).toBeInstanceOf(Error)
    })

    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('不传 successMessage:成功时不弹 toast', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: null, status: 200 } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['1'],
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate()
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(mockedToastSuccess).not.toHaveBeenCalled()
  })

  it('mutate(overrideIds) 覆盖 options.ids,适用单行删除场景', async () => {
    mockedFetchApi.mockResolvedValue({ success: true, data: null, status: 200 } as never)
    const { result } = renderHook(
      () =>
        useBatchMutation({
          endpoint: '/api/test',
          queryKey: ['test'],
          ids: ['batch1', 'batch2'],
        }),
      { wrapper: makeWrapper() },
    )

    await act(async () => {
      result.current.mutate(['single-row'])
    })

    await waitFor(() => {
      expect(result.current.isPending).toBe(false)
    })

    expect(mockedFetchApi).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ body: JSON.stringify({ ids: ['single-row'] }) }),
    )
  })
})
