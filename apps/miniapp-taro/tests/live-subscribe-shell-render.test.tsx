// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 直播订阅页薄壳锁(apps/miniapp-taro/src/pkg-learn/live/subscribe.tsx)。
//
// 语义变化:本页由「全部即将开播」(getLiveList({status:'upcoming'}))改为
// 「我订阅的频道」(GET /live/subscriptions)。
// 判据:
//   ① 源码钉住共享屏入口,数据源必须 getLiveSubscriptions、不得再出现 getLiveList
//   ② 直播映射字段真实存在(targetType / coverUrl / anchor / status),壳不传 onBack
//   ③ 共享屏真挂进树;取消走 unsubscribeLive,点击跳直播详情,「去发现」跳直播列表
//   (阴性对照:摘掉 targetType:'live' 映射或改回 getLiveList,①③ 段断言立即转红)

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createElement, type ReactNode } from 'react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
  getLiveSubscriptions: vi.fn(),
  unsubscribeLive: vi.fn(),
  setStorageSync: vi.fn(),
  navigateTo: vi.fn(),
}))

vi.mock('@ihui/rn-app/features/subscriptions/SubscriptionsScreen', () => ({
  SubscriptionsScreen: (p: Record<string, unknown>) => {
    h.props = p
    return createElement('div', { 'data-screen': 'subscriptions' })
  },
}))

vi.mock('@/api', () => ({
  getLiveSubscriptions: h.getLiveSubscriptions,
  unsubscribeLive: h.unsubscribeLive,
}))

vi.mock('@tarojs/taro', () => {
  const api = {
    getStorageSync: vi.fn(() => 'true'),
    setStorageSync: h.setStorageSync,
    navigateTo: h.navigateTo,
    stopPullDownRefresh: vi.fn(),
  }
  return {
    default: api,
    ...api,
    useDidShow: vi.fn(),
    usePullDownRefresh: vi.fn(),
  }
})

vi.mock('@/i18n', () => ({
  useTt: () => (key: string, fallback?: string) => fallback ?? key,
  t: (key: string) => key,
}))

vi.mock('@/lib/theme', () => ({
  useAppTheme: () => ({ resolved: 'light' }),
}))

vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn() } }))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) =>
    createElement('div', { 'data-theme-root': '' }, props.children)
  Stub.displayName = 'ThemeRootStub'
  return { default: Stub }
})

import LiveSubscribePage from '../src/pkg-learn/live/subscribe'

const PAGE_SOURCE = readFileSync(resolve('src/pkg-learn/live/subscribe.tsx'), 'utf8')

const renderPage = () => {
  h.props = null
  const html = renderToStaticMarkup(createElement(LiveSubscribePage))
  return { html, props: h.props as unknown as Record<string, unknown> }
}

const LIVE_ITEM = {
  id: 'live-1',
  targetType: 'live',
  targetId: '555',
  createdAt: '',
  title: '直播甲',
  coverUrl: 'https://img.example/cover.png',
  anchor: '李老师',
  startTime: '2026-11-05 20:00',
  status: 'living',
}

describe('直播订阅页薄壳', () => {
  beforeEach(() => {
    h.getLiveSubscriptions.mockReset()
    h.unsubscribeLive.mockReset()
    h.setStorageSync.mockReset()
    h.navigateTo.mockReset()
    h.getLiveSubscriptions.mockResolvedValue({ success: true, data: { list: [] } })
    h.unsubscribeLive.mockResolvedValue({ success: true, data: { ok: true } })
  })

  it('① 源码钉住共享屏入口与 getLiveSubscriptions,旧 getLiveList 已移除', () => {
    expect(PAGE_SOURCE).toContain("from '@ihui/rn-app/features/subscriptions/SubscriptionsScreen'")
    expect(PAGE_SOURCE).toContain('getLiveSubscriptions(')
    expect(PAGE_SOURCE).not.toContain('getLiveList')
    expect(PAGE_SOURCE).not.toContain('onBack')
  })

  it('② 直播映射字段与壳回调真实存在', () => {
    expect(PAGE_SOURCE).toContain("targetType: 'live'")
    expect(PAGE_SOURCE).toContain('coverUrl:')
    expect(PAGE_SOURCE).toContain('anchor:')
    expect(PAGE_SOURCE).toContain('status:')
    expect(PAGE_SOURCE).toContain('reminderEnabled={')
    expect(PAGE_SOURCE).toContain('onToggleReminder={')
    expect(PAGE_SOURCE).toContain('onPressItem={')
    expect(PAGE_SOURCE).toContain('onGoDiscover={')
  })

  it('③ 共享屏真挂进树:props 齐备,取消走 unsubscribeLive,点击跳详情/去发现', async () => {
    const { html, props } = renderPage()
    expect(html).toContain('data-theme-root')
    expect(html).toContain('data-screen="subscriptions"')
    expect(props).not.toBeNull()

    expect(Array.isArray(props.items)).toBe(true)
    expect(props.reminderEnabled).toBe(true)
    expect(typeof props.onToggleReminder).toBe('function')
    expect(typeof props.onPressItem).toBe('function')
    expect(typeof props.onGoDiscover).toBe('function')
    expect(typeof props.onCancel).toBe('function')
    expect(props.onBack).toBeUndefined()

    // 取消订阅 → DELETE 端点
    await (props.onCancel as (i: typeof LIVE_ITEM) => Promise<void>)(LIVE_ITEM)
    expect(h.unsubscribeLive).toHaveBeenCalledWith('555')

    // 直播行点击 → 直播详情
    ;(props.onPressItem as (i: typeof LIVE_ITEM) => void)(LIVE_ITEM)
    expect(h.navigateTo).toHaveBeenCalledWith({ url: '/pkg-learn/live/detail?id=555' })

    // 空态 CTA → 直播列表
    ;(props.onGoDiscover as () => void)()
    expect(h.navigateTo).toHaveBeenCalledWith({ url: '/pkg-learn/live/list' })

    // 提醒开关持久化(与 RN/小程序同键)
    ;(props.onToggleReminder as (v: boolean) => void)(false)
    expect(h.setStorageSync).toHaveBeenCalledWith('live_reminder_enabled', 'false')
  })
})
