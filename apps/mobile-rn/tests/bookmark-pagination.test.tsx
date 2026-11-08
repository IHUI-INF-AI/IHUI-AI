// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 C — RN 收藏页「硬截断 50 条」→ 真分页 + 加载更多。
 *
 * 后端 `GET /api/favorites` 本就是 page/pageSize 真分页(返回 { list, total, page, pageSize },
 * 无游标),但旧壳把它当单页用:固定 `{ page: 1, pageSize: 50 }`、只读 `list`、不读 `total`,
 * 第 51 条起在 UI 上直接消失。
 *
 * 判据:
 *  F1 壳把 hasMore / loadingMore / onLoadMore 接到共享屏(旧壳一个都没传);
 *  F2 触发「加载更多」后真的请求 page=2,并把两页按 id 合并(旧壳永远只发 page=1);
 *  F3 同一 tick 连点两次只发一页请求(共享 list 载体的同 tick 互斥);
 *  F4 下拉刷新回到 page=1 并重置分页态;
 *  F5 删除一条后按 total 收缩,不会把「已到底」误判成「还有下一页」。
 *
 * 另:共享屏从 ScrollView + items.map 改为 FlatList(虚拟化),见 F1 的容器标记断言。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createElement } from 'react'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import type * as ApiClient from '@ihui/api-client'

const nav = vi.hoisted(() => ({ navigate: vi.fn(), goBack: vi.fn() }))
const api = vi.hoisted(() => ({ getFavorites: vi.fn(), deleteFavorite: vi.fn() }))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: nav.navigate, goBack: nav.goBack }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

vi.mock('@ihui/api-client', async (importOriginal) => {
  const real = await importOriginal<typeof ApiClient>()
  return { ...real, getFavorites: api.getFavorites, deleteFavorite: api.deleteFavorite }
})

import { BookmarkScreen } from '../src/screens/BookmarkScreen'
import { I18nProvider } from '../src/i18n'
import { bookmarkScreenPropsCaptured } from './__mocks__/ihui-rn-app'

type RawFavorite = {
  id: string
  resourceId: string
  resourceType: string
  title: string
  createdAt: string
}

const raw = (id: string): RawFavorite => ({
  id,
  resourceId: `resource-${id}`,
  resourceType: 'course',
  title: `课程 ${id}`,
  createdAt: '2026-01-02T00:00:00.000Z',
})

const okPage = (list: RawFavorite[], total: number, page: number) => ({
  success: true as const,
  data: { list, total, page, pageSize: 20 },
})

const renderScreen = () => render(createElement(I18nProvider, null, createElement(BookmarkScreen)))
const latestProps = () => bookmarkScreenPropsCaptured[bookmarkScreenPropsCaptured.length - 1]!
const pageCalls = (page: number) =>
  api.getFavorites.mock.calls.filter(([q]) => (q as { page?: number } | undefined)?.page === page)
    .length

function installApi(opts: { page1: RawFavorite[]; page2?: RawFavorite[]; total: number }) {
  api.getFavorites.mockImplementation(async (query: { page: number }) => {
    if (query.page === 2) {
      if (!opts.page2) return { success: false as const, error: 'no more' }
      return okPage(opts.page2, opts.total, 2)
    }
    return okPage(opts.page1, opts.total, 1)
  })
  api.deleteFavorite.mockResolvedValue({ success: true, data: { favorited: false } })
}

beforeEach(() => {
  vi.clearAllMocks()
  bookmarkScreenPropsCaptured.length = 0
})

afterEach(() => {
  cleanup()
})

