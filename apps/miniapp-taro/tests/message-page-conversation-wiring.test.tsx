// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 小程序 message 页会话行行为接线锁(2026-11-06 跨端行为 prop 对齐)。
//
// ① 阳:'all' tab 的会话行不再由页面 renderTabBody 自绘,改传 conversations +
//    conversationsTab='all' + onPressConversation/onDeleteConversation/
//    renderConversationActions 给共享屏;renderTabBody('all') 必须为 null(交回共享屏);
//    系统/私信/order/course 等缺段仍由本端注入。
// ② 阴:摘掉任一行为传参(或把 'all' 分支塞回 renderTabBody)时,本册首条断言必红。

import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const h = vi.hoisted(() => ({
  props: null as Record<string, unknown> | null,
}))

vi.mock('@ihui/rn-app/features/message-center/MessageCenterScreen', () => ({
  MessageCenterScreen: (props: Record<string, unknown>) => {
    h.props = props
    return createElement('div', { 'data-screen': 'message-center' })
  },
}))

vi.mock('@/api', () => ({
  getMessageRooms: vi.fn(() => Promise.resolve({ data: [] })),
  getSystemNotices: vi.fn(() => Promise.resolve({ data: [] })),
  getPrivateMessages: vi.fn(() => Promise.resolve({ data: [] })),
  getNotificationPreferences: vi.fn(() => Promise.resolve({ data: {} })),
  updateNotificationPreferences: vi.fn(() => Promise.resolve({})),
  markMessageRead: vi.fn(() => Promise.resolve({})),
  markPrivateRead: vi.fn(() => Promise.resolve({})),
  deleteMessage: vi.fn(() => Promise.resolve({})),
  deletePrivateMessage: vi.fn(() => Promise.resolve({})),
}))

vi.mock('@/hooks/use-auth-ready-gate', () => ({ useAuthReadyGate: () => ({ ready: true }) }))
vi.mock('@/utils/auth', () => ({ getUserInfo: () => ({}) }))
vi.mock('@/utils/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }))
vi.mock('@/utils/system-info', () => ({
  getTopBarMetrics: () => ({ top: 0, height: 44, statusBarHeight: 0 }),
}))
vi.mock('@/host/on-toast', () => ({ onToast: vi.fn() }))
vi.mock('@/i18n', () => ({
  useI18n: () => ({ t: (key: string, fallback?: string) => fallback ?? key }),
}))

vi.mock('@/components/ThemeRoot', () => {
  const Stub = (props: { children?: ReactNode }) => createElement('div', null, props.children)
  return { default: Stub }
})
vi.mock('@/components', () => {
  const Stub = (props: { children?: ReactNode }) => createElement('div', null, props.children)
  return {
    NavBar: Stub,
    SystemNotice: Stub,
    PrivateMessageList: Stub,
    MessageDetail: Stub,
    MessageActions: Stub,
    NotificationSettings: Stub,
  }
})

vi.mock('@/pkg-user/message/in-site-messages', () => {
  const Stub = (props: { children?: ReactNode }) => createElement('div', null, props.children)
  return { InSiteMessagePane: Stub }
})

vi.mock('@tarojs/components', () => ({ View: 'div', Text: 'span' }))
vi.mock('@tarojs/taro', () => {
  const api = {
    setNavigationBarTitle: vi.fn(),
    navigateBack: vi.fn(),
    navigateTo: vi.fn(),
    getStorageSync: vi.fn(() => ''),
    setStorageSync: vi.fn(),
  }
  return { default: api, ...api, useDidShow: vi.fn(), useReachBottom: vi.fn() }
})

import MessagePage from '../src/pkg-user/message/index'

describe('小程序 message 页会话行行为接线', () => {
  it('阳:会话行行为全部真传共享屏,且 all 不再由本端自绘', () => {
    renderToStaticMarkup(createElement(MessagePage))
    const p = h.props as Record<string, unknown> | null
    expect(p).toBeTruthy()

    expect(p!.conversationsTab).toBe('all')
    expect(p!.conversations).toBeDefined()
    expect(Array.isArray(p!.conversations)).toBe(true)
    expect(typeof p!.onPressConversation).toBe('function')
    expect(typeof p!.onDeleteConversation).toBe('function')
    expect(typeof p!.renderConversationActions).toBe('function')

    const renderTabBody = p!.renderTabBody as (tab: string) => ReactNode | null
    expect(typeof renderTabBody).toBe('function')
    // 'all' 会话行已下沉到共享屏:本端注入体必须返回 null,否则行为 prop 会被自绘体遮蔽
    expect(renderTabBody('all')).toBeNull()
    // 缺段仍由本端注入:系统通知/私信/order/course 不得被误删
    expect(renderTabBody('system')).not.toBeNull()
    expect(renderTabBody('private')).not.toBeNull()
    expect(renderTabBody('order')).not.toBeNull()
    expect(renderTabBody('course')).not.toBeNull()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
