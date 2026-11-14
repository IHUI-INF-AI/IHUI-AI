// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 #71(2026-10-31):RN 端 chat 多端/多标签实时同步的验收面。
 *
 * 测的是**真链路**:`attachUserBroadcast`(端内接线)→ 共享出口 ingest →
 * `@ihui/shared/chat` 的 chat-sync-store → 本端绑定层(chatSyncRnStoreApi)
 * → `useRemoteChatSyncMessages`(页级消息投影)。判据不 mock —— 幂等/四态/待 resync
 * 全部来自 `@ihui/types` 的契约内核,用例只喂帧、只断言结果。
 *
 * 覆盖(票面要求的三条 + 结构纪律):
 *  ① patched 帧 ⇒ 消息更新(经 hook 投影到页级 messages);
 *  ② 重复帧幂等:状态面引用不变、version 不增、不重复追加;
 *  ③ 未知帧点名计数且不写状态(共享 parse 层 + 契约内核两档);
 *  ④ 投影层纯函数:历史行(flagTargetId / `serverId-序号`)就地更新、回声不追加;
 *  ⑤ 结构纪律:端内不抄帧名、不抄内核、ChatScreen 真挂载。
 *
 * 验证层级:本文件是 node(jsdom)下的同一条接线,**不是真机验证** —— RN 界面在本机
 * 渲染不了,真机观感需另行验收(交付说明如实标注)。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { useState } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { feedUserBroadcastFrame, resetUserBroadcastHub } from '@ihui/api-client'
import {
  CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
  messageCreatedEvent,
  messagePatchedEvent,
  messageTerminalEvent,
  toUserBroadcastFrame,
  type ChatSyncEvent,
} from '@ihui/types'
import type { ChatMessage } from '@ihui/shared'
import { chatSyncStore } from '@ihui/shared/chat'

import {
  attachUserBroadcast,
  resetBroadcastNotices,
  type UserBroadcastAdapterDeps,
} from '../src/lib/user-broadcast'
import {
  applyChatSyncSurfaceMerge,
  chatSyncRnStoreApi,
  planChatSyncSurfaceMerge,
  useRemoteChatSyncMessages,
} from '../src/stores/chat-sync'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'http://localhost:8802'
const C1 = 'conv-rn-1'
const C2 = 'conv-rn-2'
const M1 = 'msg-rn-1'

/** 假 WS 工厂:一建连就抛 ⇒ 共享层按既有守卫收场,用例不依赖真实 socket */
const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in vitest env')
}

function makeDeps(): UserBroadcastAdapterDeps & { undetermined: unknown[] } {
  const undetermined: unknown[] = []
  return {
    undetermined,
    baseUrl: BASE_URL,
    token: 'test-access-token',
    translate: (key: string) => `«${key}»`,
    notify: () => {},
    webSocketFactory: throwingSocketFactory,
    onUndetermined: (raw: unknown) => {
      undetermined.push(raw)
    },
  }
}

function createdFrame(messageId = M1, content = 'A', conversationId = C1) {
  return toUserBroadcastFrame(
    messageCreatedEvent({ conversationId, messageId, role: 'assistant', content }),
  )
}

function patchFrame(
  rev: number,
  kind: 'delta' | 'snapshot',
  payload: { textDelta?: string; content?: string },
  messageId = M1,
  conversationId = C1,
) {
  return toUserBroadcastFrame(
    messagePatchedEvent({ conversationId, messageId, rev, kind, ...payload }),
  )
}

/** 走端到端 ingest(经共享出口 parse);未接订阅时返回 null */
function feed(frame: unknown): unknown {
  return feedUserBroadcastFrame(frame, { baseUrl: BASE_URL })
}

let sub: ReturnType<typeof attachUserBroadcast> = null

beforeEach(() => {
  resetUserBroadcastHub()
  resetBroadcastNotices()
  chatSyncStore.clear()
})

afterEach(() => {
  sub?.close()
  sub = null
  resetUserBroadcastHub()
  chatSyncStore.clear()
  vi.unstubAllGlobals()
})

