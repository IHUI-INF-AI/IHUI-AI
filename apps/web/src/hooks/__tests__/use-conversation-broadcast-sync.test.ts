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
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { ChatSyncState } from '@ihui/types'

const {
  userBroadcastMock,
  chatSyncMock,
  historyMock,
  applyChatSyncMock,
  closeMeta,
  closeChat,
  storeState,
} = vi.hoisted(() => ({
  userBroadcastMock: vi.fn(),
  chatSyncMock: vi.fn(),
  historyMock: vi.fn(),
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
    } as unknown as ChatSyncState,
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
  getConversationHistory: (...args: unknown[]) => historyMock(...args),
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
  } as unknown as ChatSyncState
  // 默认:锚点建立成功,newer 无新增轮(不干扰既有 planner 用例)
  historyMock.mockImplementation((_id: string, params: { direction?: string }) =>
    Promise.resolve({
      success: true,
      data: {
        turns: [],
        nextCursor: null,
        prevCursor: params.direction === 'newest' ? 'anchor-cursor' : null,
        cursorState: { status: 'ok' },
      },
    }),
  )
})

/** 从 meta 订阅的 handlers 里取 onState,按真实状态机序列驱动重连判定。 */
function emitConnectionState(s: 'idle' | 'connecting' | 'open' | 'closed'): void {
  const handlers = userBroadcastMock.mock.calls[0]?.[1] as
    { onState?: (state: string) => void } | undefined
  handlers?.onState?.(s)
}

