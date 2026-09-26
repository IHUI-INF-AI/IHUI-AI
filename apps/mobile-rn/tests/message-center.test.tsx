// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * MessageCenterScreen 消息中心测试
 *
 * 覆盖(对齐 Uniapp pagesA/message/index.vue):
 * - 通知列表加载(/api/messages?type=)
 * - 会话列表区块(listConversations 并行加载)
 * - 无会话时不渲染会话区块
 * - 点击会话 → MessageChat(peerId/name)
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import type { ReactNode } from 'react'

const { apiMocks } = vi.hoisted(() => ({
  apiMocks: {
    fetchApi: vi.fn(),
    listConversations: vi.fn(),
    setConversationPinned: vi.fn(),
    navigate: vi.fn(),
    goBack: vi.fn(),
    alert: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  listConversations: apiMocks.listConversations,
  setConversationPinned: apiMocks.setConversationPinned,
}))

vi.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: apiMocks.navigate, goBack: apiMocks.goBack }),
}))

vi.mock('../src/i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}))

vi.mock('../src/context/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}))

// features 共享层 MessageCenterScreen 骨架(渲染 header/tab/列表/会话区块)
vi.mock('@ihui/rn-app', async () => {
  const { createElement: h } = await import('react')
  return {
    SearchInput: ({
      value,
      onChangeText,
    }: {
      value?: string
      onChangeText?: (value: string) => void
    }) =>
      h('input', {
        value,
        onChange: (event: { target: { value: string } }) => onChangeText?.(event.target.value),
      }),
    MessageCenterScreen: ({
      conversations,
      onPressConversation,
      onTogglePin,
      items,
    }: {
      conversations?: { id: string; name: string; lastMessage?: string; time?: string }[]
      onPressConversation?: (c: { id: string; name: string }) => void
      onTogglePin?: (c: { id: string; name: string }) => void
      items?: { id: string; title: string }[]
    }) =>
      h('div', { 'data-testid': 'message-center-root' }, [
        h(
          'div',
          { 'data-testid': 'conversations' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              { key: c.id, onClick: () => onPressConversation?.(c) },
              c.name + (c.lastMessage ? ':' + c.lastMessage : ''),
            ),
          ),
        ),
        // 置顶入口替身:替真实共享屏那颗按钮,行为断言打在 wrapper 注入的 onTogglePin 上
        h(
          'div',
          { 'data-testid': 'pin-actions' },
          (conversations ?? []).map((c) =>
            h(
              'button',
              {
                key: `pin-${c.id}`,
                'data-pin-id': c.id,
                onClick: () => onTogglePin?.(c),
              },
              `pin:${c.id}`,
            ),
          ),
        ),
        h(
          'div',
          { 'data-testid': 'messages' },
          (items ?? []).map((i) => h('span', { key: i.id }, i.title)),
        ),
      ]),
  }
})

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react')
  const mk = (tag: string) =>
    function MockComp(props: { children?: ReactNode; [k: string]: unknown }) {
      return h(tag, null, props.children)
    }
  return {
    View: mk('div'),
    Text: mk('span'),
    TouchableOpacity: mk('button'),
    TextInput: mk('input'),
    Pressable: mk('button'),
    ScrollView: mk('div'),
    Image: mk('img'),
    RefreshControl: () => null,
    // 置顶失败反馈出口:Alert.alert(...) 成员调用(守门 11f 的 (?<!\.) 明确豁免 RN 形态)
    Alert: { alert: apiMocks.alert },
    StyleSheet: { create: (s: Record<string, unknown>) => s },
  }
})

import { MessageCenterScreen } from '../src/screens/MessageCenterScreen'

const mockMessage = {
  id: 'm1',
  type: 'system',
  title: '系统通知',
  content: '内容',
  read: false,
  createdAt: '2026-08-19T10:00:00Z',
}

