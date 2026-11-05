// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MessageCenterScreen(RN 侧)槽位真传契约测试。
 *
 * 判的是端内壳职责:会话删除/设置入口/搜索/分页 hasMore 必须由 RN 壳真传给共享屏
 * (共享屏只按"回调不传则不渲染"消费,不在屏内落任何平台请求)。
 * 双向阴性对照:同一把尺子在槽位缺失时必抛,防止判据恒真。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { captured } = vi.hoisted(() => ({ captured: vi.fn() }))

vi.mock('@ihui/rn-app/features/message-center/MessageCenterScreen', () => ({
  MessageCenterScreen: (props: Record<string, unknown>) => {
    captured(props)
    return null
  },
}))
vi.mock('@ihui/api-client', () => ({
  fetchApi: vi.fn(async () => ({ success: true, data: { list: [], total: 0 } })),
  listConversations: vi.fn(async () => ({
    success: true,
    data: { conversations: [{ id: 'c1', title: '会话A', lastMessage: 'hi' }] },
  })),
  deleteConversation: vi.fn(async () => ({ success: true })),
  markMessageRead: vi.fn(async () => ({ success: true })),
  setConversationPinned: vi.fn(async () => ({ success: true })),
}))
vi.mock('@ihui/shared/chat/conversation-pin', () => ({
  togglePinnedItem: vi.fn(async () => ({ ok: true, items: [] })),
}))
vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: vi.fn(), goBack: vi.fn() }),
}))
vi.mock('@react-navigation/native-stack', () => ({}))
vi.mock('../src/i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }))
vi.mock('../src/context/ThemeContext', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
vi.mock('../src/hooks', () => ({ useRefreshOnFocus: () => {} }))
vi.mock('../src/host/use-host-ports', () => ({
  useHostPorts: () => ({ onToast: vi.fn(), onNavigate: vi.fn() }),
}))
vi.mock('../src/components/BottomPops', () => ({ appAlert: vi.fn() }))

import { MessageCenterScreen } from '../src/screens/MessageCenterScreen'

/** 槽位尺子:缺槽即抛(阴性对照用同一把尺子) */
function assertFn(props: Record<string, unknown>, name: string) {
  expect(typeof props[name]).toBe('function')
}

describe('MessageCenterScreen 槽位真传(RN)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    captured.mockClear()
  })

  it('RN 壳把会话删除/设置入口/搜索/分页真传给共享屏', async () => {
    render(<MessageCenterScreen />)
    await waitFor(() => expect(captured).toHaveBeenCalled())
    const props = captured.mock.calls.at(-1)?.[0] as Record<string, unknown>
    assertFn(props, 'onDeleteConversation')
    assertFn(props, 'onPressSettings')
    assertFn(props, 'onMarkRead')
    assertFn(props, 'onTogglePin')
    expect(props.search).toMatchObject({ value: '' })
    expect(props.hasMore).toBe(false)
    expect(Array.isArray(props.items)).toBe(true)
    expect(props.conversations).toHaveLength(1)
  })

  it('阴性对照:槽位缺失时同一把尺子必抛', () => {
    expect(() => assertFn({}, 'onDeleteConversation')).toThrow()
    expect(() => assertFn({ onDeleteConversation: undefined }, 'onDeleteConversation')).toThrow()
    expect(() => assertFn({}, 'onPressSettings')).toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
