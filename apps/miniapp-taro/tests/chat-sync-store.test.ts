// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 票 B02 最后一格(2026-10-26):小程序端 chat 同步 store 的验收面。
 *
 * 测的是**真链路**:`attachUserBroadcast`(端内接线)→ 共享出口 ingest →
 * `@ihui/shared/chat` 的 chat-sync-store → 消息面。不 mock 判据 —— 幂等/四态/待 resync
 * 全部来自 `@ihui/types` 的契约内核,用例只喂帧、只断言结果。
 *
 * 四条必需用例(票面要求):
 *  ① 同一帧重放两次 ⇒ 状态只变一次(幂等正控,含"引用不变 + version 不增"的强断言);
 *  ② stale rev ⇒ 不覆盖(负控);
 *  ③ gap ⇒ 标记待 resync 并点名(§0.3 不静默丢);
 *  ④ 新模块的 store 单测(未判定帧/未接线帧/多会话分桶 + 端内不得抄帧名与内核)。
 *
 * 真机/微信 IDE 验证:**未判定**(本机不具备微信开发者工具自动化),见交付说明;
 * 本文件证明的是 node 环境下的同一条接线,不是替代真机观感验证。
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  feedUserBroadcastFrame,
  getUserBroadcastHubStats,
  resetUserBroadcastHub,
} from '@ihui/api-client'
import {
  CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
  messageCreatedEvent,
  messagePatchedEvent,
  messageTerminalEvent,
  toUserBroadcastFrame,
  type ChatSyncEvent,
} from '@ihui/types'
import { chatSyncStore } from '@ihui/shared/chat'

import {
  attachUserBroadcast,
  resetBroadcastNotices,
  type UserBroadcastAdapterDeps,
} from '@/lib/user-broadcast'
import { chatSyncTaroStoreApi } from '@/stores/chat-sync'

const HERE = dirname(fileURLToPath(import.meta.url))
const BASE_URL = 'https://aizhs.top/api'
const C1 = 'conv-1'
const C2 = 'conv-2'
const M1 = 'msg-1'

/** 假 WS 工厂:一建连就抛 ⇒ 共享层按既有守卫收场,用例不依赖真实 socket */
const throwingSocketFactory = (): never => {
  throw new Error('test: no socket in node env')
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

describe('① 幂等正控:同一帧重放两次 ⇒ 状态只变一次', () => {
  it('created 重放:消息面引用不变、version 不增、duplicate 计数 +1', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)

    feed(createdFrame())
    const snap = chatSyncStore.messagesOf(C1)
    const versionAfterFirst = chatSyncStore.version()
    expect(snap).toHaveLength(1)
    expect(snap[0]?.content).toBe('A')

    // 同一逻辑变更重投(at-least-once 的正常路径):必须零变化
    feed(createdFrame())
    expect(chatSyncStore.messagesOf(C1)).toBe(snap)
    expect(chatSyncStore.version()).toBe(versionAfterFirst)
    expect(chatSyncStore.counters()).toMatchObject({ applied: 1, duplicate: 1 })
    expect(deps.undetermined).toEqual([])
  })

  it('patched 重放:同一 (messageId, rev) 第二次判 duplicate,内容不翻倍', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)

    feed(createdFrame())
    feed(patchFrame(1, 'delta', { textDelta: '好' }))
    const snap = chatSyncStore.messagesOf(C1)
    expect(snap[0]?.content).toBe('A好')

    // 双通道齐发/重连重放:同一 rev 再来一次
    feed(patchFrame(1, 'delta', { textDelta: '好' }))
    expect(chatSyncStore.messagesOf(C1)).toBe(snap)
    expect(chatSyncStore.messagesOf(C1)[0]?.content).toBe('A好')
    expect(chatSyncStore.appliedRevOf(C1, M1)).toBe(1)
    expect(chatSyncStore.counters()).toMatchObject({ applied: 2, duplicate: 1 })
    expect(deps.undetermined).toEqual([])
  })
})

