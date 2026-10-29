// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票71(V2 #23)第二切片:web 会话广播 hook 的消息面接线回归(2026-10-24)。
 *
 * 钉四件事:
 *  ① 有当前会话 + 有 token ⇒ 按该 conversationId 建消息面订阅(参数钉死,不做可变房间);
 *  ② 没有当前会话 ⇒ 不建消息面订阅(但仍建会话元数据订阅);
 *  ③ 帧回调**原样**交给 store 的 applyChatSync —— 房间过滤与幂等裁定在内核,此处不做第二份;
 *  ④ 卸载时两路订阅都 close(成对清理,不留监听)。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'

const { userBroadcastMock, chatSyncMock, applyChatSyncMock, closeMeta, closeChat, storeState } =
  vi.hoisted(() => ({
    userBroadcastMock: vi.fn(),
    chatSyncMock: vi.fn(),
    applyChatSyncMock: vi.fn(),
    closeMeta: vi.fn(),
    closeChat: vi.fn(),
    storeState: { conversationId: 'conv-1' as string | null },
  }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign((sel: (s: { token: string }) => unknown) => sel({ token: 'tk' }), {
    getState: () => ({ token: 'tk' }),
  }),
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (sel: (s: { conversationId: string | null }) => unknown) =>
      sel({ conversationId: storeState.conversationId }),
    {
      getState: () => ({
        conversationId: storeState.conversationId,
        currentModel: null,
        setModel: vi.fn(),
        applyChatSync: applyChatSyncMock,
      }),
    },
  ),
}))

vi.mock('@/components/common', () => ({ toast: { info: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ getQueryClient: () => ({}) }))

vi.mock('@ihui/api-client', () => ({
  subscribeUserBroadcast: (...args: unknown[]) => {
    userBroadcastMock(...args)
    return { close: closeMeta }
  },
  subscribeChatSync: (...args: unknown[]) => {
    chatSyncMock(...args)
    return { close: closeChat }
  },
}))

import { useConversationBroadcastSync } from '../use-conversation-broadcast-sync'

beforeEach(() => {
  vi.clearAllMocks()
  storeState.conversationId = 'conv-1'
})

describe('useConversationBroadcastSync — 票71 消息面接线', () => {
  it('有当前会话时按 conversationId 订阅消息面(参数钉死)', () => {
    renderHook(() => useConversationBroadcastSync())
    expect(chatSyncMock).toHaveBeenCalledTimes(1)
    expect(chatSyncMock.mock.calls[0]?.[1]).toBe('conv-1')
  })

  it('没有当前会话时不建消息面订阅,但会话元数据订阅仍在', () => {
    storeState.conversationId = null
    renderHook(() => useConversationBroadcastSync())
    expect(chatSyncMock).not.toHaveBeenCalled()
    expect(userBroadcastMock).toHaveBeenCalledTimes(1)
  })

  it('帧回调原样交给 store.applyChatSync(内核裁定不在本层复制)', () => {
    renderHook(() => useConversationBroadcastSync())
    const onEvent = chatSyncMock.mock.calls[0]?.[2] as (evt: unknown) => void
    expect(typeof onEvent).toBe('function')
    const evt = { data: { room: { conversationId: 'conv-1' }, messageId: 'm1', rev: 1 } }
    onEvent(evt)
    expect(applyChatSyncMock).toHaveBeenCalledTimes(1)
    expect(applyChatSyncMock).toHaveBeenCalledWith(evt)
  })

  it('卸载时两路订阅都关闭(成对清理)', () => {
    const { unmount } = renderHook(() => useConversationBroadcastSync())
    unmount()
    expect(closeMeta).toHaveBeenCalledTimes(1)
    expect(closeChat).toHaveBeenCalledTimes(1)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
