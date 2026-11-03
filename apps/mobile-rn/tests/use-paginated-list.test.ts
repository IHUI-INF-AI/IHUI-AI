// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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

/**
 * 必须按**子路径**导入真源码,不能走 `../src/hooks/use-paginated-list` 那层 re-export:
 * 该 re-export 写的是 `export { usePaginatedList } from '@ihui/shared/hooks'`(父路径),
 * 而 vitest.config 的父别名指向 `tests/__mocks__/ihui-shared-hooks.ts` 替身 —— 逐文件别名
 * 只覆盖 `@ihui/shared/hooks/<模块>` 子路径。走父路径时本文件测的其实是替身
 * (2026-10-29 实测:shared 实现加了 hasMore,本文件读出来恒 undefined 才暴露这一点)。
 */
import { usePaginatedList } from '@ihui/shared/hooks/use-paginated-list'

interface Item {
  id: string
  name: string
}

type Res =
  { success: true; data: { list: Item[]; total: number } } | { success: false; error?: string }

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
    expect(result.current.items[0]!.name).toBe('A')
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
    expect(result.current.items[0]!.name).toBe('A')
    expect(result.current.items[1]!.name).toBe('B')
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
    expect(result.current.items[0]!.name).toBe('B')
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
    expect(result.current.items[0]!.name).toBe('B')
  })

  // 后端不给 total 的那一支(2026-10-29 立):/api/articles 一类路由做了分页查询却只发回数组,
  // 前端拿不到总数。旧判据 `items.length >= total` 在 total 恒 0 时当场为真 ⇒ loadMore 永不触发,
  // 页面上"只看得到第一页"就是这么来的。这一支只能按"本页是否取满"自守。
  it('无 total(后端只发数组):本页取满 ⇒ hasMore 且 loadMore 追加下一页', async () => {
    type ArrayRes = { success: true; data: Item[] } | { success: false; error?: string }
    const fetcher = vi.fn(
      async ({ page }: { page: number; pageSize: number }): Promise<ArrayRes> => {
        const byPage: Record<number, Item[]> = {
          1: [
            { id: '1', name: 'A' },
            { id: '2', name: 'B' },
          ],
          2: [{ id: '3', name: 'C' }],
        }
        const list = byPage[page]
        return list ? { success: true, data: list } : { success: false, error: 'no more' }
      },
    )
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher, 2))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.items).toHaveLength(2)
    expect(result.current.hasMore).toBe(true)

    await act(async () => {
      await result.current.loadMore()
    })
    await waitFor(() => expect(result.current.loadingMore).toBe(false))

    expect(fetcher).toHaveBeenLastCalledWith({ page: 2, pageSize: 2 })
    expect(result.current.items).toHaveLength(3)
    expect(result.current.items.map((i) => i.id)).toEqual(['1', '2', '3'])
  })

  it('无 total:本页未满 pageSize ⇒ 判定到底,loadMore 不再发请求', async () => {
    type ArrayRes = { success: true; data: Item[] } | { success: false; error?: string }
    const fetcher = vi.fn(async (): Promise<ArrayRes> => ({
      success: true,
      data: [{ id: '1', name: 'A' }],
    }))
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher, 2))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.hasMore).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.loadMore()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.items).toHaveLength(1)
  })

  it('有 total 时仍按累计条数判到底(不给数组那一支留行为不变)', async () => {
    const fetcher = makeFetcher({
      1: { list: [{ id: '1', name: 'A' }], total: 1 },
    })
    const { result } = renderHook(() => usePaginatedList<Item>(fetcher))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.total).toBe(1)
    expect(result.current.hasMore).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
