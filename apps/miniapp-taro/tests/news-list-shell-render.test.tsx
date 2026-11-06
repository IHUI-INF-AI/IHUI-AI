// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 资讯列表页薄壳锁(apps/miniapp-taro/src/pkg-content/news/list.tsx)。
//
// 判据只落在「页有没有真把资讯语义交给共享屏」,不判共享屏内部:
//   ① 页源码 import 的是共享屏等价入口,且分类/置顶/已读/分类选中共四处传参真实存在
//      (摘掉任一处 ⇒ 本册必红,即阴性对照)
//   ② 数据来源必须是资讯域 getNewsList,不是通用文章接口
//   ③ 共享屏真挂进树里,收到的 props 带资讯字段;点击回调走已读落盘 + 资讯详情

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  getNewsList: vi.fn(),
  setStorageSync: vi.fn(),
  navigateTo: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/article-list/ArticleListScreen', () => ({
  ArticleListScreen: (p: Record<string, unknown>) => {
    h.props = p
    return createElement('div', { 'data-screen': 'article-list' })
  },
}))

vi.mock('@/api', () => ({ getNewsList: h.getNewsList }))

vi.mock('@tarojs/taro', () => {
  const api = {
    setNavigationBarTitle: vi.fn(),
    getStorageSync: vi.fn(() => ''),
    setStorageSync: h.setStorageSync,
    navigateTo: h.navigateTo,
    navigateBack: vi.fn(),
    stopPullDownRefresh: vi.fn(),
  }
  return {
    default: api,
    ...api,
    usePullDownRefresh: vi.fn(),
    useReachBottom: vi.fn(),
  }
})

vi.mock('@/i18n', () => ({
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
  t: (key: string) => key,
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import NewsListPage from '../src/pkg-content/news/list'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-content/news/list.tsx'), 'utf8')

const renderPage = () => {
  h.props = null
  const html = renderToStaticMarkup(createElement(NewsListPage))
  return { html, props: h.props as unknown as Record<string, unknown> }
}

describe('资讯列表页薄壳', () => {
  beforeEach(() => {
    h.getNewsList.mockReset()
    h.setStorageSync.mockReset()
    h.navigateTo.mockReset()
    h.getNewsList.mockResolvedValue({ list: [], total: 0 })
  })

  it('① 源码钉住共享屏等价入口 + 分类/置顶/已读/分类选中四处传参(摘掉必红)', () => {
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/article-list/ArticleListScreen'")
    expect(PAGE_SOURCE).toContain('categories={')
    expect(PAGE_SOURCE).toContain('pinnedItem={')
    expect(PAGE_SOURCE).toContain('readIds={')
    expect(PAGE_SOURCE).toContain('selectedCategory={')
  })

  it('② 数据来源走资讯域 getNewsList,不碰通用文章接口', () => {
    expect(PAGE_SOURCE).toContain('getNewsList(')
    expect(PAGE_SOURCE).not.toContain('listPublicArticles')
    expect(PAGE_SOURCE).not.toContain('/api/articles')
  })

  it('③ 共享屏真挂进树里,props 带资讯字段,点击走已读落盘 + 资讯详情', () => {
    const { html, props } = renderPage()
    expect(html).toContain('data-theme-root')
    expect(html).toContain('data-screen="article-list"')
    expect(props).not.toBeNull()

    expect(props.hideHeader).toBe(true)
    expect(props.selectedCategory).toBe('all')
    expect((props.categories as { id: string }[]).map((c) => c.id)).toEqual([
      'all',
      'announce',
      'activity',
      'info',
      'tutorial',
    ])
    expect(Array.isArray(props.readIds)).toBe(true)
    expect(typeof props.onPressItem).toBe('function')

    // 真消费:走共享屏注入的点击回调 → 已读落盘 + 资讯详情
    ;(props.onPressItem as (item: { id: string }) => void)({ id: 'a1' })
    expect(h.setStorageSync).toHaveBeenCalledWith('news_read_ids', JSON.stringify(['a1']))
    expect(h.navigateTo).toHaveBeenCalledWith({ url: '/pkg-content/news/detail?id=a1' })

    // 搜索提交真接资讯域请求(不是空回调)
    ;(props.onSearch as () => void)()
    expect(h.getNewsList).toHaveBeenCalled()
  })

  it('④ 回顶接线:showBackTop/onListRef/onBackToTop 真接通,点击真驱动 scrollToOffset', () => {
    // 摘掉任一处接线 ⇒ 本册必红(阴性对照)
    expect(PAGE_SOURCE).toContain('showBackTop')
    expect(PAGE_SOURCE).toContain('onBackToTop={handleBackToTop}')
    expect(PAGE_SOURCE).toContain('onListRef={')

    const { props } = renderPage()
    expect(props.showBackTop).toBe(true)
    expect(typeof props.onListRef).toBe('function')
    expect(typeof props.onBackToTop).toBe('function')

    const handle = { scrollToOffset: vi.fn() }
    ;(props.onListRef as (ref: unknown) => void)(handle)
    ;(props.onBackToTop as () => void)()
    expect(handle.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: true })
  })
})