describe('① patched 帧 ⇒ 页级消息更新(经 hook 投影)', () => {
  it('created + delta patch:页级 messages 出现该行并随 rev 推进内容', () => {
    sub = attachUserBroadcast(makeDeps())
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([])
      useRemoteChatSyncMessages({ conversationId: C1, setMessages })
      return messages
    })

    act(() => {
      feed(createdFrame())
    })
    expect(result.current).toHaveLength(1)
    expect(result.current[0]).toMatchObject({ id: M1, role: 'assistant', content: 'A' })

    act(() => {
      feed(patchFrame(1, 'delta', { textDelta: '好' }))
    })
    expect(result.current).toHaveLength(1)
    expect(result.current[0]?.content).toBe('A好')
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toBe(chatSyncStore.messagesOf(C1))
  })

  it('snapshot patch 就地覆盖已存在的历史行(按服务端 id 匹配,不追加新行)', () => {
    sub = attachUserBroadcast(makeDeps())
    const seeded: ChatMessage[] = [
      { id: 'old-0', role: 'user', content: '问题' },
      { id: `${M1}-1`, role: 'assistant', content: 'A' },
    ]
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>(seeded)
      useRemoteChatSyncMessages({ conversationId: C1, setMessages })
      return messages
    })

    act(() => {
      feed(createdFrame(M1, 'A'))
      feed(patchFrame(1, 'snapshot', { content: 'AB' }))
    })

    expect(result.current).toHaveLength(2)
    expect(result.current[1]?.id).toBe(`${M1}-1`)
    expect(result.current[1]?.content).toBe('AB')
  })

  it('本端流式中暂停投影;paused 结束后补上(暂停期间的帧不丢)', () => {
    sub = attachUserBroadcast(makeDeps())
    const { result, rerender } = renderHook(
      (props: { paused: boolean }) => {
        const [messages, setMessages] = useState<ChatMessage[]>([])
        useRemoteChatSyncMessages({ conversationId: C1, setMessages, paused: props.paused })
        return messages
      },
      { initialProps: { paused: true } },
    )

    act(() => {
      feed(createdFrame())
    })
    expect(result.current).toHaveLength(0)

    rerender({ paused: false })
    expect(result.current).toHaveLength(1)
  })
})

describe('② 重复帧幂等:不重复发布/不重复追加', () => {
  it('created 重放:消息面引用不变、绑定层 version 不增、duplicate 计数 +1', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame())
    const snapshot = chatSyncRnStoreApi.getState().messagesOf(C1)
    const versionAfterFirst = chatSyncRnStoreApi.getState().version
    expect(snapshot).toHaveLength(1)

    // 同一逻辑变更重投(at-least-once 的正常路径):必须零变化
    feed(createdFrame())
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toBe(snapshot)
    expect(chatSyncRnStoreApi.getState().version).toBe(versionAfterFirst)
    expect(chatSyncRnStoreApi.getState().counters()).toMatchObject({ applied: 1, duplicate: 1 })
  })

  it('patched 重放:同一 (messageId, rev) 第二次判 duplicate,页级不追加第二条', () => {
    sub = attachUserBroadcast(makeDeps())
    const { result } = renderHook(() => {
      const [messages, setMessages] = useState<ChatMessage[]>([])
      useRemoteChatSyncMessages({ conversationId: C1, setMessages })
      return messages
    })

    act(() => {
      feed(createdFrame())
      feed(patchFrame(1, 'delta', { textDelta: '好' }))
    })
    const before = result.current
    expect(before).toHaveLength(1)
    expect(before[0]?.content).toBe('A好')

    act(() => {
      feed(patchFrame(1, 'delta', { textDelta: '好' }))
    })
    // 引用不变 = 没有 setMessages(重复帧不得触发重渲染)
    expect(result.current).toBe(before)
    expect(result.current).toHaveLength(1)
    expect(chatSyncRnStoreApi.getState().counters()).toMatchObject({ applied: 2, duplicate: 1 })
  })

  it('stale rev 不覆盖较新内容(负控:迟到 delta 不得把内容打回去)', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame())
    feed(patchFrame(2, 'snapshot', { content: 'AB' }))
    const snapshot = chatSyncRnStoreApi.getState().messagesOf(C1)

    feed(patchFrame(1, 'delta', { textDelta: 'X' }))
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toBe(snapshot)
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)[0]?.content).toBe('AB')
    expect(chatSyncRnStoreApi.getState().counters()).toMatchObject({ stale: 1, applied: 2 })
  })
})

