/**
 * useArticles 跨端共享 hook 集成测试
 *
 * 验证 @ihui/shared/hooks/useArticles 在 mobile-rn 端消费的真实可用性,
 * 覆盖列表加载、分页、筛选、loadMore、错误处理、resetFilters 等场景。
 *
 * 覆盖场景(16 个):
 * 1.  挂载后 autoLoad=true 自动拉取,articles 填充,loading 从 true→false
 * 2.  autoLoad=false 时不自动拉取
 * 3.  load() 成功:articles 填充,total 正确,page=1
 * 4.  load() 失败:error 填充
 * 5.  loadMore() 成功:articles 追加,page+1,hasNext 正确
 * 6.  loadMore() 到末页:hasNext=false,不调 fetcher
 * 7.  loadMore() 在 loadingMore 期间不重复触发
 * 8.  refresh() 等价于 load()
 * 9.  setCategoryId() 触发重新加载(重置到第 1 页)
 * 10. setStatus() 触发重新加载
 * 11. setSearch() 更新 search 值,下次 load() 时生效(不自动触发)
 * 12. resetFilters() 重置 categoryId/status/search
 * 13. setPage() clamp 到 [1, totalPages]
 * 14. setArticles() 手动设置文章列表(供各端 createArticle 后本地更新)
 * 15. fetcher 返回空 list:articles 为空数组
 * 16. 初始 categoryId/status 自定义(非 'all')
 *
 * 测试策略:
 * - 用 vi.fn() mock fetcher,不依赖真实网络
 * - 用 renderHook + act + waitFor 模拟 React 组件生命周期
 * - mock article 类型用 interface TestArticle extends Article { author?: string }
 * - 用 controlled Promise + holder 对象捕获 loading 中间态,避免 non-null assertion
 */
import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useArticles } from '@ihui/shared/hooks'
import type { Article } from '@ihui/shared/hooks'

// 测试用 mock article 类型(扩展 author 字段,模拟各端自定义字段)
interface TestArticle extends Article {
  author?: string
}

// fetcher 返回值类型
type FetchResult = { list: TestArticle[]; total: number }

// 构造单篇测试文章
const makeArticle = (i: number): TestArticle => ({
  id: `a-${i}`,
  title: `Article ${i}`,
  author: `Author ${i % 3}`,
  categoryId: 'cat-1',
  status: 'published',
})

// 构造指定数量的文章列表
const makeList = (start: number, count: number): TestArticle[] =>
  Array.from({ length: count }, (_, i) => makeArticle(start + i))

