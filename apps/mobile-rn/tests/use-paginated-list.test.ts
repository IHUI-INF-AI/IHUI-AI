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

// 2026-10-25 修正测量对象:本套件原先 import 的 `../src/hooks/use-paginated-list` 是
// `@ihui/shared/hooks`(父别名 → tests/__mocks__ 的手写平行件)的 re-export ⇒ 9 例一直在验
// **替身**而不是 shipped 实现(§22c「测试 import 源,禁止复制判据」的反面现场)。
// 改走 vitest 配置里 exact 子路径别名(排在父别名之前)⇒ 直连 packages/shared 真实源文件。
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

  // 2026-10-25 序号守卫(切档竞态判高):旧请求迟到的响应一律作废 ——
  // 不得 append 进新列表、不得改 page 游标(旧形态:refresh 后到达的第 2 页旧数据
  // 被 [...prev, C] 拼进新筛选结果,并把"下次加载更多"的页号偷换成 2 ⇒ 直接跳页缺页)。
  it('序号守卫:refresh 之后,在途第 2 页迟到 ⇒ 不 append、不改游标、状态由最后一发清', async () => {
    let resolvePage2: (v: Res) => void = () => {}
    const page2 = new Promise<Res>((r) => {
      resolvePage2 = r
    })
    let firstPageList = [{ id: 'A', name: 'A' }]
    const fetcher = vi.fn(({ page }: { page: number; pageSize: number }): Promise<Res> =>
      page === 2
        ? page2
        : Promise.resolve({ success: true, data: { list: firstPageList, total: 3 } }),
    )

    const { result } = renderHook(() => usePaginatedList<Item>(fetcher, 2))
    await waitFor(() => expect(result.current.loading).toBe(false))

    // 1) 上拉第 2 页:故意悬挂在途
    act(() => {
      result.current.loadMore()
    })
    await waitFor(() => expect(result.current.loadingMore).toBe(true))

    // 2) 切筛选 ⇒ 新数据重发第 1 页(比第 2 页后发先至)
    firstPageList = [{ id: 'B', name: 'B' }]
    act(() => {
      result.current.refresh()
    })
    await waitFor(() => expect(result.current.items.map((i) => i.name)).toEqual(['B']))

    // 3) 迟到的第 2 页(旧上下文)放行 ⇒ 必须整发作废
    resolvePage2({ success: true, data: { list: [{ id: 'C', name: 'C' }], total: 3 } })
    await act(async () => {
      await page2
      await Promise.resolve()
    })
    expect(result.current.items.map((i) => i.name)).toEqual(['B'])
    expect(result.current.page).toBe(1)
    // 最后一发已完成 ⇒ 加载位不留挂死
    expect(result.current.loading).toBe(false)
    expect(result.current.loadingMore).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