describe('③ 未知帧:点名计数且不写状态', () => {
  it('共享 parse 层认不出的帧 ⇒ 端内 onUndetermined 收到点名,store 零变化', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)
    const bad = { event: 'message:meta', data: { messageId: M1, content: 'A' } }

    expect(feed(bad)).toBeNull()
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toEqual([])
    expect(deps.undetermined).toHaveLength(1)
  })

  it('契约集外的帧类型(绕过 parse 直投)⇒ undetermined 计数 +1、不写状态、结果面点名', () => {
    sub = attachUserBroadcast(makeDeps())
    const base = createdFrame().data as Record<string, unknown>
    const unknownType = { ...base, type: 'message:meta' } as unknown as ChatSyncEvent

    const outcome = chatSyncRnStoreApi.getState().applyEvent(unknownType)
    expect(outcome.undetermined).toBe('unknown-type')
    expect(outcome.result).toBeNull()
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toEqual([])
    expect(chatSyncRnStoreApi.getState().counters()).toMatchObject({ undetermined: 1, applied: 0 })
  })

  it('协议版本与帧族不同域 ⇒ 不应用、按契约排待 resync', () => {
    sub = attachUserBroadcast(makeDeps())
    const base = createdFrame().data as Record<string, unknown>
    const wrongVersion = {
      ...base,
      protocolVersion: CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
    } as unknown as ChatSyncEvent

    const outcome = chatSyncRnStoreApi.getState().applyEvent(wrongVersion)
    expect(outcome.undetermined).toBe('protocol-version-mismatch')
    expect(outcome.resync.needed).toBe(true)
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toEqual([])
    expect(chatSyncRnStoreApi.getState().pendingResyncs()).toEqual([
      { conversationId: C1, messageId: M1, lastAppliedRev: 0 },
    ])
  })

  it('terminal 帧:本票不投影终态,但必须点名(静默丢 = 最高频失效型)', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)
    feed(createdFrame())
    deps.undetermined.length = 0

    feed(
      toUserBroadcastFrame(
        messageTerminalEvent({ conversationId: C1, messageId: M1, rev: 0, reason: 'stop' }),
      ),
    )
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)[0]?.terminal).toBeUndefined()
    expect(chatSyncRnStoreApi.getState().counters()).toMatchObject({ unwired: 1 })
    expect(deps.undetermined).toEqual([{ event: 'message:terminal', reason: 'terminal' }])
  })

  it('多会话按 room.conversationId 分桶:切会话不串、不重订', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame('m1', 'A', C1))
    feed(createdFrame('m2', 'B', C2))

    expect(chatSyncStore.conversationIds()).toEqual([C1, C2])
    expect(chatSyncRnStoreApi.getState().messagesOf(C1).map((m) => m.id)).toEqual(['m1'])
    expect(chatSyncRnStoreApi.getState().messagesOf(C2).map((m) => m.id)).toEqual(['m2'])
  })
})