describe('useArticles 跨端共享 hook — 集成测试', () => {
  it('1. 挂载后 autoLoad=true 自动拉取,articles 填充,loading 从 true→false', async () => {
    const holder: { resolve?: (v: FetchResult) => void } = {}
    const fetcher = vi
      .fn()
      .mockImplementationOnce(() => new Promise<FetchResult>(r => { holder.resolve = r }))

    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    // 挂载触发 effect → load(),loading 变 true,fetcher 被调一次,articles 仍空
    await waitFor(() => {
      expect(result.current.loading).toBe(true)
      expect(fetcher).toHaveBeenCalledTimes(1)
    })
    expect(result.current.articles).toEqual([])

    // 释放 fetcher → loading 变 false,articles 填充,total/page 正确
    await act(async () => {
      holder.resolve?.({ list: makeList(0, 3), total: 3 })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.articles).toHaveLength(3)
    expect(result.current.articles[0]!.id).toBe('a-0')
    expect(result.current.total).toBe(3)
    expect(result.current.page).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('2. autoLoad=false 时不自动拉取', () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, autoLoad: false }),
    )

    // effect 已运行但 autoLoad=false 提前返回,fetcher 未被调
    expect(fetcher).not.toHaveBeenCalled()
    expect(result.current.articles).toEqual([])
    expect(result.current.loading).toBe(false)
    expect(result.current.page).toBe(1)
    expect(result.current.total).toBe(0)
  })

  it('3. load() 成功:articles 填充,total 正确,page=1', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: makeList(0, 5), total: 5 })
    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, autoLoad: false }),
    )

    expect(result.current.articles).toEqual([])
    expect(result.current.loading).toBe(false)

    await act(async () => {
      await result.current.load()
    })

    expect(result.current.articles).toHaveLength(5)
    expect(result.current.articles[0]!.id).toBe('a-0')
    expect(result.current.total).toBe(5)
    expect(result.current.page).toBe(1)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
    // fetcher 收到 page=1
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('4. load() 失败:error 填充,loading 恢复 false,articles 保持空', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('network down'))
    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.error).toBe('network down')
    expect(result.current.articles).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.loading).toBe(false)
  })

  it('5. loadMore() 成功:articles 追加,page+1,hasNext 正确', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 10), total: 25 }) // page 1
      .mockResolvedValueOnce({ list: makeList(10, 10), total: 25 }) // page 2

    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.page).toBe(1)
    expect(result.current.articles).toHaveLength(10)
    expect(result.current.totalPages).toBe(3) // ceil(25/10)
    expect(result.current.hasNext).toBe(true) // 1 < 3

    await act(async () => {
      await result.current.loadMore()
    })

    expect(result.current.page).toBe(2)
    expect(result.current.articles).toHaveLength(20)
    expect(result.current.articles[10]!.id).toBe('a-10')
    expect(result.current.hasNext).toBe(true) // 2 < 3
    expect(result.current.total).toBe(25)
    expect(result.current.loadingMore).toBe(false)
  })

  it('6. loadMore() 到末页:hasNext=false,不调 fetcher', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 10), total: 10 }) // 仅 1 页

    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.page).toBe(1)
    expect(result.current.hasNext).toBe(false) // 1 < 1 为 false

    const callsBefore = fetcher.mock.calls.length

    // loadMore 应被 guard 拦截(hasNext=false)
    await act(async () => {
      await result.current.loadMore()
    })

    expect(fetcher.mock.calls.length).toBe(callsBefore) // 无额外调用
    expect(result.current.page).toBe(1)
    expect(result.current.articles).toHaveLength(10)
    expect(result.current.loadingMore).toBe(false)
  })

  it('7. loadMore() 在 loadingMore 期间不重复触发', async () => {
    const holder: { resolve?: (v: FetchResult) => void } = {}
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 10), total: 25 }) // 初始 load
      .mockImplementationOnce(
        () => new Promise<FetchResult>(r => { holder.resolve = r }),
      ) // loadMore fetch:挂起

    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(result.current.hasNext).toBe(true)

    // 触发 loadMore(fetcher 挂起,loadingMore 卡在 true)
    await act(async () => {
      result.current.loadMore()
    })
    await waitFor(() => expect(result.current.loadingMore).toBe(true))
    expect(fetcher).toHaveBeenCalledTimes(2)

    // loadingMore 期间再次调用 loadMore —— guard 应拦截
    await act(async () => {
      await result.current.loadMore()
    })
    expect(fetcher).toHaveBeenCalledTimes(2) // 没有额外调用

    // 释放挂起的 fetcher,让第一次 loadMore 完成
    await act(async () => {
      holder.resolve?.({ list: makeList(10, 10), total: 25 })
    })
    await waitFor(() => expect(result.current.loadingMore).toBe(false))

    expect(result.current.page).toBe(2)
    expect(result.current.articles).toHaveLength(20)
  })

  it('8. refresh() 等价于 load():重新拉取并替换 articles', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 10), total: 10 })
      .mockResolvedValueOnce({ list: makeList(10, 5), total: 15 })

    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.articles).toHaveLength(10)
    expect(result.current.total).toBe(10)

    // refresh → 重新 load(page 1,替换 articles)
    await act(async () => {
      await result.current.refresh()
    })

    expect(result.current.articles).toHaveLength(5)
    expect(result.current.articles[0]!.id).toBe('a-10')
    expect(result.current.total).toBe(15)
    expect(result.current.page).toBe(1)
    expect(result.current.loading).toBe(false)
    // refresh 应调 fetcher(page=1)
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }))
  })

  it('9. setCategoryId() 触发重新加载(重置到第 1 页)', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 10), total: 25 }) // 挂载 load(categoryId='all')
      .mockResolvedValueOnce({ list: makeList(0, 3), total: 3 }) // setCategoryId 后 reload

    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.categoryId).toBe('all')
    expect(result.current.page).toBe(1)
    expect(fetcher).toHaveBeenNthCalledWith(1, expect.objectContaining({ categoryId: undefined }))

    // 切 categoryId → 触发 effect 重新 load(page 重置到 1,articles 替换为新筛选结果)
    await act(async () => {
      result.current.setCategoryId('cat-1')
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.categoryId).toBe('cat-1')
    expect(result.current.page).toBe(1) // load() 总是重置到第 1 页
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', page: 1 }),
    )
    expect(result.current.articles).toHaveLength(3)
    expect(result.current.total).toBe(3)
  })

  it('10. setStatus() 触发重新加载', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ list: makeList(0, 2), total: 2 }) // 挂载 load(status='all' → undefined)
      .mockResolvedValueOnce({ list: makeList(0, 1), total: 1 }) // setStatus 后 reload

    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.status).toBe('all')
    expect(fetcher).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }))

    // 切 status → 触发 reload
    await act(async () => {
      result.current.setStatus('published')
    })
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.status).toBe('published')
    expect(fetcher).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'published', page: 1 }),
    )
    expect(result.current.articles).toHaveLength(1)
    expect(result.current.total).toBe(1)
  })

  it('11. setSearch() 更新 search 值,下次 load() 时生效(不自动触发)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, autoLoad: false }),
    )

    // 初始 search 为空,fetcher 未被调
    expect(result.current.search).toBe('')
    expect(fetcher).not.toHaveBeenCalled()

    // 更新 search(autoLoad=false,effect 提前返回,不触发 load)
    act(() => {
      result.current.setSearch('react')
    })
    expect(result.current.search).toBe('react')
    expect(fetcher).not.toHaveBeenCalled()

    // 显式 load,fetcher 收到新 search
    await act(async () => {
      await result.current.load()
    })

    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher).toHaveBeenCalledWith(expect.objectContaining({ search: 'react' }))
  })

  it('12. resetFilters() 重置 categoryId/status/search', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    // 设置自定义筛选值
    act(() => {
      result.current.setCategoryId('cat-1')
      result.current.setStatus('published')
      result.current.setSearch('react')
    })
    expect(result.current.categoryId).toBe('cat-1')
    expect(result.current.status).toBe('published')
    expect(result.current.search).toBe('react')

    // reset
    await act(async () => {
      result.current.resetFilters()
    })

    expect(result.current.categoryId).toBe('all')
    expect(result.current.status).toBe('all')
    expect(result.current.search).toBe('')
  })

  it('13. setPage() clamp 到 [1, totalPages]', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: makeList(0, 10), total: 25 })
    const { result } = renderHook(() =>
      useArticles<TestArticle>({ fetcher, pageSize: 10 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.totalPages).toBe(3) // ceil(25/10)

    // 超上限 → clamp 到 totalPages
    act(() => {
      result.current.setPage(99)
    })
    expect(result.current.page).toBe(3)

    // 超下限 → clamp 到 1
    act(() => {
      result.current.setPage(0)
    })
    expect(result.current.page).toBe(1)

    // 负数 → clamp 到 1
    act(() => {
      result.current.setPage(-5)
    })
    expect(result.current.page).toBe(1)

    // 正常值 → 原样
    act(() => {
      result.current.setPage(2)
    })
    expect(result.current.page).toBe(2)
  })

  it('14. setArticles() 手动设置文章列表(供各端 createArticle 后本地更新)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.articles).toEqual([])

    // 直接设置数组
    const manual: TestArticle[] = [makeArticle(0), makeArticle(1)]
    act(() => {
      result.current.setArticles(manual)
    })
    expect(result.current.articles).toEqual(manual)
    expect(result.current.articles).toHaveLength(2)

    // 支持函数式更新(各端 createArticle 后追加)
    act(() => {
      result.current.setArticles(prev => [...prev, makeArticle(2)])
    })
    expect(result.current.articles).toHaveLength(3)
    expect(result.current.articles[2]!.id).toBe('a-2')
  })

  it('15. fetcher 返回空 list:articles 为空数组', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() => useArticles<TestArticle>({ fetcher }))

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.articles).toEqual([])
    expect(result.current.total).toBe(0)
    expect(result.current.totalPages).toBe(1) // Math.max(1, ceil(0/10))
    expect(result.current.hasNext).toBe(false) // page 1 < 1 为 false
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('16. 初始 categoryId/status 自定义(非 all)', async () => {
    const fetcher = vi.fn().mockResolvedValue({ list: [], total: 0 })
    const { result } = renderHook(() =>
      useArticles<TestArticle>({
        fetcher,
        initialCategoryId: 'cat-1',
        initialStatus: 'published',
      }),
    )

    // 初始 state(挂载时即为自定义值)
    expect(result.current.categoryId).toBe('cat-1')
    expect(result.current.status).toBe('published')

    // autoLoad 触发 load,fetcher 收到自定义 categoryId/status
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(fetcher).toHaveBeenCalledWith(
      expect.objectContaining({ categoryId: 'cat-1', status: 'published' }),
    )
  })
})
