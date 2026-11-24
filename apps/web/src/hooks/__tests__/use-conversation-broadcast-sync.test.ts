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
    storeState: {
      conversationId: 'conv-1' as string | null,
      gapMessageIds: [] as string[],
      // 重连补增量 planner 的只读输入面,逐例赋具体 Map
      chatSync: {
        messages: new Map<string, unknown>(),
        appliedRevs: new Map<string, number>(),
      } as unknown as import('@ihui/types').ChatSyncState,
    },
  }))

vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

vi.mock('@/stores/auth', () => ({
  useAuthStore: Object.assign((sel: (s: { token: string }) => unknown) => sel({ token: 'tk' }), {
    getState: () => ({ token: 'tk' }),
  }),
}))

vi.mock('@/stores/chat', () => ({
  useChatStore: Object.assign(
    (sel: (s: Record<string, unknown>) => unknown) =>
      sel({
        conversationId: storeState.conversationId,
        chatSyncGapMessageIds: storeState.gapMessageIds,
        chatSync: storeState.chatSync,
      }),
    {
      getState: () => ({
        conversationId: storeState.conversationId,
        currentModel: null,
        setModel: vi.fn(),
        applyChatSync: applyChatSyncMock,
        chatSync: storeState.chatSync,
      }),
    },
  ),
}))

vi.mock('@/components/common', () => ({ toast: { info: vi.fn() } }))
vi.mock('@/lib/query-client', () => ({ getQueryClient: () => ({}) }))

// 票71 剩余缺口②:resync 编排本体由 src/lib/__tests__/chat-sync-resync.test.ts 定点;
// 本文件只钉"hook 是否按坐标触发"。不 mock 的话会连带加载 @/lib/api(与本文件的
// @ihui/api-client 精简 mock 冲突)。
const { resyncMock } = vi.hoisted(() => ({ resyncMock: vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/chat-sync-resync', () => ({ resyncChatSyncGaps: resyncMock }))

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
  storeState.gapMessageIds = []
  storeState.chatSync = {
    messages: new Map<string, unknown>(),
    appliedRevs: new Map<string, number>(),
  } as unknown as import('@ihui/types').ChatSyncState
})

/** 从 meta 订阅的 handlers 里取 onState,按真实状态机序列驱动重连判定。 */
function emitConnectionState(s: 'idle' | 'connecting' | 'open' | 'closed'): void {
  const handlers = userBroadcastMock.mock.calls[0]?.[1] as
    { onState?: (state: string) => void } | undefined
  handlers?.onState?.(s)
}

/** 构造一条无终态 / 有终态消息面(planner 只认 terminal 有无,内容不参与判定)。 */
function syncStateOf(entries: readonly [string, boolean][]): import('@ihui/types').ChatSyncState {
  return {
    messages: new Map(
      entries.map(([id, done]) => [
        id,
        done
          ? { id, role: 'assistant', content: 'ok', terminal: 'completed' }
          : { id, role: 'assistant', content: '' },
      ]),
    ),
    appliedRevs: new Map(entries.map(([id], i) => [id, i + 1])),
  } as unknown as import('@ihui/types').ChatSyncState
}

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

  // 票71 剩余缺口②(2026-10-31):gap 坐标非空 ⇒ 按坐标触发 resync;空 ⇒ 一次都不发。
  it('gap 坐标非空时按坐标触发 resync(会话钉死,带取消判据)', () => {
    storeState.gapMessageIds = ['m-1', 'm-2']
    renderHook(() => useConversationBroadcastSync())
    expect(resyncMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).toHaveBeenCalledWith({
      conversationId: 'conv-1',
      messageIds: ['m-1', 'm-2'],
      isCancelled: expect.any(Function),
    })
  })

  it('没有 gap 坐标时结构上不发 resync(duplicate/stale 是正常路径)', () => {
    renderHook(() => useConversationBroadcastSync())
    expect(resyncMock).not.toHaveBeenCalled()
  })

  // ==================== 重连补增量(接活休眠的 planChatSyncReconnectResync) ====================
  // 病灶:断线期间服务端可能已推进消息流,原实现只重建 socket、不补拉 ⇒ 增量永久丢失。
  // 纪律:坐标只由契约 planner 判定(只挑无终态),首次连接不轰炸,拉回结果走既有四维上报。
  it('首次 open 不触发补拉(不对全部历史消息做快照轰炸)', () => {
    storeState.chatSync = syncStateOf([
      ['m-live', false],
      ['m-older', false],
    ])
    renderHook(() => useConversationBroadcastSync())
    emitConnectionState('connecting')
    emitConnectionState('open')
    expect(resyncMock).not.toHaveBeenCalled()
  })

  it('断开后重连 ⇒ 只按 planner 挑出的无终态消息补拉', () => {
    storeState.chatSync = syncStateOf([
      ['m-live', false],
      ['m-done', true],
    ])
    renderHook(() => useConversationBroadcastSync())
    emitConnectionState('connecting')
    emitConnectionState('open') // 首连:不补
    expect(resyncMock).not.toHaveBeenCalled()
    emitConnectionState('closed')
    emitConnectionState('connecting')
    emitConnectionState('open') // 重连:补增量
    expect(resyncMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conv-1',
        messageIds: ['m-live'],
        isCancelled: expect.any(Function),
      }),
    )
  })

  it('全部消息已终态 ⇒ 重连也不发请求(planner.needed=false)', () => {
    storeState.chatSync = syncStateOf([['m-done', true]])
    renderHook(() => useConversationBroadcastSync())
    emitConnectionState('open') // 首连
    emitConnectionState('open') // 底层状态机去重不会真发,这里直接重放也不应触发
    emitConnectionState('closed')
    emitConnectionState('open')
    expect(resyncMock).not.toHaveBeenCalled()
  })

  it('没有当前会话 ⇒ 重连也不发请求(无房间可补)', () => {
    storeState.conversationId = null
    storeState.chatSync = syncStateOf([['m-live', false]])
    renderHook(() => useConversationBroadcastSync())
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    expect(resyncMock).not.toHaveBeenCalled()
  })

  it('变异锁:hook 必须真调用契约 planner(抹掉即红,不靠恒绿断言)', () => {
    const { readFileSync } = require('node:fs') as typeof import('node:fs')
    const { resolve } = require('node:path') as typeof import('node:path')
    const src = readFileSync(resolve(__dirname, '../use-conversation-broadcast-sync.ts'), 'utf8')
    const marker = 'planChatSyncReconnectResync({'
    expect(src).toContain(marker)
    expect(src.replace(marker, '')).not.toContain(marker)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
