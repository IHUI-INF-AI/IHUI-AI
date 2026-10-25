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

const {
  userBroadcastMock,
  chatSyncMock,
  applyChatSyncMock,
  applySnapshotMock,
  fetchSnapshotMock,
  closeMeta,
  closeChat,
  storeState,
} = vi.hoisted(() => ({
  userBroadcastMock: vi.fn(),
  chatSyncMock: vi.fn(),
  applyChatSyncMock: vi.fn(),
  applySnapshotMock: vi.fn(),
  fetchSnapshotMock: vi.fn(),
  closeMeta: vi.fn(),
  closeChat: vi.fn(),
  storeState: { conversationId: 'conv-1' as string | null, gapIds: [] as string[] },
}))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign((sel: (s: { token: string }) => unknown) => sel({ token: 'tk' }), {
    getState: () => ({ token: 'tk' }),
  }),
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (sel: (s: { conversationId: string | null; chatSyncGapMessageIds: string[] }) => unknown) =>
      sel({ conversationId: storeState.conversationId, chatSyncGapMessageIds: storeState.gapIds }),
    {
      getState: () => ({
        conversationId: storeState.conversationId,
        currentModel: null,
        setModel: vi.fn(),
        applyChatSync: applyChatSyncMock,
        applyChatSyncSnapshot: applySnapshotMock,
      }),
    },
  ),
}))

vi.mock('@/components/common', () => ({ toast: { info: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ getQueryClient: () => ({}) }))
// B02 第三切片:gap 拉取的传输层 mock(端内 api 文件,hook 只认这一个出口)
vi.mock('@/api/chat-sync-api', () => ({ fetchChatSyncSnapshot: fetchSnapshotMock }))

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
  storeState.gapIds = []
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

describe('useConversationBroadcastSync — B02③ gap 拉取接线', () => {
  const SNAP = {
    conversationId: 'conv-1',
    messageId: 'm-gap',
    rev: 5,
    role: 'assistant' as const,
    content: '权威面',
  }

  it('坐标表非空 ⇒ 按坐标拉快照,回喂 applyChatSyncSnapshot(不在本层裁定)', async () => {
    storeState.gapIds = ['m-gap']
    fetchSnapshotMock.mockResolvedValueOnce(SNAP)
    const { rerender } = renderHook(() => useConversationBroadcastSync())
    await rerender()
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
    expect(fetchSnapshotMock).toHaveBeenCalledWith('conv-1', 'm-gap')
    expect(applySnapshotMock).toHaveBeenCalledTimes(1)
    expect(applySnapshotMock).toHaveBeenCalledWith(SNAP)
  })

  it('没有当前会话 ⇒ 不拉(坐标是会话局部坐标,无处挂)', async () => {
    storeState.conversationId = null
    storeState.gapIds = ['m-gap']
    renderHook(() => useConversationBroadcastSync())
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchSnapshotMock).not.toHaveBeenCalled()
  })

  it('在飞去重:同 messageId 在途时不重复拉,新坐标照拉', async () => {
    let resolveA: (v: unknown) => void = () => {}
    fetchSnapshotMock.mockImplementationOnce(
      () =>
        new Promise((res) => {
          resolveA = res
        }),
    )
    storeState.gapIds = ['m-a']
    const { rerender } = renderHook(() => useConversationBroadcastSync())
    await Promise.resolve()
    // 新坐标帧:坐标表引用变化(同一会话内又判出一个 gap)
    storeState.gapIds = ['m-a', 'm-b']
    fetchSnapshotMock.mockResolvedValueOnce({ ...SNAP, messageId: 'm-b' })
    await rerender()
    await Promise.resolve()
    await Promise.resolve()
    expect(fetchSnapshotMock).toHaveBeenCalledTimes(2)
    expect(fetchSnapshotMock).toHaveBeenNthCalledWith(2, 'conv-1', 'm-b')
    resolveA(SNAP)
    await Promise.resolve()
    await Promise.resolve()
    expect(applySnapshotMock).toHaveBeenCalledTimes(2)
  })

  it('失败冷却:60s 内坐标引用变化也不重拉;旗保留在账(失败不冒成功)', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(0)
    try {
      fetchSnapshotMock.mockRejectedValueOnce(new Error('404'))
      // Once 队列耗尽后的兜底:本用例只断言拉取次数与冷却,后续成功路径不参与断言
      fetchSnapshotMock.mockResolvedValue({ ...SNAP, messageId: 'm-unknown' })
      storeState.gapIds = ['m-x']
      const { rerender } = renderHook(() => useConversationBroadcastSync())
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchSnapshotMock).toHaveBeenCalledTimes(1)
      // 新 gap 帧让坐标表引用变化(effect 重跑),但仍在冷却窗内 ⇒ 不重拉:
      // 总调用 = mount 的 m-x(1)+ 新坐标 m-y(2),**不含** m-x 的第二次
      storeState.gapIds = ['m-x', 'm-y']
      await rerender()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchSnapshotMock).toHaveBeenCalledTimes(2)
      expect(fetchSnapshotMock).toHaveBeenNthCalledWith(1, 'conv-1', 'm-x')
      expect(fetchSnapshotMock).toHaveBeenNthCalledWith(2, 'conv-1', 'm-y')
      // 跨过 60s 冷却 ⇒ 同坐标可重试(第 3 次,仍是 m-x)
      vi.setSystemTime(61_000)
      storeState.gapIds = ['m-x']
      await rerender()
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchSnapshotMock).toHaveBeenCalledTimes(3)
      expect(fetchSnapshotMock).toHaveBeenLastCalledWith('conv-1', 'm-x')
    } finally {
      vi.useRealTimers()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
