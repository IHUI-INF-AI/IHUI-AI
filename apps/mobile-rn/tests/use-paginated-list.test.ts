/**
 * usePaginatedList 分页 hook 边界测试
 *
 * 覆盖:
 * - 首页加载
 * - 下拉刷新
 * - 上拉加载更多
 * - 空列表
 * - 错误重试
 * - removeItem
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'

import { usePaginatedList } from '../src/hooks/use-paginated-list'

interface Item {
  id: string
  name: string
}

type Res =
  | { success: true; data: { list: Item[]; total: number } }
  | { success: false; error?: string }

function makeFetcher(pages: Record<number, { list: Item[]; total: number }>) {
  return vi.fn(async ({ page }: { page: number; pageSize: number }): Promise<Res> => {
    const data = pages[page]
    if (!data) return { success: false, error: 'no more' }
    return { success: true, data: { list: data.list, total: data.total } }
  })
}

describe('usePaginatedList 分页 hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('首页加载:加载第一页数据', async () => {
    const fetcher = makeFetcher({
      1: { list: [{ id: '1', name: 'A' }], total: 1 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })
    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].name).toBe('A')
    expect(fetcher).toHaveBeenCalledWith({ page: 1, pageSize: 20 })
  })

  it('下拉刷新:重新加载第一页', async () => {
    const fetcher = makeFetcher({
      1: { list: [{ id: '1', name: 'A' }], total: 1 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.refresh()
    })

    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher).toHaveBeenLastCalledWith({ page: 1, pageSize: 20 })
    expect(result.current.items).toHaveLength(1)
  })

  it('上拉加载更多:加载第二页并合并', async () => {
    const fetcher = makeFetcher({
      1: { list: [{ id: '1', name: 'A' }], total: 2 },
      2: { list: [{ id: '2', name: 'B' }], total: 2 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].name).toBe('A')
    expect(result.current.items[1].name).toBe('B')
    expect(fetcher).toHaveBeenLastCalledWith({ page: 2, pageSize: 20 })
  })

  it('空列表:total 为 0 时不加载更多', async () => {
    const fetcher = makeFetcher({
      1: { list: [], total: 0 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(0)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('错误重试:加载失败后 refresh 重试', async () => {
    const fetcher = vi.fn()
    fetcher
      .mockResolvedValueOnce({ success: false, error: 'network error' })
      .mockResolvedValueOnce({ success: true, data: { list: [{ id: '1', name: 'A' }], total: 1 } })

    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.error).toBeTruthy()

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.error).toBe('')
    expect(result.current.items).toHaveLength(1)
  })

  it('loadMore 达到 total 后不再加载', async () => {
    const fetcher = makeFetcher({
      1: { list: [{ id: '1', name: 'A' }], total: 1 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.loadMore()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.items).toHaveLength(1)
  })

  it('removeItem:从列表中移除指定项', async () => {
    const fetcher = makeFetcher({
      1: {
        list: [
          { id: '1', name: 'A' },
          { id: '2', name: 'B' },
        ],
        total: 2,
      },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(2)

    act(() => {
      result.current.removeItem((item) => item.id === '1')
    })

    expect(result.current.items).toHaveLength(1)
    expect(result.current.items[0].name).toBe('B')
  })

  it('refresh 后 total 更新为最新值', async () => {
    const fetcher = vi.fn()
    fetcher
      .mockResolvedValueOnce({ success: true, data: { list: [{ id: '1', name: 'A' }], total: 1 } })
      .mockResolvedValueOnce({
        success: true,
        data: {
          list: [
            { id: '2', name: 'B' },
            { id: '3', name: 'C' },
          ],
          total: 2,
        },
      })

    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(1)

    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.items).toHaveLength(2)
    expect(result.current.items[0].name).toBe('B')
  })
})