describe('④ 投影层纯函数(不依赖 React)', () => {
  it('历史行按 flagTargetId 命中 ⇒ 就地更新,不追加', () => {
    const local = [
      { id: 'svr-1-0', role: 'assistant', content: 'A', flagTargetId: 'svr-1' },
    ]
    const plan = planChatSyncSurfaceMerge(local, [
      { id: 'svr-1', role: 'assistant', content: 'AB' },
    ])
    expect(plan?.updates).toEqual([{ index: 0, content: 'AB' }])
    expect(plan?.appends).toEqual([])
  })

  it('历史行按 `serverId-序号` 约定命中(无 flagTargetId 时)', () => {
    const local = [{ id: 'svr-2-3', role: 'assistant', content: 'A' }]
    const plan = planChatSyncSurfaceMerge(local, [
      { id: 'svr-2', role: 'assistant', content: 'AB' },
    ])
    expect(plan?.updates).toEqual([{ index: 0, content: 'AB' }])
  })

  it('本地缺少该消息 ⇒ 追加;内容逐字相同的同角色行 ⇒ 判回声不追加', () => {
    const local = [{ id: 'msg-local-1', role: 'assistant', content: 'A好' }]
    const fresh = planChatSyncSurfaceMerge(local, [
      { id: 'svr-3', role: 'assistant', content: '另一端的新回答' },
    ])
    expect(fresh?.appends.map((s) => s.id)).toEqual(['svr-3'])

    const echo = planChatSyncSurfaceMerge(local, [
      { id: 'svr-3', role: 'assistant', content: 'A好' },
    ])
    expect(echo).toBeNull()
  })

  it('零变化返回 null(调用方据此不发布);应用后保留行上其它字段', () => {
    const local: ChatMessage[] = [
      { id: 'svr-4', role: 'assistant', content: 'A', reasoning: 'r', pinnedAt: '2026-10-31' },
    ]
    expect(
      planChatSyncSurfaceMerge(local, [{ id: 'svr-4', role: 'assistant', content: 'A' }]),
    ).toBeNull()

    const plan = planChatSyncSurfaceMerge(local, [
      { id: 'svr-4', role: 'assistant', content: 'AB' },
    ])
    expect(plan).not.toBeNull()
    const next = applyChatSyncSurfaceMerge(local, plan!)
    expect(next[0]).toMatchObject({ id: 'svr-4', content: 'AB', pinnedAt: '2026-10-31' })
    expect(next).not.toBe(local)
  })
})

describe('⑤ 结构纪律与装车证明', () => {
  const END_FILES = [
    join(HERE, '../src/lib/user-broadcast.ts'),
    join(HERE, '../src/stores/chat-sync.ts'),
  ]
  const SCREEN = join(HERE, '../src/screens/ChatScreen.tsx')
  const SHARED_STORE = join(HERE, '../../../packages/shared/src/chat/chat-sync-store.ts')

  it('端内与共享 store 都不得出现帧名字面量(必须引用 CHAT_SYNC_EVENT_NAMES)', () => {
    for (const file of [...END_FILES, SHARED_STORE]) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/['"]message:(created|patched|terminal)['"]/)
      expect(source).not.toMatch(/===\s*['"]message:/)
    }
  })

  it('端内不得重写幂等判据:不 import/不调用契约内核的比较层', () => {
    for (const file of END_FILES) {
      const source = readFileSync(file, 'utf8')
      expect(source).not.toMatch(/applyChatSyncEvent\s*\(/)
      expect(source).not.toMatch(/chatPatchKey\s*\(/)
      expect(source).not.toMatch(/chatSyncIdempotencyKey\s*\(/)
    }
  })

  it('接线证明:handler 键引用契约常量,且帧确实投进共享 store;ChatScreen 真挂载', () => {
    const libSource = readFileSync(join(HERE, '../src/lib/user-broadcast.ts'), 'utf8')
    expect(libSource).toContain('CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED')
    expect(libSource).toContain('CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED')
    expect(libSource).toContain('chatSyncRnStoreApi.getState().applyEvent(')

    const screenSource = readFileSync(SCREEN, 'utf8')
    expect(screenSource).toContain('useRemoteChatSyncMessages({ conversationId, setMessages')
  })

  it('一次订阅 = 一份账本:attach 成功后清空共享 store(换账号不串消息)', () => {
    chatSyncStore.applyEvent(
      messageCreatedEvent({
        conversationId: C1,
        messageId: 'stale',
        role: 'assistant',
        content: '上一位用户',
      }).data,
    )
    expect(chatSyncStore.messagesOf(C1)).toHaveLength(1)
    sub = attachUserBroadcast(makeDeps())
    expect(chatSyncRnStoreApi.getState().messagesOf(C1)).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
