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
    navigate: vi.fn(),
    goBack: vi.fn(),
  },
}))

vi.mock('@ihui/api-client', () => ({
  fetchApi: apiMocks.fetchApi,
  listConversations: apiMocks.listConversations,
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
    MessageCenterScreen: ({
      conversations,
      onPressConversation,
      items,
    }: {
      conversations?: { id: string; name: string; lastMessage?: string; time?: string }[]
      onPressConversation?: (c: { id: string; name: string }) => void
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
})