/** 构造一条无终态 / 有终态消息面(planner 只认 terminal 有无,内容不参与判定)。 */
function syncStateOf(entries: readonly [string, boolean][]): ChatSyncState {
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
  } as unknown as ChatSyncState
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
    const src = readFileSync(resolve(__dirname, '../use-conversation-broadcast-sync.ts'), 'utf8')
    const marker = 'planChatSyncReconnectResync({'
    expect(src).toContain(marker)
    expect(src.replace(marker, '')).not.toContain(marker)
  })

  // ==================== 断线期全新消息(本地 rev 账本为零的那批) ====================
  it('重连 ⇒ 按 history 水位补全新消息,已知无终态仍由 planner 负责(两路不重复)', async () => {
    storeState.chatSync = syncStateOf([['m-live', false]])
    historyMock.mockImplementation((_id: string, params: { direction?: string }) =>
      Promise.resolve({
        success: true,
        data: {
          turns:
            params.direction === 'newer'
              ? [{ turnOrdinal: 7, messages: [{ id: 'm-live' }, { id: 'm-new' }] }]
              : [],
          nextCursor: null,
          prevCursor: params.direction === 'newest' ? 'anchor-cursor' : 'newer-cursor',
          cursorState: { status: 'ok' },
        },
      }),
    )
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() =>
      expect(historyMock).toHaveBeenCalledWith('conv-1', { direction: 'newest', limit: 1 }),
    )
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    await waitFor(() => expect(resyncMock).toHaveBeenCalledTimes(2))
    const idSets = resyncMock.mock.calls.map((call) => call[0].messageIds)
    expect(idSets).toContainEqual(['m-live'])
    expect(idSets).toContainEqual(['m-new'])
  })

  it('水位 stale ⇒ 整段重锚,不发半真窗口的增量快照', async () => {
    storeState.chatSync = syncStateOf([['m-live', false]])
    historyMock.mockImplementation((_id: string, params: { direction?: string }) =>
      Promise.resolve({
        success: true,
        data: {
          turns:
            params.direction === 'newer' ? [{ turnOrdinal: 7, messages: [{ id: 'm-new' }] }] : [],
          nextCursor: null,
          prevCursor: params.direction === 'newest' ? 'anchor-cursor' : null,
          cursorState:
            params.direction === 'newer'
              ? { status: 'stale', reason: 'anchor-missing' }
              : { status: 'ok' },
        },
      }),
    )
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(1))
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    await waitFor(() =>
      expect(historyMock.mock.calls.filter((c) => c[1]?.direction === 'newer')).toHaveLength(1),
    )
    await waitFor(() =>
      expect(historyMock.mock.calls.filter((c) => c[1]?.direction === 'newest')).toHaveLength(2),
    )
    expect(resyncMock).toHaveBeenCalledTimes(1)
    expect(resyncMock).toHaveBeenCalledWith(expect.objectContaining({ messageIds: ['m-live'] }))
  })

  it('anchor 没给出水位 ⇒ 降级为只补本地已知,不伪造增量', async () => {
    storeState.chatSync = syncStateOf([['m-live', false]])
    historyMock.mockResolvedValue({
      success: true,
      data: { turns: [], nextCursor: null, prevCursor: null, cursorState: { status: 'ok' } },
    })
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(1))
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    expect(resyncMock).toHaveBeenCalledTimes(1)
    expect(historyMock.mock.calls.some((c) => c[1]?.direction === 'newer')).toBe(false)
  })

  // ==================== 2026-11-24:水位先行永久漏 + 100 turn 分页闭合 ====================
  it('重连一次补 >100 turn:按 prevCursor 翻页累积 ids,不只是第一页', async () => {
    storeState.chatSync = syncStateOf([])
    // newest 锚点 = turn 0;newer 第一页 100 turn(hasMore),第二页 2 turn(末页)
    let newerCalls = 0
    historyMock.mockImplementation((_id: string, params: { direction?: string; cursor?: string }) => {
      if (params.direction === 'newest') {
        return Promise.resolve({
          success: true,
          data: { turns: [], nextCursor: null, prevCursor: 'cursor-0', cursorState: { status: 'ok' } },
        })
      }
      newerCalls += 1
      if (newerCalls === 1) {
        expect(params.cursor).toBe('cursor-0')
        const turns = Array.from({ length: 100 }, (_, i) => ({
          turnOrdinal: i + 1,
          messages: [{ id: `new-${i + 1}` }],
        }))
        return Promise.resolve({
          success: true,
          data: { turns, nextCursor: null, prevCursor: 'cursor-100', hasMore: true, cursorState: { status: 'ok' } },
        })
      }
      expect(params.cursor).toBe('cursor-100')
      return Promise.resolve({
        success: true,
        data: {
          turns: [
            { turnOrdinal: 101, messages: [{ id: 'new-101' }] },
            { turnOrdinal: 102, messages: [{ id: 'new-102' }] },
          ],
          nextCursor: null,
          prevCursor: 'cursor-102',
          hasMore: false,
          cursorState: { status: 'ok' },
        },
      })
    })
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(1))
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    // 两页 ids 一次交给 planner ⇒ 单次 resync 拿到全部 102 个新消息坐标
    await waitFor(() => expect(resyncMock).toHaveBeenCalledTimes(1))
    expect(resyncMock.mock.calls[0]?.[0].messageIds).toHaveLength(102)
    expect(resyncMock.mock.calls[0]?.[0].messageIds).toContain('new-102')
    expect(historyMock.mock.calls.filter((c) => c[1]?.direction === 'newer')).toHaveLength(2)
  })

  it('resync 失败(failed>0)⇒ 水位不推进,下轮重连幂等重取同一批', async () => {
    storeState.chatSync = syncStateOf([])
    historyMock.mockImplementation((_id: string, params: { direction?: string }) =>
      Promise.resolve({
        success: true,
        data: {
          turns: params.direction === 'newer' ? [{ turnOrdinal: 7, messages: [{ id: 'm-new' }] }] : [],
          nextCursor: null,
          prevCursor: params.direction === 'newest' ? 'cursor-0' : 'cursor-7',
          hasMore: false,
          cursorState: { status: 'ok' },
        },
      }),
    )
    resyncMock.mockResolvedValueOnce({ attempted: 1, merged: 0, dropped: 0, failed: 1 })
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() => expect(historyMock).toHaveBeenCalledTimes(1))
    // 第一次重连:resync 失败 ⇒ 水位停在 cursor-0
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    await waitFor(() => expect(resyncMock).toHaveBeenCalledTimes(1))
    // 第二次重连:应以同一个 cursor-0 重取(而非失败页的 cursor-7)
    emitConnectionState('closed')
    emitConnectionState('open')
    await waitFor(() =>
      expect(
        historyMock.mock.calls.filter(
          (c) => c[1]?.direction === 'newer' && c[1]?.cursor === 'cursor-0',
        ).length,
      ).toBe(2),
    )
  })

  it('首连锚点失败 ⇒ 重连时懒重试锚点,成功后补增量(不再冻结整会话)', async () => {
    storeState.chatSync = syncStateOf([])
    let anchorCalls = 0
    historyMock.mockImplementation((_id: string, params: { direction?: string }) => {
      if (params.direction === 'newest') {
        anchorCalls += 1
        // 第一次(首连)失败,第二次(重连懒重试)成功
        return Promise.resolve(
          anchorCalls === 1
            ? { success: false, data: null }
            : {
                success: true,
                data: { turns: [], nextCursor: null, prevCursor: 'cursor-lazy', cursorState: { status: 'ok' } },
              },
        )
      }
      return Promise.resolve({
        success: true,
        data: {
          turns: [{ turnOrdinal: 7, messages: [{ id: 'm-lazy-new' }] }],
          nextCursor: null,
          prevCursor: 'cursor-7',
          hasMore: false,
          cursorState: { status: 'ok' },
        },
      })
    })
    renderHook(() => useConversationBroadcastSync())
    await waitFor(() => expect(anchorCalls).toBe(1))
    emitConnectionState('open')
    emitConnectionState('closed')
    emitConnectionState('open')
    await waitFor(() => expect(resyncMock).toHaveBeenCalledTimes(1))
    expect(resyncMock.mock.calls[0]?.[0].messageIds).toContain('m-lazy-new')
    expect(anchorCalls).toBe(2)
  })

  it('变异锁:水位推进必须在 resync 成功之后(先写水位再 fire-and-forget 即红)', () => {
    const src = readFileSync(resolve(__dirname, '../use-conversation-broadcast-sync.ts'), 'utf8')
    expect(src).toContain('if (cancelled || outcome.failed > 0) return')
    expect(src).toContain('RECONNECT_HISTORY_MAX_PAGES')
    // 反向:不得存在"先写 historyCursorRef.current = delta.nextCursor 再 void resync"的旧序
    const oldOrder = 'historyCursorRef.current = delta.nextCursor\n          if (delta.ids.length === 0) return'
    expect(src).not.toContain(oldOrder)
  })

  it('变异锁:全新消息补拉必须真走 history newer + 集合差 planner(抹掉即红)', () => {
    const src = readFileSync(resolve(__dirname, '../use-conversation-broadcast-sync.ts'), 'utf8')
    const planner = 'planChatSyncReconnectNewMessages({'
    const newer = "direction: 'newer'"
    expect(src).toContain(planner)
    expect(src).toContain(newer)
    expect(src.replace(planner, '').replace(newer, '')).not.toContain(newer)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