describe('MessageCenterScreen 消息中心', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.fetchApi.mockResolvedValue({ success: true, data: { list: [mockMessage], total: 1 } })
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [{ id: 'c1', title: 'AI客服', lastMessageAt: '2026-08-19T10:00:00Z' }],
        total: 1,
      },
    })
  })

  it('加载通知列表与会话列表', async () => {
    const { container } = render(<MessageCenterScreen />)

    await waitFor(() => {
      expect(apiMocks.fetchApi).toHaveBeenCalled()
      expect(apiMocks.listConversations).toHaveBeenCalled()
    })
    await waitFor(() => {
      const messages = container.querySelectorAll('[data-testid="messages"]')
      expect(messages[0]!.textContent).toContain('系统通知')
    })
    await waitFor(() => {
      const conversations = container.querySelectorAll('[data-testid="conversations"]')
      expect(conversations[0]!.textContent).toContain('AI客服')
    })
  })

  it('无会话时不渲染会话区块', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: { conversations: [], total: 0 },
    })
    const { container } = render(<MessageCenterScreen />)

    await waitFor(() => {
      const conversations = container.querySelectorAll('[data-testid="conversations"]')
      expect(conversations[0]?.textContent ?? '').toBe('')
    })
  })

  it('点击会话跳 MessageChat(peerId/name)', async () => {
    const { container } = render(<MessageCenterScreen />)

    await waitFor(() => {
      const conversations = container.querySelectorAll('[data-testid="conversations"]')
      expect(conversations[0]!.textContent).toContain('AI客服')
    })
    const conversations = container.querySelectorAll('[data-testid="conversations"]')
    fireEvent.click(conversations[0]!.querySelector('button') as HTMLButtonElement)

    await waitFor(() => {
      expect(apiMocks.navigate).toHaveBeenCalledWith('MessageChat', {
        peerId: 'c1',
        name: 'AI客服',
      })
    })
  })

  // ── D20 会话置顶(G-11)端内接线:调了哪个方法 / 参数对不对 / 顺序变没变 / 失败喊没喊 ──

  it('点置顶 → setConversationPinned(id,true) 且列表按置顶优先重排', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { id: 'c1', title: '第一' },
          { id: 'c2', title: '第二' },
        ],
        total: 2,
      },
    })
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-pin-id="c2"]').length).toBe(1)
    })

    fireEvent.click(container.querySelector('[data-pin-id="c2"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(apiMocks.setConversationPinned).toHaveBeenCalledWith('c2', true)
    })
    // 重排断言:成功回写后 c2 落到会话区第一位(稳定排序,其余行保持相对顺序)
    await waitFor(() => {
      const convButtons = container
        .querySelector('[data-testid="conversations"]')!
        .querySelectorAll('button')
      expect(convButtons[0]?.textContent).toContain('第二')
      expect(convButtons[1]?.textContent).toContain('第一')
    })
  })

  it('置顶失败 → Alert 喊出(不得静默),列表顺序原样', async () => {
    apiMocks.listConversations.mockResolvedValue({
      success: true,
      data: {
        conversations: [
          { id: 'c1', title: '第一' },
          { id: 'c2', title: '第二' },
        ],
        total: 2,
      },
    })
    apiMocks.setConversationPinned.mockRejectedValueOnce(new Error('403'))
    const { container } = render(<MessageCenterScreen />)
    await waitFor(() => {
      expect(container.querySelectorAll('[data-pin-id="c1"]').length).toBe(1)
    })

    fireEvent.click(container.querySelector('[data-pin-id="c1"]') as HTMLButtonElement)

    await waitFor(() => {
      expect(apiMocks.setConversationPinned).toHaveBeenCalledWith('c1', true)
      expect(apiMocks.alert).toHaveBeenCalled()
    })
    const convButtons = container
      .querySelector('[data-testid="conversations"]')!
      .querySelectorAll('button')
    expect(convButtons[0]?.textContent).toContain('第一')
    expect(convButtons[1]?.textContent).toContain('第二')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