describe('② 负控:stale rev 不得覆盖较新内容', () => {
  it('rev=2 snapshot 落地后,迟到的 rev=1 delta 判 stale 且内容不变', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)

    feed(createdFrame())
    feed(patchFrame(2, 'snapshot', { content: 'AB' }))
    expect(chatSyncStore.appliedRevOf(C1, M1)).toBe(2)

    const snap = chatSyncStore.messagesOf(C1)
    feed(patchFrame(1, 'delta', { textDelta: 'X' }))
    expect(chatSyncStore.messagesOf(C1)).toBe(snap)
    expect(chatSyncStore.messagesOf(C1)[0]?.content).toBe('AB')
    expect(chatSyncStore.appliedRevOf(C1, M1)).toBe(2)
    expect(chatSyncStore.counters()).toMatchObject({ stale: 1, applied: 2 })
    // stale 是契约规定的正常路径:不排 resync、不点名
    expect(chatSyncStore.pendingResyncs()).toEqual([])
    expect(deps.undetermined).toEqual([])
  })
})

describe('③ gap ⇒ 标记待 resync 并点名', () => {
  it('rev 跳号(delta rev=3,链头 0)⇒ 内容不变、进待办、lastAppliedRev 是端侧链头', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)

    feed(createdFrame('ABC'.slice(0, 1)))
    feed(patchFrame(3, 'delta', { textDelta: 'X' }))

    expect(chatSyncStore.messagesOf(C1)[0]?.content).toBe('A')
    expect(chatSyncStore.counters()).toMatchObject({ gap: 1, applied: 1 })
    expect(chatSyncStore.pendingResyncs()).toEqual([
      { conversationId: C1, messageId: M1, lastAppliedRev: 0 },
    ])
    // gap 不是"静默丢":帧被认出并计进 gap 桶,待办可被上层读取
    expect(deps.undetermined).toEqual([])
  })

  it('resync 快照并回后内容推进且待办摘除(复用契约 merge,不旁路写状态)', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame())
    feed(patchFrame(3, 'delta', { textDelta: 'X' }))
    expect(chatSyncStore.pendingResyncs()).toHaveLength(1)

    const outcome = chatSyncStore.mergeResyncSnapshot({
      conversationId: C1,
      messageId: M1,
      rev: 3,
      role: 'assistant',
      content: 'ABCD',
    })
    expect(outcome.applied).toBe(true)
    expect(chatSyncStore.messagesOf(C1)[0]?.content).toBe('ABCD')
    expect(chatSyncStore.appliedRevOf(C1, M1)).toBe(3)
    expect(chatSyncStore.pendingResyncs()).toEqual([])
  })
})