describe('票 C — RN 收藏页真分页', () => {
  it('F1 首屏只取第 1 页,且把分页端口/虚拟化列表接到共享屏', async () => {
    installApi({ page1: [raw('1'), raw('2')], page2: [raw('3')], total: 3 })
    renderScreen()

    await waitFor(() => expect(screen.queryByText('课程 1')).toBeTruthy())

    // 旧壳固定 pageSize=50 且只取一页;改为真分页后首屏仍应是 page=1。
    expect(pageCalls(1)).toBe(1)

    const props = latestProps()
    expect(typeof props.onLoadMore).toBe('function')
    expect(props.hasMore).toBe(true)
    expect(props.loadingMore).toBe(false)

    // 长列表承载件从 ScrollView 换成 FlatList(虚拟化)。
    expect(document.querySelector('[data-role="flatlist"]')).toBeTruthy()
    expect(document.querySelector('[data-rn-scrollview]')).toBeNull()
    // 底部「加载更多」入口常驻(还有下一页时)。
    expect(screen.queryByText('加载更多')).toBeTruthy()
  })

  it('F2 触发加载更多后请求 page=2,并合并两页', async () => {
    installApi({ page1: [raw('1'), raw('2')], page2: [raw('3')], total: 3 })
    renderScreen()

    await waitFor(() => expect(screen.queryByText('课程 2')).toBeTruthy())
    fireEvent.click(screen.getByText('加载更多'))

    await waitFor(() => expect(screen.queryByText('课程 3')).toBeTruthy())

    expect(latestProps().items.map((i) => i.id)).toEqual(['1', '2', '3'])
    expect(pageCalls(2)).toBe(1)
    expect(latestProps().hasMore).toBe(false)
    expect(screen.queryByText('加载更多')).toBeNull()
  })

  it('F3 同一 tick 连调两次 onLoadMore 只发一次 page=2 请求', async () => {
    installApi({ page1: [raw('1'), raw('2')], page2: [raw('3')], total: 3 })
    renderScreen()

    await waitFor(() => expect(screen.queryByText('课程 2')).toBeTruthy())
    // 直接连调两次:两次都拿到 loadingMore=false 的旧闭包(同一 tick 状态未落盘),
    // 若只靠 state 判重就会连发两页。触底 + 底部按钮双入口在真机上会撞到同一形态。
    await act(async () => {
      latestProps().onLoadMore!()
      latestProps().onLoadMore!()
    })

    // 先钉请求次数:漏互斥时这里会拿回 2,并伴随「同一 key 3 渲染两次」的重复行。
    expect(pageCalls(2)).toBe(1)

    await waitFor(() => expect(screen.queryByText('课程 3')).toBeTruthy())
    expect(latestProps().items.map((i) => i.id)).toEqual(['1', '2', '3'])
  })

  it('F4 下拉刷新回到第 1 页并重置分页态', async () => {
    installApi({ page1: [raw('1'), raw('2')], page2: [raw('3')], total: 3 })
    renderScreen()

    await waitFor(() => expect(screen.queryByText('课程 2')).toBeTruthy())
    fireEvent.click(screen.getByText('加载更多'))
    await waitFor(() => expect(screen.queryByText('课程 3')).toBeTruthy())

    act(() => {
      latestProps().onRefresh()
    })

    await waitFor(() => expect(screen.queryByText('课程 3')).toBeNull())
    expect(latestProps().items.map((i) => i.id)).toEqual(['1', '2'])
    expect(latestProps().hasMore).toBe(true)
    expect(pageCalls(1)).toBe(2)
  })

  it('F5 删除一条后按 total 收缩,不会误判「还有下一页」', async () => {
    installApi({ page1: [raw('1'), raw('2')], total: 2 })
    renderScreen()

    await waitFor(() => expect(screen.queryByText('课程 2')).toBeTruthy())
    expect(latestProps().hasMore).toBe(false)

    await act(async () => {
      await latestProps().onRemove(latestProps().items[0]!)
    })

    await waitFor(() => expect(latestProps().items).toHaveLength(1))
    expect(latestProps().items[0]!.id).toBe('2')
    // 旧壳删一条只动 items 不动 total ⇒ 1 < 2 会误判 hasMore=true,底部冒出「加载更多」。
    expect(latestProps().hasMore).toBe(false)
    expect(screen.queryByText('加载更多')).toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