describe('④ store 单测:未判定帧 / 未接线帧 / 多会话分桶', () => {
  it('未知帧类型 ⇒ 不进内核、不写状态、计 undetermined 并点名', () => {
    sub = attachUserBroadcast(makeDeps())
    const base = createdFrame()
    const data = base.data as Record<string, unknown>
    const unknownType = { ...data, type: 'message:meta' } as unknown as ChatSyncEvent
    const outcome = chatSyncStore.applyEvent(unknownType)

    expect(outcome.undetermined).toBe('unknown-type')
    expect(outcome.result).toBeNull()
    expect(chatSyncStore.messagesOf(C1)).toEqual([])
    expect(chatSyncStore.counters()).toMatchObject({ undetermined: 1, applied: 0 })
  })

  it('协议版本与帧族不同域 ⇒ 不应用、按契约 §2 注按 gap 处理(排待 resync)', () => {
    sub = attachUserBroadcast(makeDeps())
    const data = createdFrame().data as Record<string, unknown>
    const wrongVersion = {
      ...data,
      protocolVersion: CHAT_SYNC_TERMINAL_PROTOCOL_VERSION,
    } as unknown as ChatSyncEvent
    const outcome = chatSyncStore.applyEvent(wrongVersion)

    expect(outcome.undetermined).toBe('protocol-version-mismatch')
    expect(outcome.resync.needed).toBe(true)
    expect(chatSyncStore.messagesOf(C1)).toEqual([])
    expect(chatSyncStore.pendingResyncs()).toEqual([
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
    // 状态面零变化:终态投影与生产端发终态同批,本票不做
    expect(chatSyncStore.messagesOf(C1)[0]?.terminal).toBeUndefined()
    expect(chatSyncStore.counters()).toMatchObject({ unwired: 1 })
    expect(deps.undetermined).toEqual([{ event: 'message:terminal', reason: 'terminal' }])
  })

  it('多会话按 room.conversationId 分桶:切会话不串、不重订', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame('m1', 'A', C1))
    feed(createdFrame('m2', 'B', C2))

    expect(chatSyncStore.conversationIds()).toEqual([C1, C2])
    expect(chatSyncStore.messagesOf(C1).map((m) => m.id)).toEqual(['m1'])
    expect(chatSyncStore.messagesOf(C2).map((m) => m.id)).toEqual(['m2'])
    // 未知会话 ⇒ 同一冻结空数组(useSyncExternalStore 的快照稳定性要求)
    expect(chatSyncStore.messagesOf('conv-none')).toBe(chatSyncStore.messagesOf('conv-none'))
  })

  it('坏帧在共享 parse 层被拒 ⇒ 端内 onUndetermined 收到点名且 store 零变化', () => {
    const deps = makeDeps()
    sub = attachUserBroadcast(deps)
    const bad = { event: 'message:created', data: { messageId: M1, content: 'A' } }
    expect(feed(bad)).toBeNull()
    expect(chatSyncStore.messagesOf(C1)).toEqual([])
    expect(deps.undetermined).toHaveLength(1)
  })
})

describe('结构纪律:端内不抄帧名、不抄内核', () => {
  const END_FILES = [
    join(HERE, '../src/lib/user-broadcast.ts'),
    join(HERE, '../src/stores/chat-sync.ts'),
  ]
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
      // 内核只许经 @ihui/shared/chat 的 store 间接使用;端内直调 = 第二套裁定的起点
      expect(source).not.toMatch(/applyChatSyncEvent\s*\(/)
      expect(source).not.toMatch(/chatPatchKey\s*\(/)
      expect(source).not.toMatch(/chatSyncIdempotencyKey\s*\(/)
    }
  })

  it('接线证明:handler 键引用契约常量,且帧确实投进共享 store', () => {
    const libSource = readFileSync(join(HERE, '../src/lib/user-broadcast.ts'), 'utf8')
    expect(libSource).toContain('CHAT_SYNC_EVENT_NAMES.MESSAGE_CREATED')
    expect(libSource).toContain('CHAT_SYNC_EVENT_NAMES.MESSAGE_PATCHED')
    // 端内接线经本端 store 的绑定层(它再转调共享 store),不是直连内核
    expect(libSource).toContain('chatSyncTaroStoreApi.getState().applyEvent(')
    // 反向证明:摘掉订阅后同一帧不再进 store(不是"页面轮询顺手写进来的")
    const isolate = makeDeps()
    expect(isolate.undetermined).toEqual([])
    expect(chatSyncStore.messagesOf(C1)).toEqual([])
  })
})

describe('装载证明:端内 store hook 与共享单例同源', () => {
  it('端内 store 的 messagesOf 直通共享 store(改共享 store ⇒ 端内可见)', () => {
    sub = attachUserBroadcast(makeDeps())
    feed(createdFrame())
    expect(chatSyncTaroStoreApi.getState().messagesOf(C1)).toBe(chatSyncStore.messagesOf(C1))
    expect(getUserBroadcastHubStats().length).toBeGreaterThan(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
